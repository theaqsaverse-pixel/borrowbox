const { query } = require('../config/db');
const { notFound, conflict } = require('../utils/ApiError');
const { asyncHandler, send, toId } = require('../utils/helpers');

/** GET /api/categories (public) - includes how many items use each category */
const list = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, COUNT(i.id) AS item_count
       FROM categories c LEFT JOIN items i ON i.category_id = c.id
      GROUP BY c.id ORDER BY c.name`
  );
  return send(res, rows);
});

/** POST /api/categories (admin) */
const create = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const dup = await query('SELECT 1 FROM categories WHERE LOWER(name) = LOWER($1)', [name]);
  if (dup.rowCount) throw conflict('A category with this name already exists');
  const { rows } = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id, name', [name]);
  return send(res, { ...rows[0], item_count: 0 }, 'Category added', 201);
});

/** PUT /api/categories/:id (admin) - rename */
const rename = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Category not found');
  const { name } = req.body;

  const dup = await query('SELECT 1 FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2', [name, id]);
  if (dup.rowCount) throw conflict('A category with this name already exists');

  const { rows } = await query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name', [name, id]);
  if (!rows[0]) throw notFound('Category not found');
  return send(res, rows[0], 'Category renamed');
});

/** DELETE /api/categories/:id (admin) - 409 when any item uses it */
const remove = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Category not found');

  const exists = await query('SELECT 1 FROM categories WHERE id = $1', [id]);
  if (!exists.rowCount) throw notFound('Category not found');

  const used = await query('SELECT COUNT(*) AS n FROM items WHERE category_id = $1', [id]);
  if (used.rows[0].n > 0) {
    throw conflict(`This category is used by ${used.rows[0].n} item(s) and cannot be deleted`);
  }
  await query('DELETE FROM categories WHERE id = $1', [id]);
  return send(res, null, 'Category deleted');
});

module.exports = { list, create, rename, remove };
