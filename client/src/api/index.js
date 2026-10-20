import api from './axios';

// Every helper returns the response BODY: { success, data, message, meta? }
const unwrap = (promise) => promise.then((res) => res.data);

export const authApi = {
  register: (payload) => unwrap(api.post('/auth/register', payload)),
  login: (payload) => unwrap(api.post('/auth/login', payload)),
  me: () => unwrap(api.get('/auth/me')),
};

export const usersApi = {
  get: (id) => unwrap(api.get(`/users/${id}`)),
  updateMe: (payload) => unwrap(api.put('/users/me', payload)),
  deleteMe: () => unwrap(api.delete('/users/me')),
};

export const categoriesApi = {
  list: () => unwrap(api.get('/categories')),
  create: (name) => unwrap(api.post('/categories', { name })),
  rename: (id, name) => unwrap(api.put(`/categories/${id}`, { name })),
  remove: (id) => unwrap(api.delete(`/categories/${id}`)),
};

export const itemsApi = {
  list: (params) => unwrap(api.get('/items', { params })),
  mine: () => unwrap(api.get('/items/mine')),
  get: (id) => unwrap(api.get(`/items/${id}`)),
  availability: (id) => unwrap(api.get(`/items/${id}/availability`)),
  create: (payload) => unwrap(api.post('/items', payload)), // JSON or FormData
  update: (id, payload) => unwrap(api.put(`/items/${id}`, payload)), // JSON or FormData
  remove: (id) => unwrap(api.delete(`/items/${id}`)),
};

export const bookingsApi = {
  create: (payload) => unwrap(api.post('/bookings', payload)),
  mine: () => unwrap(api.get('/bookings/mine')),
  incoming: () => unwrap(api.get('/bookings/incoming')),
  get: (id) => unwrap(api.get(`/bookings/${id}`)),
  update: (id, payload) => unwrap(api.put(`/bookings/${id}`, payload)),
  remove: (id) => unwrap(api.delete(`/bookings/${id}`)),
  // action: approve | reject | cancel | pickup | return
  setStatus: (id, payload) => unwrap(api.patch(`/bookings/${id}/status`, payload)),
};

export const reviewsApi = {
  create: (bookingId, payload) => unwrap(api.post(`/bookings/${bookingId}/reviews`, payload)),
  update: (id, payload) => unwrap(api.put(`/reviews/${id}`, payload)),
  remove: (id) => unwrap(api.delete(`/reviews/${id}`)),
};

export const adminApi = {
  stats: () => unwrap(api.get('/admin/stats')),
  users: (search) => unwrap(api.get('/admin/users', { params: search ? { search } : {} })),
  items: () => unwrap(api.get('/admin/items')),
  setUserStatus: (id, is_active) => unwrap(api.patch(`/admin/users/${id}/status`, { is_active })),
};
