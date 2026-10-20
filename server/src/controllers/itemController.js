const { query } = require('../config/db');
const { badRequest, forbidden, notFound, conflict } = require('../utils/ApiError');
const { asyncHandler, send, toId } = require('../utils/helpers');
const { removeUploadedFile } = require('../middleware/upload');
const { OPEN_STATUSES } = require('../services/bookingService');
const { isValidDate } = require('../middleware/validate');

// Whitelisted sort options (fixed SQL - user input never reaches ORDER BY).
const SORTS = {
  newest: 'i.created_at DESC, i.id DESC',
  oldest: 'i.created_at ASC, i.id ASC',
  title: 'LOWER(i.title) ASC, i.id ASC',
  rating: 'owner_rating DESC NULLS LAST, i.id DESC',
};

const ITEM_LIST_SELECT = `
  SELECT i.id, i.owner_id, i.category_id, i.title, i.description, i.condition, i.max_days,
         i.pickup_area, i.image_url, i.is_active, i.created_at,
         c.name AS category_name, u.name AS owner_name,
         (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE reviewee_id = i.owner_id) AS owner_rating,
         (SELECT COUNT(*) FROM reviews WHERE reviewee_id = i.owner_id)                        AS owner_review_count
    FROM items i
    JOIN categories c ON c.id = i.category_id
    JOIN users u      ON u.id = i.owner_id`;

const escapeLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** GET /api/items?search=&category=&condition=&from=&to=&sort=&page=&limit= */
const list = asyncHandler(async (req, res) => {
  const { search, category, condition, sort } = req.query;
  let { from, to } = req.query;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

  const where = ['i.is_active = TRUE', 'u.is_active = TRUE'];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (search && String(search).trim()) {
    const p = add(`%${escapeLike(String(search).trim())}%`);
    where.push(`(i.title ILIKE ${p} OR i.description ILIKE ${p})`);
  }

  if (category) {
    const ids = String(category).split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length) where.push(`i.category_id = ANY(${add(ids)}::int[])`);
  }

  if (condition) {
    if (!['new', 'good', 'fair'].includes(condition)) throw badRequest('condition must be new, good or fair');
    where.push(`i.condition = ${add(condition)}`);
  }

  // "Available between dates" - only items with NO approved / picked-up booking in the range.
  if (from || to) {
    from = from || to;
    to = to || from;
    if (!isValidDate(from) || !isValidDate(to)) throw badRequest('from and to must be valid dates (YYYY-MM-DD)');
    if (to < from) throw badRequest('to must be on or after from');
    const pFrom = add(from);
    const pTo = add(to);
    where.push(`NOT EXISTS (
      SELECT 1 FROM bookings b
       WHERE b.item_id = i.id
         AND b.status IN ('APPROVED', 'PICKED_UP')
         AND b.start_date <= ${pTo}::date
         AND b.end_date   >= ${pFrom}::date)`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderSql = SORTS[sort] || SORTS.newest;

  const countRes = await query(
    `SELECT COUNT(*) AS n FROM items i JOIN users u ON u.id = i.owner_id ${whereSql}`,
    params
  );
  const total = countRes.rows[0].n;

  const pLimit = add(limit);
  const pOffset = add((page - 1) * limit);
  const { rows } = await query(
    `${ITEM_LIST_SELECT} ${whereSql} ORDER BY ${orderSql} LIMIT ${pLimit} OFFSET ${pOffset}`,
    params
  );

  return send(res, rows, 'OK', 200, { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });
});

/** GET /api/items/mine - items listed by me (with booking counters) */
const mine = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.owner_id, i.category_id, i.title, i.description, i.condition, i.max_days,
            i.pickup_area, i.image_url, i.is_active, i.created_at, c.name AS category_name,
            (SELECT COUNT(*) FROM bookings b WHERE b.item_id = i.id)                          AS booking_count,
            (SELECT COUNT(*) FROM bookings b WHERE b.item_id = i.id AND b.status = ANY($2::text[])) AS open_booking_count
       FROM items i JOIN categories c ON c.id = i.category_id
      WHERE i.owner_id = $1
      ORDER BY i.created_at DESC, i.id DESC`,
    [req.user.id, OPEN_STATUSES]
  );
  return send(res, rows);
});

/** GET /api/items/:id - details with owner info, rating and reviews */
const getOne = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Item not found');

  const { rows } = await query(`${ITEM_LIST_SELECT} WHERE i.id = $1`, [id]);
  const item = rows[0];
  if (!item) throw notFound('Item not found');

  // Inactive items are only visible to their owner and admins.
  const isPrivileged = req.user && (req.user.id === item.owner_id || req.user.role === 'admin');
  if (!item.is_active && !isPrivileged) throw notFound('Item not found');

  const [owner, ratings, reviews] = await Promise.all([
    query('SELECT id, name, area, created_at FROM users WHERE id = $1', [item.owner_id]),
    // item rating = ratings borrowers gave the owner for loans of THIS item
    query(
      `SELECT ROUND(AVG(r.rating)::numeric, 1) AS item_rating, COUNT(*) AS item_review_count
         FROM reviews r JOIN bookings b ON b.id = r.booking_id
        WHERE b.item_id = $1 AND r.reviewee_id = $2`,
      [id, item.owner_id]
    ),
    query(
      `SELECT r.id, r.booking_id, r.reviewer_id, ru.name AS reviewer_name, r.rating, r.comment, r.created_at
         FROM reviews r
         JOIN bookings b ON b.id = r.booking_id
         JOIN users ru   ON ru.id = r.reviewer_id
        WHERE b.item_id = $1 AND r.reviewee_id = $2
        ORDER BY r.created_at DESC, r.id DESC`,
      [id, item.owner_id]
    ),
  ]);

  return send(res, {
    ...item,
    owner: {
      ...owner.rows[0],
      trust_score: item.owner_rating,
      review_count: item.owner_review_count,
    },
    item_rating: ratings.rows[0].item_rating,
    item_review_count: ratings.rows[0].item_review_count,
    reviews: reviews.rows,
  });
});

/** GET /api/items/:id/availability - booked date ranges (APPROVED / PICKED_UP, not yet finished) */
const availability = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Item not found');
  const exists = await query('SELECT 1 FROM items WHERE id = $1', [id]);
  if (!exists.rowCount) throw notFound('Item not found');

  const { rows } = await query(
    `SELECT start_date, end_date, status
       FROM bookings
      WHERE item_id = $1 AND status IN ('APPROVED', 'PICKED_UP') AND end_date >= CURRENT_DATE
      ORDER BY start_date`,
    [id]
  );
  return send(res, rows);
});

async function assertCategoryExists(categoryId) {
  const ok = await query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
  if (!ok.rowCount) throw badRequest('Selected category does not exist', { category_id: 'Invalid category' });
}

/** POST /api/items (multipart or JSON; optional file field "image") */
const create = asyncHandler(async (req, res) => {
  const b = req.body;
  await assertCategoryExists(b.category_id);

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : b.image_url || null;
  const { rows } = await query(
    `INSERT INTO items (owner_id, category_id, title, description, condition, max_days, pickup_area, image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      req.user.id,
      b.category_id,
      b.title,
      b.description || null,
      b.condition || 'good',
      b.max_days,
      b.pickup_area || null,
      imageUrl,
      b.is_active === undefined ? true : b.is_active,
    ]
  );
  const created = await query(`${ITEM_LIST_SELECT} WHERE i.id = $1`, [rows[0].id]);
  return send(res, created.rows[0], 'Item added', 201);
});

