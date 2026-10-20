const { query } = require('../config/db');
const { forbidden, notFound, conflict } = require('../utils/ApiError');
const { asyncHandler, send, toId } = require('../utils/helpers');

const REVIEW_SELECT = `
  SELECT r.id, r.booking_id, r.reviewer_id, r.reviewee_id, r.rating, r.comment, r.created_at,
         ru.name AS reviewer_name, eu.name AS reviewee_name
    FROM reviews r
    JOIN users ru ON ru.id = r.reviewer_id
    JOIN users eu ON eu.id = r.reviewee_id`;

/** POST /api/bookings/:id/reviews - rating 1-5 after RETURNED, one per person per booking */
const create = asyncHandler(async (req, res) => {
  const bookingId = toId(req.params.id);
  if (!bookingId) throw notFound('Booking not found');

  const { rows } = await query(
    `SELECT b.id, b.status, b.borrower_id, i.owner_id
       FROM bookings b JOIN items i ON i.id = b.item_id WHERE b.id = $1`,
    [bookingId]
  );
  const booking = rows[0];
  if (!booking) throw notFound('Booking not found');

  const isBorrower = booking.borrower_id === req.user.id;
  const isOwner = booking.owner_id === req.user.id;
  if (!isBorrower && !isOwner) throw forbidden('Only the borrower or the item owner can review this booking');

  if (booking.status !== 'RETURNED') throw conflict('Reviews are only possible after the item has been RETURNED');

  const revieweeId = isBorrower ? booking.owner_id : booking.borrower_id;

  let inserted;
  try {
    inserted = await query(
      `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [bookingId, req.user.id, revieweeId, req.body.rating, req.body.comment || null]
    );
  } catch (err) {
    if (err.code === '23505') throw conflict('You have already reviewed this booking'); // UNIQUE (booking_id, reviewer_id)
    throw err;
  }

  const review = await query(`${REVIEW_SELECT} WHERE r.id = $1`, [inserted.rows[0].id]);
  return send(res, review.rows[0], 'Review submitted', 201);
});

/** PUT /api/reviews/:id - only the author */
const update = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Review not found');

  const found = await query('SELECT * FROM reviews WHERE id = $1', [id]);
  const review = found.rows[0];
  if (!review) throw notFound('Review not found');
  if (review.reviewer_id !== req.user.id) throw forbidden('You can only edit your own review');

  const rating = req.body.rating ?? review.rating;
  const comment = req.body.comment !== undefined ? req.body.comment || null : review.comment;

  await query('UPDATE reviews SET rating = $1, comment = $2 WHERE id = $3', [rating, comment, id]);
  const updated = await query(`${REVIEW_SELECT} WHERE r.id = $1`, [id]);
  return send(res, updated.rows[0], 'Review updated');
});

/** DELETE /api/reviews/:id - author or admin */
const remove = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw notFound('Review not found');

  const found = await query('SELECT reviewer_id FROM reviews WHERE id = $1', [id]);
  const review = found.rows[0];
  if (!review) throw notFound('Review not found');
  if (review.reviewer_id !== req.user.id && req.user.role !== 'admin') {
    throw forbidden('You can only delete your own review');
  }

  await query('DELETE FROM reviews WHERE id = $1', [id]);
  return send(res, null, 'Review deleted');
});

module.exports = { create, update, remove };
