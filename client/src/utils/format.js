export const STATUS_LIST = ['REQUESTED', 'APPROVED', 'PICKED_UP', 'RETURNED', 'REJECTED', 'CANCELLED'];

export const STATUS_LABELS = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  PICKED_UP: 'Picked up',
  RETURNED: 'Returned',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' -> '24 Sep 2026' (string maths only, no timezone surprises) */
export function formatDate(value) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(value);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** '24 Sep' (no year) */
export function formatShort(value) {
  const full = formatDate(value);
  return full ? full.replace(/ \d{4}$/, '') : '';
}

export function formatRange(start, end) {
  if (!start || !end) return '';
  return start === end ? formatDate(start) : `${formatDate(start)} - ${formatDate(end)}`;
}

/** ISO timestamp -> '24 Sep 2026, 14:05' in the viewer's local time */
export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

export function formatMonthYear(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---------- 'YYYY-MM-DD' helpers (string based) ---------- */

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-based

export function todayISO() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(start, end) {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

/** Uploaded images are served by the API under /uploads */
export function imageSrc(url) {
  if (!url) return null;
  return url.startsWith('/uploads') ? `${API_ORIGIN}${url}` : url;
}

export const CATEGORY_ICONS = {
  'Power Tools': '🔧',
  'Home & Garden': '🪜',
  Electronics: '📷',
  Kitchen: '🍳',
  'Sports & Outdoor': '⛺',
};
export const categoryIcon = (name) => CATEGORY_ICONS[name] || '📦';

const TILE_COLORS = ['#012894', '#0E9F9A', '#5B4BC4', '#1E8FD5', '#2E8B57', '#B5479A'];
export const tileColor = (id = 0) => TILE_COLORS[Math.abs(Number(id)) % TILE_COLORS.length];