/** PUT /api/items/:id - owner edits details / activates / deactivates */
const update = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Item not found');

  const found = await query('SELECT * FROM items WHERE id = $1', [id]);
  const item = found.rows[0];
  if (!item) throw notFound('Item not found');
  if (item.owner_id !== req.user.id) throw forbidden('Only the owner can edit this item');

  const b = req.body;
  if (b.category_id !== undefined) await assertCategoryExists(b.category_id);

  let imageUrl = item.image_url;
  if (req.file) imageUrl = `/uploads/${req.file.filename}`;
  else if (b.image_url !== undefined) imageUrl = b.image_url || null;

  const merged = {
    category_id: b.category_id ?? item.category_id,
    title: b.title ?? item.title,
    description: b.description !== undefined ? b.description || null : item.description,
    condition: b.condition ?? item.condition,
    max_days: b.max_days ?? item.max_days,
    pickup_area: b.pickup_area !== undefined ? b.pickup_area || null : item.pickup_area,
    image_url: imageUrl,
    is_active: b.is_active ?? item.is_active,
  };

  await query(
    `UPDATE items SET category_id = $1, title = $2, description = $3, condition = $4, max_days = $5,
                      pickup_area = $6, image_url = $7, is_active = $8
      WHERE id = $9`,
    [
      merged.category_id,
      merged.title,
      merged.description,
      merged.condition,
      merged.max_days,
      merged.pickup_area,
      merged.image_url,
      merged.is_active,
      id,
    ]
  );

  // The old uploaded file is no longer referenced - remove it.
  if (merged.image_url !== item.image_url) removeUploadedFile(item.image_url);

  const updated = await query(`${ITEM_LIST_SELECT} WHERE i.id = $1`, [id]);
  return send(res, updated.rows[0], 'Item updated');
});

/**
 * DELETE /api/items/:id (owner or admin)
 *  - open bookings          -> 409
 *  - never had a booking    -> hard delete
 *  - has booking history    -> deactivate instead (keeps history intact)
 */
const remove = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Item not found');

  const found = await query('SELECT * FROM items WHERE id = $1', [id]);
  const item = found.rows[0];
  if (!item) throw notFound('Item not found');
  if (item.owner_id !== req.user.id && req.user.role !== 'admin') {
    throw forbidden('Only the owner (or an admin) can delete this item');
  }

  const counts = await query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = ANY($2::text[])) AS open
       FROM bookings WHERE item_id = $1`,
    [id, OPEN_STATUSES]
  );
  const { total, open } = counts.rows[0];

  if (open > 0) {
    throw conflict(`This item has ${open} open booking(s). Finish or cancel them first.`);
  }

  if (total === 0) {
    await query('DELETE FROM items WHERE id = $1', [id]);
    removeUploadedFile(item.image_url);
    return send(res, { action: 'deleted' }, 'Item deleted');
  }

  await query('UPDATE items SET is_active = FALSE WHERE id = $1', [id]);
  return send(
    res,
    { action: 'deactivated' },
    'This item has booking history, so it was deactivated instead of deleted'
  );
});

module.exports = { list, mine, getOne, availability, create, update, remove };
