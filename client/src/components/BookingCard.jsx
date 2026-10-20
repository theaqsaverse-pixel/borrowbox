import { Link } from 'react-router-dom';
import ItemImage from './ItemImage';
import StatusBadge from './StatusBadge';
import { formatRange, plural } from '../utils/format';

/**
 * One booking row used on the dashboard.
 * `role` is "borrower" (My Borrowings) or "owner" (Incoming Requests).
 * `on(action, booking)` is called for every button.
 */
export default function BookingCard({ booking: b, role, on, busy }) {
  const isOwnerView = role === 'owner';
  const actions = [];

  if (isOwnerView) {
    if (b.status === 'REQUESTED') {
      actions.push(['approve', 'Approve', 'btn-success'], ['reject', 'Reject', 'btn-outline-danger']);
    }
    if (b.status === 'APPROVED') actions.push(['pickup', 'Mark picked up', 'btn-blue']);
    if (b.status === 'PICKED_UP') actions.push(['return', 'Mark returned', 'btn-blue']);
  } else {
    if (b.status === 'REQUESTED') actions.push(['edit', 'Edit', 'btn-outline']);
    if (['REQUESTED', 'APPROVED'].includes(b.status)) actions.push(['cancel', 'Cancel request', 'btn-outline-danger']);
    if (['REJECTED', 'CANCELLED'].includes(b.status)) actions.push(['delete', 'Remove', 'btn-outline-danger']);
  }
  if (b.status === 'RETURNED' && !b.reviewed_by_me) actions.push(['review', '★ Leave a review', 'btn-primary']);

  return (
    <article className="booking-card">
      <Link to={`/items/${b.item_id}`} aria-label={b.item_title}>
        <ItemImage item={{ id: b.item_id, image_url: b.item_image, category_name: b.category_name }} className="booking-thumb" tileClass="booking-tile" alt="" />
      </Link>

      <div className="booking-main">
        <h3><Link to={`/items/${b.item_id}`}>{b.item_title}</Link></h3>
        <div className="muted small">
          {isOwnerView ? (
            <>Requested by <Link to={`/profile/${b.borrower_id}`}>{b.borrower_name}</Link></>
          ) : (
            <>Owner: <Link to={`/profile/${b.owner_id}`}>{b.owner_name}</Link> · Pickup: {b.pickup_area || 'to be arranged'}</>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          <strong>{formatRange(b.start_date, b.end_date)}</strong> <span className="muted small">({plural(Number(b.days), 'day')})</span>
        </div>
        {b.message && <div className="quote">“{b.message}”</div>}
        {b.status === 'REJECTED' && b.reject_reason && <div className="quote" style={{ background: '#fdeeee' }}>Reason: {b.reject_reason}</div>}
        {b.is_overdue && (
          <div className="alert alert-error small" style={{ margin: '8px 0 0' }}>
            ⚠ Overdue - this item should have been returned on {formatRange(b.end_date, b.end_date)}.
          </div>
        )}

        <div className="booking-actions">
          {actions.map(([key, label, cls]) => (
            <button key={key} className={`btn btn-sm ${cls}`} disabled={busy} onClick={() => on(key, b)}>{label}</button>
          ))}
          <Link to={`/bookings/${b.id}`} className="btn btn-ghost btn-sm">Details</Link>
        </div>
      </div>

      <div className="booking-side">
        <StatusBadge status={b.status} overdue={b.is_overdue} />
        {b.status === 'RETURNED' && b.reviewed_by_me && <span className="pill pill-green">Reviewed ✓</span>}
      </div>
    </article>
  );
}
