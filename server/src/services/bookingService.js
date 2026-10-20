/**
 * bookingService - ALL booking business rules and the status state machine live here.
 *
 * Rules implemented (numbers refer to Section 05 of the brief):
 *  1 cannot borrow own item          2 dates not in past / end >= start
 *  3 duration <= max_days            4 no overlap with APPROVED / PICKED_UP
 *  5 item + owner must be active     6 max 3 open bookings per borrower
 *  7 role checks on status actions   8 only allowed transitions (409 otherwise)
 *  9 approve = one transaction (row lock, re-check overlap, auto-reject clashes)
 * 12 edit only while REQUESTED, delete only REJECTED / CANCELLED
 */
const { query, withTransaction } = require('../config/db');
const { badRequest, forbidden, notFound, conflict } = require('../utils/ApiError');

const OPEN_STATUSES = ['REQUESTED', 'APPROVED', 'PICKED_UP'];
const MAX_OPEN_BOOKINGS = 3;

// Section 06: the only transitions the backend allows.
const TRANSITIONS = {
  approve: { from: ['REQUESTED'], to: 'APPROVED', actor: 'owner' },
  reject: { from: ['REQUESTED'], to: 'REJECTED', actor: 'owner' },
  cancel: { from: ['REQUESTED', 'APPROVED'], to: 'CANCELLED', actor: 'borrower' },
  pickup: { from: ['APPROVED'], to: 'PICKED_UP', actor: 'owner' },
  return: { from: ['PICKED_UP'], to: 'RETURNED', actor: 'owner' },
};

// Shared SELECT for every booking read. The OVERDUE flag is computed, never stored.
const BOOKING_SELECT = `
  SELECT b.id, b.item_id, b.borrower_id, b.start_date, b.end_date, b.status,
         b.message, b.reject_reason, b.created_at, b.updated_at,
         (b.end_date - b.start_date + 1)                           AS days,
         (b.status = 'PICKED_UP' AND b.end_date < CURRENT_DATE)    AS is_overdue,
         i.title AS item_title, i.image_url AS item_image, i.owner_id,
         i.max_days AS item_max_days, i.pickup_area, c.name AS category_name,
         ou.name AS owner_name, bu.name AS borrower_name
    FROM bookings b
    JOIN items i      ON i.id  = b.item_id
    JOIN categories c ON c.id  = i.category_id
    JOIN users ou     ON ou.id = i.owner_id
    JOIN users bu ON bu.id = b.borrower_id`;

/* ----------------------------- helpers ----------------------------- */

const daysInclusive = (start, end) => {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
};

async function getToday(db = { query }) {
  const { rows } = await db.query('SELECT CURRENT_DATE::text AS today');
  return rows[0].today;
}

/**
 * THE date-overlap query (heart of the project).
 * A row = the requested dates collide with an APPROVED / PICKED_UP booking.
 * `excludeId` lets an approval / edit ignore the booking itself.
 */
