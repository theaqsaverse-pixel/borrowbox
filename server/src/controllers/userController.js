const { query } = require('../config/db');
const { notFound, conflict } = require('../utils/ApiError');
const { asyncHandler, send, toId } = require('../utils/helpers');
const { OPEN_STATUSES } = require('../services/bookingService');

/** PUT /api/users/me - update name, phone, area */
const updateMe = asyncHandler(async (req, res) => {
  const current = req.user;
  const name = req.body.name !== undefined ? req.body.name : current.name;
  const phone = req.body.phone !== undefined ? req.body.phone || null : current.phone;
  const area = req.body.area !== undefined ? req.body.area || null : current.area;

  const { rows } = await query(
    `UPDATE users SET name = $1, phone = $2, area = $3 WHERE id = $4
     RETURNING id, name, email, phone, area, role, is_active, created_at`,
    [name, phone, area, current.id]
  );
  return send(res, { user: rows[0] }, 'Profile updated');
});

/** DELETE /api/users/me - soft delete, blocked while any booking is open */
const deleteMe = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT COUNT(*) AS n
       FROM bookings b JOIN items i ON i.id = b.item_id
      WHERE (b.borrower_id = $1 OR i.owner_id = $1)
        AND b.status = ANY($2::text[])`,
    [req.user.id, OPEN_STATUSES]
  );
  if (rows[0].n > 0) {
    throw conflict(
      'You still have open bookings (requested, approved or picked up). Finish or cancel them before deleting your account.'
    );
  }

  // Soft delete: keep the row so booking / review history stays intact.
  await query('UPDATE users SET is_active = FALSE, deleted_at = NOW() WHERE id = $1', [req.user.id]);
  await query('UPDATE items SET is_active = FALSE WHERE owner_id = $1', [req.user.id]);
  return send(res, null, 'Your account has been deleted');
});

/** GET /api/users/:id - public profile with trust score and reviews */
const getPublicProfile = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('User not found');

  const { rows } = await query(
    `SELECT u.id, u.name, u.area, u.role, u.is_active, u.created_at,
            (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE reviewee_id = u.id) AS trust_score,
            (SELECT COUNT(*) FROM reviews WHERE reviewee_id = u.id)                        AS review_count,
            (SELECT COUNT(*) FROM items WHERE owner_id = u.id AND is_active)               AS active_items
       FROM users u
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw notFound('User not found');

  const reviews = await query(
    `SELECT r.id, r.booking_id, r.reviewer_id, ru.name AS reviewer_name, r.rating, r.comment, r.created_at,
            i.id AS item_id, i.title AS item_title
       FROM reviews r
       JOIN users ru   ON ru.id = r.reviewer_id
       JOIN bookings b ON b.id  = r.booking_id
       JOIN items i    ON i.id  = b.item_id
      WHERE r.reviewee_id = $1
      ORDER BY r.created_at DESC, r.id DESC`,
    [id]
  );

  return send(res, { ...rows[0], reviews: reviews.rows });
});

module.exports = { updateMe, deleteMe, getPublicProfile };
