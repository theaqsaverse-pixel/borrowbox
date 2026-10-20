import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { itemsApi, reviewsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import { ErrorState } from '../components/EmptyState';
import ItemImage from '../components/ItemImage';
import BookingForm from '../components/BookingForm';
import ConfirmDialog from '../components/ConfirmDialog';
import ReviewList from '../components/ReviewList';
import ReviewModal from '../components/ReviewModal';
import { RatingBadge } from '../components/StarRating';
import { formatMonthYear, plural } from '../utils/format';

export default function ItemDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [booked, setBooked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { status, message }
  const [editReview, setEditReview] = useState(null);
  const [deleteReview, setDeleteReview] = useState(null);
  const [deleteItem, setDeleteItem] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemRes, availRes] = await Promise.all([itemsApi.get(id), itemsApi.availability(id)]);
      setItem(itemRes.data);
      setBooked(availRes.data);
    } catch (err) {
      setError({ status: err.response?.status, message: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader label="Loading item..." />;
  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? (
          <div className="empty"><div className="icon">🧰</div><h3>Item not found</h3><p className="muted">It may have been removed or deactivated.</p><Link to="/" className="btn btn-primary">Back to browse</Link></div>
        ) : (
          <ErrorState message={error.message} onRetry={load} />
        )}
      </div>
    );
  }

  const isOwner = user?.id === item.owner_id;
  const canBook = item.is_active && !isOwner;

  const confirmDeleteReview = async () => {
    setBusy(true);
    try {
      await reviewsApi.remove(deleteReview.id);
      toast.success('Review deleted');
      setDeleteReview(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteItem = async () => {
    setBusy(true);
    try {
      const res = await itemsApi.remove(item.id);
      toast.success(res.message);
      if (res.data.action === 'deleted') navigate('/dashboard?tab=items');
      else { setDeleteItem(false); load(); }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteItem(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="crumbs">
        <Link to="/">Browse</Link> / <Link to={`/?category=${item.category_id}`}>{item.category_name}</Link> / {item.title}
      </div>

      <div className="detail-grid">
        <div>
          <ItemImage item={item} className="hero-img" tileClass="hero-tile" />

          <div className="row-between" style={{ marginTop: 18 }}>
            <h1 style={{ margin: 0 }}>{item.title}</h1>
            {!item.is_active && <span className="pill pill-red">Inactive</span>}
          </div>
          <div className="tags">
            <span className="pill pill-blue">{item.category_name}</span>
            <span className="pill">Condition: {item.condition}</span>
            <span className="pill">Max {plural(item.max_days, 'day')}</span>
            {item.pickup_area && <span className="pill pill-teal">Pickup: {item.pickup_area}</span>}
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{item.description || <span className="muted">No description provided.</span>}</p>

          <div className="owner-card">
            <span className="avatar avatar-lg" style={{ width: 54, height: 54, fontSize: '1.4rem' }}>{item.owner.name.charAt(0).toUpperCase()}</span>
            <div className="grow">
              <strong>{item.owner.name}</strong> <span className="muted small">· Item owner{item.owner.area ? ` | ${item.owner.area}` : ''}</span>
              <div><RatingBadge score={item.owner.trust_score} count={item.owner.review_count} /></div>
              <div className="muted small">Member since {formatMonthYear(item.owner.created_at)}</div>
            </div>
            <Link to={`/profile/${item.owner_id}`} className="btn btn-outline btn-sm">View profile</Link>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-title">
              <h3 style={{ margin: 0 }}>Reviews of this lender</h3>
              {item.item_review_count > 0 && <RatingBadge score={item.item_rating} count={item.item_review_count} />}
            </div>
            {item.reviews.length === 0 ? (
              <p className="muted">No one has reviewed this item yet. Reviews appear after a loan is returned.</p>
            ) : (
              <ReviewList
                reviews={item.reviews}
                canManage={(r) => user && (r.reviewer_id === user.id || isAdmin)}
                onEdit={(r) => (r.reviewer_id === user.id ? setEditReview(r) : toast.error('Only the author can edit a review'))}
                onDelete={setDeleteReview}
              />
            )}
          </div>
        </div>

        <aside className="card booking-panel">
          {isOwner || isAdmin ? (
            <div className="stack">
              <h3>{isOwner ? 'This is your item' : 'Admin controls'}</h3>
              {isOwner && <p className="muted small">Owners cannot borrow their own items.</p>}
              {isOwner && <Link to={`/items/${item.id}/edit`} className="btn btn-primary btn-block">Edit item</Link>}
              <button className="btn btn-outline-danger btn-block" onClick={() => setDeleteItem(true)}>
                {isOwner ? 'Delete item' : 'Remove item'}
              </button>
              {booked.length > 0 && (
                <div>
                  <span className="label">Booked dates</span>
                  <ul className="small" style={{ paddingLeft: 18, margin: '6px 0 0' }}>
                    {booked.map((b, i) => <li key={i}>{b.start_date} → {b.end_date} ({b.status.replace('_', ' ').toLowerCase()})</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <h3>Request to borrow</h3>
              <p className="muted small">Owner approval required | max {plural(item.max_days, 'day')}</p>
              {!item.is_active ? (
                <div className="alert alert-warn">This item is currently not available for borrowing.</div>
              ) : !isAuthenticated ? (
                <>
                  <div className="alert alert-info">Log in to send a borrow request.</div>
                  <Link to="/login" state={{ from: `/items/${item.id}` }} className="btn btn-primary btn-block">Log in to borrow</Link>
                  {booked.length > 0 && <p className="muted small" style={{ marginTop: 10 }}>This item is already booked on {plural(booked.length, 'date range')}.</p>}
                </>
              ) : canBook ? (
                <BookingForm item={item} bookedRanges={booked} initialFrom={params.get('from') || ''} initialTo={params.get('to') || ''} />
              ) : null}
            </>
          )}
        </aside>
      </div>

      {editReview && (
        <ReviewModal review={editReview} who={editReview.reviewee_name} onClose={() => setEditReview(null)} onDone={() => { setEditReview(null); load(); }} />
      )}
      {deleteReview && (
        <ConfirmDialog title="Delete review?" message="This review will be permanently removed and the trust score will be recalculated." loading={busy} onConfirm={confirmDeleteReview} onCancel={() => setDeleteReview(null)} />
      )}
      {deleteItem && (
        <ConfirmDialog
          title={isOwner ? 'Delete this item?' : 'Remove this item?'}
          message="If this item has never been booked it is deleted for good. If it has booking history it is deactivated instead, so records stay intact. Items with open bookings cannot be removed."
          confirmText={isOwner ? 'Delete item' : 'Remove item'}
          loading={busy}
          onConfirm={confirmDeleteItem}
          onCancel={() => setDeleteItem(false)}
        />
      )}
    </div>
  );
}