async function hasOverlap(db, itemId, start, end, excludeId = null) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM bookings
      WHERE item_id = $1
        AND status IN ('APPROVED', 'PICKED_UP')
        AND start_date <= $3   -- existing booking starts before the new one ends
        AND end_date   >= $2   -- and ends after the new one starts
        AND ($4::int IS NULL OR id <> $4)`,
    [itemId, start, end, excludeId]
  );
  return rowCount > 0;
}

/** Rules 2 and 3. */
function assertValidRange(start, end, maxDays, today) {
  if (start < today) throw badRequest('start_date must not be in the past', { start_date: 'Start date cannot be in the past' });
  if (end < start) throw badRequest('end_date must be on or after start_date', { end_date: 'End date must be on or after start date' });
  const days = daysInclusive(start, end);
  if (days > maxDays) {
    throw badRequest(`This item can be borrowed for at most ${maxDays} day(s); you asked for ${days}`, {
      end_date: `Maximum ${maxDays} day(s) allowed`,
    });
  }
}

async function fetchBooking(db, id) {
  const { rows } = await db.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
  return rows[0] || null;
}

/* ----------------------------- reads ----------------------------- */

async function listMine(userId, status) {
  const params = [userId];
  let where = 'WHERE b.borrower_id = $1';
  if (status) {
    params.push(status);
    where += ` AND b.status = $${params.length}`;
  }
  const { rows } = await query(
    `${BOOKING_SELECT}
      ${where}
      ORDER BY b.created_at DESC, b.id DESC`,
    params
  );
  return attachReviewFlags(rows, userId);
}

async function listIncoming(ownerId, status) {
  const params = [ownerId];
  let where = 'WHERE i.owner_id = $1';
  if (status) {
    params.push(status);
    where += ` AND b.status = $${params.length}`;
  }
  const { rows } = await query(
    `${BOOKING_SELECT}
      ${where}
      ORDER BY (b.status = 'REQUESTED') DESC, b.created_at DESC, b.id DESC`,
    params
  );
  return attachReviewFlags(rows, ownerId);
}

/** Adds `reviewed_by_me` so the UI knows whether to show the "Review" button. */
async function attachReviewFlags(bookings, userId) {
  if (!bookings.length) return bookings;
  const ids = bookings.map((b) => b.id);
  const { rows } = await query(
    'SELECT booking_id FROM reviews WHERE reviewer_id = $1 AND booking_id = ANY($2::int[])',
    [userId, ids]
  );
  const reviewed = new Set(rows.map((r) => r.booking_id));
  return bookings.map((b) => ({ ...b, reviewed_by_me: reviewed.has(b.id) }));
}

async function getDetail(id, user) {
  const booking = await fetchBooking({ query }, id);
  if (!booking) throw notFound('Booking not found');
  if (booking.borrower_id !== user.id && booking.owner_id !== user.id) {
    throw forbidden('Only the borrower or the item owner can view this booking');
  }

  const [logs, reviews, phones] = await Promise.all([
    query(
      `SELECT cl.id, cl.stage, cl.condition, cl.note, cl.logged_by, cl.logged_at, u.name AS logged_by_name
         FROM condition_logs cl JOIN users u ON u.id = cl.logged_by
        WHERE cl.booking_id = $1 ORDER BY cl.logged_at, cl.id`,
      [id]
    ),
    query(
      `SELECT r.id, r.booking_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.created_at,
              ru.name AS reviewer_name, eu.name AS reviewee_name
         FROM reviews r
         JOIN users ru ON ru.id = r.reviewer_id
         JOIN users eu ON eu.id = r.reviewee_id
        WHERE r.booking_id = $1 ORDER BY r.created_at, r.id`,
      [id]
    ),
    query(
      `SELECT (SELECT phone FROM users WHERE id = $1) AS owner_phone,
              (SELECT phone FROM users WHERE id = $2) AS borrower_phone`,
      [booking.owner_id, booking.borrower_id]
    ),
  ]);

  // Contact numbers are only shared between the two parties once the loan is agreed.
  const share = ['APPROVED', 'PICKED_UP', 'RETURNED'].includes(booking.status);
  return {
    ...booking,
    owner_phone: share ? phones.rows[0].owner_phone : null,
    borrower_phone: share ? phones.rows[0].borrower_phone : null,
    condition_logs: logs.rows,
    reviews: reviews.rows,
    reviewed_by_me: reviews.rows.some((r) => r.reviewer_id === user.id),
  };
}

/* ----------------------------- create ----------------------------- */

async function createBooking(user, { item_id, start_date, end_date, message }) {
  const { rows } = await query(
    `SELECT i.id, i.owner_id, i.max_days, i.is_active, u.is_active AS owner_active
       FROM items i JOIN users u ON u.id = i.owner_id
      WHERE i.id = $1 AND u.deleted_at IS NULL`,
    [item_id]
  );
  const item = rows[0];
  if (!item) throw notFound('Item not found');

  // Rule 1
  if (item.owner_id === user.id) throw forbidden('You cannot borrow your own item');
  // Rule 5
  if (!item.is_active || !item.owner_active) throw conflict('This item is not available for borrowing right now');

  // Rules 2 + 3
  assertValidRange(start_date, end_date, item.max_days, await getToday());

  // Rule 4
  if (await hasOverlap({ query }, item.id, start_date, end_date)) {
    throw conflict('These dates are already booked for this item. Please choose different dates.');
  }

  // Rule 6
  const open = await query(
    'SELECT COUNT(*) AS n FROM bookings WHERE borrower_id = $1 AND status = ANY($2::text[])',
    [user.id, OPEN_STATUSES]
  );
  if (open.rows[0].n >= MAX_OPEN_BOOKINGS) {
    throw conflict(`You already have ${MAX_OPEN_BOOKINGS} open bookings. Finish or cancel one first.`);
  }

  const ins = await query(
    `INSERT INTO bookings (item_id, borrower_id, start_date, end_date, status, message)
     VALUES ($1, $2, $3, $4, 'REQUESTED', $5) RETURNING id`,
    [item.id, user.id, start_date, end_date, message || null]
  );
  return fetchBooking({ query }, ins.rows[0].id);
}

/* ----------------------------- edit / delete ----------------------------- */

async function updateBooking(user, id, body) {
  const booking = await fetchBooking({ query }, id);
  if (!booking) throw notFound('Booking not found');
  if (booking.borrower_id !== user.id) throw forbidden('Only the borrower can edit this booking'); // rule 13-style ownership
  if (booking.status !== 'REQUESTED') throw conflict('A booking can only be edited while it is REQUESTED'); // rule 12

  const start = body.start_date || booking.start_date;
  const end = body.end_date || booking.end_date;
  const datesChanged = start !== booking.start_date || end !== booking.end_date;

  if (datesChanged) {
    assertValidRange(start, end, booking.item_max_days, await getToday());
    if (await hasOverlap({ query }, booking.item_id, start, end, booking.id)) {
      throw conflict('These dates are already booked for this item. Please choose different dates.');
    }
  }

  const message = body.message !== undefined ? body.message || null : booking.message;
  await query(
    `UPDATE bookings SET start_date = $1, end_date = $2, message = $3, updated_at = NOW() WHERE id = $4`,
    [start, end, message, id]
  );
  return fetchBooking({ query }, id);
}

async function deleteBooking(user, id) {
  const booking = await fetchBooking({ query }, id);
  if (!booking) throw notFound('Booking not found');
  if (booking.borrower_id !== user.id && user.role !== 'admin') {
    throw forbidden('Only the borrower (or an admin) can delete this booking');
  }
  if (!['REJECTED', 'CANCELLED'].includes(booking.status)) {
    throw conflict('Only REJECTED or CANCELLED bookings can be deleted'); // rule 12
  }
  await query('DELETE FROM bookings WHERE id = $1', [id]);
}

/* ----------------------------- status machine ----------------------------- */

/**
 * action: approve | reject | cancel | pickup | return
 * payload: { note, reason, condition }
 * Everything runs in ONE transaction; approve additionally row-locks the item.
 */
async function changeStatus(user, id, action, payload = {}) {
  const rule = TRANSITIONS[action];
  if (!rule) throw badRequest('action must be one of: approve, reject, cancel, pickup, return');

  return withTransaction(async (client) => {
    // 1. find the booking (no lock yet) so we know which item to lock
    const first = await client.query('SELECT item_id FROM bookings WHERE id = $1', [id]);
    if (!first.rows[0]) throw notFound('Booking not found');

    // 2. approving? lock the item row FIRST so two approvals on one item are serialised
    if (action === 'approve') {
      await client.query('SELECT id FROM items WHERE id = $1 FOR UPDATE', [first.rows[0].item_id]);
    }

    // 3. lock the booking row and read its current state
    const locked = await client.query(
      `SELECT b.*, i.owner_id, i.condition AS item_condition
         FROM bookings b JOIN items i ON i.id = b.item_id
        WHERE b.id = $1 FOR UPDATE OF b`,
      [id]
    );
    const booking = locked.rows[0];

    // Rule 7 - who may do what
    const allowed = rule.actor === 'owner' ? booking.owner_id === user.id : booking.borrower_id === user.id;
    if (!allowed) {
      throw forbidden(
        rule.actor === 'owner'
          ? 'Only the item owner can perform this action'
          : 'Only the borrower can perform this action'
      );
    }

    // Rule 8 - only the transitions listed in Section 06
    if (!rule.from.includes(booking.status)) {
      throw conflict(`Cannot ${action} a booking that is ${booking.status}`);
    }

    let autoRejected = [];

    switch (action) {
      case 'approve': {
        // Rule 9 - re-check overlap inside the transaction, after the lock
        if (await hasOverlap(client, booking.item_id, booking.start_date, booking.end_date, booking.id)) {
          throw conflict('These dates overlap with another approved booking for this item');
        }
        await client.query(`UPDATE bookings SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`, [id]);
        const rejected = await client.query(
          `UPDATE bookings
              SET status = 'REJECTED',
                  reject_reason = 'Automatically rejected: these dates were approved for another request',
                  updated_at = NOW()
            WHERE item_id = $1 AND id <> $2 AND status = 'REQUESTED'
              AND start_date <= $4 AND end_date >= $3
          RETURNING id`,
          [booking.item_id, id, booking.start_date, booking.end_date]
        );
        autoRejected = rejected.rows.map((r) => r.id);
        break;
      }
      case 'reject':
        await client.query(
          `UPDATE bookings SET status = 'REJECTED', reject_reason = $2, updated_at = NOW() WHERE id = $1`,
          [id, payload.reason || null]
        );
        break;
      case 'cancel':
        await client.query(`UPDATE bookings SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [id]);
        break;
      case 'pickup':
      case 'return': {
        const stage = action === 'pickup' ? 'handover' : 'return';
        await client.query(`UPDATE bookings SET status = $2, updated_at = NOW() WHERE id = $1`, [id, rule.to]);
        await client.query(
          `INSERT INTO condition_logs (booking_id, stage, condition, note, logged_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, stage, payload.condition || booking.item_condition, payload.note || null, user.id]
        );
        break;
      }
      default:
        throw badRequest('Unknown action');
    }

    const updated = await fetchBooking(client, id);
    return { booking: updated, auto_rejected: autoRejected };
  });
}

module.exports = {
  OPEN_STATUSES,
  TRANSITIONS,
  daysInclusive,
  hasOverlap,
  listMine,
  listIncoming,
  getDetail,
  createBooking,
  updateBooking,
  deleteBooking,
  changeStatus,
};
