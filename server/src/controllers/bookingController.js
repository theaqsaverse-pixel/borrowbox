const { badRequest, notFound } = require('../utils/ApiError');
const { asyncHandler, send, toId } = require('../utils/helpers');
const service = require('../services/bookingService');

const STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PICKED_UP', 'RETURNED'];

const idOr404 = (value) => {
  const id = toId(value);
  if (!id) throw notFound('Booking not found');
  return id;
};

const statusFilter = (req) => {
  const s = req.query.status ? String(req.query.status).toUpperCase() : null;
  if (s && !STATUSES.includes(s)) throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
  return s;
};

/** POST /api/bookings */
const create = asyncHandler(async (req, res) => {
  const booking = await service.createBooking(req.user, req.body);
  return send(res, booking, 'Borrow request sent', 201);
});

/** GET /api/bookings/mine */
const mine = asyncHandler(async (req, res) =>
  send(res, await service.listMine(req.user.id, statusFilter(req)))
);

/** GET /api/bookings/incoming */
const incoming = asyncHandler(async (req, res) =>
  send(res, await service.listIncoming(req.user.id, statusFilter(req)))
);

/** GET /api/bookings/:id */
const getOne = asyncHandler(async (req, res) =>
  send(res, await service.getDetail(idOr404(req.params.id), req.user))
);

/** PUT /api/bookings/:id */
const update = asyncHandler(async (req, res) => {
  const booking = await service.updateBooking(req.user, idOr404(req.params.id), req.body);
  return send(res, booking, 'Booking updated');
});

/** DELETE /api/bookings/:id */
const remove = asyncHandler(async (req, res) => {
  await service.deleteBooking(req.user, idOr404(req.params.id));
  return send(res, null, 'Booking removed');
});

const ACTION_MESSAGES = {
  approve: 'Booking approved',
  reject: 'Booking rejected',
  cancel: 'Booking cancelled',
  pickup: 'Marked as picked up',
  return: 'Marked as returned',
};

/** PATCH /api/bookings/:id/status  body: { action, note, reason, condition } */
const changeStatus = asyncHandler(async (req, res) => {
  const { action, note, reason, condition } = req.body;
  const result = await service.changeStatus(req.user, idOr404(req.params.id), action, {
    note,
    reason: reason || (action === 'reject' ? note : undefined),
    condition,
  });
  const extra =
    result.auto_rejected.length > 0
      ? ` (${result.auto_rejected.length} clashing request(s) were automatically rejected)`
      : '';
  return send(res, result, ACTION_MESSAGES[action] + extra);
});

module.exports = { create, mine, incoming, getOne, update, remove, changeStatus };
