import axios from 'axios';

export const TOKEN_KEY = 'borrowbox_token';

// ONE axios instance for the whole app.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
});

// Request interceptor: attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: an expired / invalid token logs the user out everywhere.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = !!localStorage.getItem(TOKEN_KEY);
    const url = error.config?.url || '';
    const isAuthForm = url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && hadToken && !isAuthForm) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('borrowbox:unauthorized'));
    }
    return Promise.reject(error);
  }
);

/** Turn any axios error into a human readable message. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'Cannot reach the server. Is the API running?';
  }
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return fallback;
}

/** Field level errors from the API ({ field: message }) if present. */
export const getFieldErrors = (error) => error?.response?.data?.errors || {};

export default api;
