const { query } = require('../config/db');
const { badRequest, notFound, conflict } = require('../utils/ApiError');
const { asyncHandler, send, toId } = require('../utils/helpers');

const BOOKING_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PICKED_UP', 'RETURNED'];

/** GET /api/admin/stats - totals of users, items and bookings by status */
const stats = asyncHandler(async (req, res) => {
  const [users, items, bookings, categories, reviews] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE is_active AND deleted_at IS NULL) AS active
         FROM users`
    ),
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM items`),
    query(`SELECT status, COUNT(*) AS n FROM bookings GROUP BY status`),
    query('SELECT COUNT(*) AS n FROM categories'),
    query('SELECT COUNT(*) AS n FROM reviews'),
  ]);

  const byStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0]));
  let totalBookings = 0;
  for (const row of bookings.rows) {
    byStatus[row.status] = row.n;
    totalBookings += row.n;
  }

  return send(res, {
    users: users.rows[0],
    items: items.rows[0],
    bookings: { total: totalBookings, by_status: byStatus },
    categories: categories.rows[0].n,
    reviews: reviews.rows[0].n,
  });
});

/** GET /api/admin/users?search= */
const listUsers = asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.search && String(req.query.search).trim()) {
    params.push(`%${String(req.query.search).trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where = 'WHERE u.name ILIKE $1 OR u.email ILIKE $1';
  }
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.area, u.role, u.is_active, u.deleted_at, u.created_at,
            (SELECT COUNT(*) FROM items WHERE owner_id = u.id)        AS item_count,
            (SELECT COUNT(*) FROM bookings WHERE borrower_id = u.id)  AS borrowing_count,
            (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE reviewee_id = u.id) AS trust_score
       FROM users u ${where}
      ORDER BY u.created_at DESC, u.id DESC`,
    params
  );
  return send(res, rows);
});

/** PATCH /api/admin/users/:id/status  body: { is_active } */
const setUserStatus = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('User not found');

  const { is_active } = req.body;
  if (id === req.user.id) throw badRequest('You cannot change your own status');

  const found = await query('SELECT id, deleted_at FROM users WHERE id = $1', [id]);
  if (!found.rows[0]) throw notFound('User not found');
  if (found.rows[0].deleted_at) throw conflict('This user deleted their own account and cannot be reactivated');

  const { rows } = await query(
    `UPDATE users SET is_active = $1 WHERE id = $2
     RETURNING id, name, email, phone, area, role, is_active, created_at`,
    [is_active, id]
  );
  return send(res, rows[0], is_active ? 'User activated' : 'User deactivated');
});

/** GET /api/admin/items - every item (incl. inactive) so admins can remove inappropriate ones */
const listItems = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.title, i.condition, i.max_days, i.is_active, i.image_url, i.created_at,
            c.name AS category_name, u.id AS owner_id, u.name AS owner_name,
            (SELECT COUNT(*) FROM bookings b WHERE b.item_id = i.id) AS booking_count,
            (SELECT COUNT(*) FROM bookings b WHERE b.item_id = i.id
                AND b.status IN ('REQUESTED','APPROVED','PICKED_UP')) AS open_booking_count
       FROM items i JOIN categories c ON c.id = i.category_id JOIN users u ON u.id = i.owner_id
      ORDER BY i.created_at DESC, i.id DESC`
  );
  return send(res, rows);
});

module.exports = { stats, listUsers, setUserStatus, listItems };
