import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { bookingsApi, reviewsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import { ErrorState } from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import ItemImage from '../components/ItemImage';
import ReviewList from '../components/ReviewList';
import ReviewModal from '../components/ReviewModal';
import ConfirmDialog from '../components/ConfirmDialog';
import BookingActionModal from '../components/BookingActionModal';
import EditBookingModal from '../components/EditBookingModal';
import { formatDateTime, formatRange, plural } from '../utils/format';

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [b, setB] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookingsApi.get(id);
      setB(res.data);
    } catch (err) {
      setError({ status: err.response?.status, message: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading && !b) return <Loader label="Loading booking..." />;
  if (error) return <div className="container page"><ErrorState message={error.message} onRetry={error.status === 404 || error.status === 403 ? undefined : load} /><p className="center"><Link to="/dashboard">Back to dashboard</Link></p></div>;

  const isOwner = user.id === b.owner_id;
  const isBorrower = user.id === b.borrower_id;
  const close = () => setModal(null);
  const done = () => { close(); load(); };

  const run = async (action, msg) => {
    setBusy(true);
    try {
      const res = await bookingsApi.setStatus(b.id, { action });
      toast.success(msg + (res.data.auto_rejected?.length ? ` (${res.data.auto_rejected.length} clashing request(s) auto-rejected)` : ''));
      close();
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
      close();
    } finally {
      setBusy(false);
    }
  };

  const removeReview = async () => {
    setBusy(true);
    try {
      await reviewsApi.remove(modal.review.id);
      toast.success('Review deleted');
      done();
    } catch (err) {
      toast.error(getErrorMessage(err));
      close();
    } finally {
      setBusy(false);
    }
  };

  const otherName = isOwner ? b.borrower_name : b.owner_name;
  const canReview = b.status === 'RETURNED' && !b.reviewed_by_me;

  return (
    <div className="container page">
      <Link to="/dashboard" className="back-link">← Back to dashboard</Link>

      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
          <Link to={`/items/${b.item_id}`}>
            <ItemImage item={{ id: b.item_id, image_url: b.item_image, category_name: b.category_name }} className="booking-thumb" tileClass="booking-tile" alt="" />
          </Link>
          <div className="grow">
            <h1 style={{ marginBottom: 4 }}>Booking #{b.id}</h1>
            <div><Link to={`/items/${b.item_id}`}><strong>{b.item_title}</strong></Link></div>
          </div>
          <StatusBadge status={b.status} overdue={b.is_overdue} />
        </div>

        {b.is_overdue && <div className="alert alert-error" style={{ marginTop: 14 }}>⚠ Overdue - the end date has passed and the item has not been marked as returned.</div>}

        <dl className="kv" style={{ marginTop: 18 }}>
          <dt>Dates</dt><dd>{formatRange(b.start_date, b.end_date)} ({plural(Number(b.days), 'day')})</dd>
          <dt>Owner</dt><dd><Link to={`/profile/${b.owner_id}`}>{b.owner_name}</Link>{b.owner_phone ? ` · ${b.owner_phone}` : ''}</dd>
          <dt>Borrower</dt><dd><Link to={`/profile/${b.borrower_id}`}>{b.borrower_name}</Link>{b.borrower_phone ? ` · ${b.borrower_phone}` : ''}</dd>
          <dt>Pickup area</dt><dd>{b.pickup_area || <span className="muted">To be arranged</span>}</dd>
          <dt>Message</dt><dd>{b.message || <span className="muted">-</span>}</dd>
          {b.reject_reason && (<><dt>Reject reason</dt><dd>{b.reject_reason}</dd></>)}
          <dt>Requested on</dt><dd>{formatDateTime(b.created_at)}</dd>
          <dt>Last update</dt><dd>{formatDateTime(b.updated_at)}</dd>
        </dl>
        {!b.owner_phone && !b.borrower_phone && ['REQUESTED'].includes(b.status) && (
          <p className="muted small">Contact numbers are shared once the owner approves the request.</p>
        )}

        <div className="booking-actions" style={{ marginTop: 18 }}>
          {isOwner && b.status === 'REQUESTED' && (
            <>
              <button className="btn btn-success" disabled={busy} onClick={() => run('approve', 'Booking approved')}>Approve</button>
              <button className="btn btn-outline-danger" onClick={() => setModal({ type: 'reject' })}>Reject</button>
            </>
          )}
          {isOwner && b.status === 'APPROVED' && <button className="btn btn-blue" onClick={() => setModal({ type: 'pickup' })}>Mark picked up</button>}
          {isOwner && b.status === 'PICKED_UP' && <button className="btn btn-blue" onClick={() => setModal({ type: 'return' })}>Mark returned</button>}
          {isBorrower && b.status === 'REQUESTED' && <button className="btn btn-outline" onClick={() => setModal({ type: 'edit' })}>Edit request</button>}
          {isBorrower && ['REQUESTED', 'APPROVED'].includes(b.status) && <button className="btn btn-outline-danger" onClick={() => setModal({ type: 'cancel' })}>Cancel request</button>}
          {canReview && <button className="btn btn-primary" onClick={() => setModal({ type: 'review' })}>★ Review {otherName}</button>}
        </div>
      </div>

      <div className="card">
        <h2>Condition log</h2>
        {b.condition_logs.length === 0 ? (
          <p className="muted">Nothing logged yet. The condition is recorded when the owner marks the item as picked up and again when it is returned.</p>
        ) : (
          <div className="timeline">
            {b.condition_logs.map((l) => (
              <div className="timeline-item" key={l.id}>
                <strong>{l.stage === 'handover' ? 'Handover (pickup)' : 'Return'}</strong>{' '}
                <span className="pill">{l.condition}</span>
                <div className="muted small">{formatDateTime(l.logged_at)} · logged by {l.logged_by_name}</div>
                <div>{l.note || <span className="muted">No note</span>}</div>
              </div>
            ))}
          </div>
        )}
        <p className="hint">Condition logs are an audit record - they are read-only and never deleted.</p>
      </div>

      {b.status === 'RETURNED' && (
        <div className="card">
          <h2>Reviews for this loan</h2>
          {b.reviews.length === 0 ? <p className="muted">No reviews yet.</p> : (
            <ReviewList
              reviews={b.reviews}
              canManage={(r) => r.reviewer_id === user.id || user.role === 'admin'}
              onEdit={(r) => (r.reviewer_id === user.id ? setModal({ type: 'editReview', review: r }) : toast.error('Only the author can edit a review'))}
              onDelete={(r) => setModal({ type: 'deleteReview', review: r })}
            />
          )}
        </div>
      )}

      {['reject', 'pickup', 'return'].includes(modal?.type) && <BookingActionModal action={modal.type} booking={b} onClose={close} onDone={done} />}
      {modal?.type === 'edit' && <EditBookingModal booking={b} onClose={close} onDone={done} />}
      {modal?.type === 'review' && <ReviewModal bookingId={b.id} who={otherName} onClose={close} onDone={done} />}
      {modal?.type === 'editReview' && <ReviewModal review={modal.review} who={modal.review.reviewee_name} onClose={close} onDone={done} />}
      {modal?.type === 'deleteReview' && <ConfirmDialog title="Delete review?" message="This review will be permanently removed." loading={busy} onConfirm={removeReview} onCancel={close} />}
      {modal?.type === 'cancel' && <ConfirmDialog title="Cancel this request?" message="The dates become free again for other borrowers." confirmText="Yes, cancel it" loading={busy} onConfirm={() => run('cancel', 'Request cancelled')} onCancel={close} />}
    </div>
  );
}
