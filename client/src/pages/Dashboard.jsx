import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { bookingsApi, itemsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import EmptyState, { ErrorState } from '../components/EmptyState';
import BookingCard from '../components/BookingCard';
import BookingActionModal from '../components/BookingActionModal';
import EditBookingModal from '../components/EditBookingModal';
import ReviewModal from '../components/ReviewModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ItemImage from '../components/ItemImage';
import { STATUS_LABELS, STATUS_LIST, formatDate, plural } from '../utils/format';

const TABS = [
  { key: 'items', label: 'My Items' },
  { key: 'borrowings', label: 'My Borrowings' },
  { key: 'incoming', label: 'Incoming Requests' },
];

function StatusFilter({ bookings, value, onChange }) {
  const counts = useMemo(() => {
    const c = {};
    bookings.forEach((b) => (c[b.status] = (c[b.status] || 0) + 1));
    return c;
  }, [bookings]);
  return (
    <div className="chips" role="group" aria-label="Filter by status">
      <button className={`chip${value === '' ? ' active' : ''}`} onClick={() => onChange('')}>All ({bookings.length})</button>
      {STATUS_LIST.filter((s) => counts[s]).map((s) => (
        <button key={s} className={`chip${value === s ? ' active' : ''}`} onClick={() => onChange(s)}>{STATUS_LABELS[s]} ({counts[s]})</button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'borrowings';

  const [items, setItems] = useState(null);
  const [borrowings, setBorrowings] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  // dialogs
  const [modal, setModal] = useState(null); // { type, booking?, item? }
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [i, b, inc] = await Promise.all([itemsApi.mine(), bookingsApi.mine(), bookingsApi.incoming()]);
      setItems(i.data);
      setBorrowings(b.data);
      setIncoming(inc.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => setFilter(''), [tab]);

  const setTab = (key) => setParams({ tab: key });
  const closeModal = () => setModal(null);
  const refreshAfter = () => { closeModal(); loadAll(); };

  /* ---------- simple (no-note) booking actions ---------- */
  const runStatus = async (booking, action, successMsg) => {
    setBusy(true);
    try {
      const res = await bookingsApi.setStatus(booking.id, { action });
      toast.success(successMsg + (res.data.auto_rejected?.length ? ` (${res.data.auto_rejected.length} clashing request(s) auto-rejected)` : ''));
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
      loadAll();
    } finally {
      setBusy(false);
      closeModal();
    }
  };

  const onBookingAction = (key, booking) => {
    switch (key) {
      case 'approve': return runStatus(booking, 'approve', 'Booking approved');
      case 'reject':
      case 'pickup':
      case 'return':
      case 'edit':
      case 'cancel':
      case 'delete':
      case 'review':
        return setModal({ type: key, booking });
      default:
    }
  };

  const confirmCancel = () => runStatus(modal.booking, 'cancel', 'Request cancelled');

  const confirmDeleteBooking = async () => {
    setBusy(true);
    try {
      await bookingsApi.remove(modal.booking.id);
      toast.success('Booking removed');
      refreshAfter();
    } catch (err) {
      toast.error(getErrorMessage(err));
      closeModal();
    } finally {
      setBusy(false);
    }
  };

  /* ---------- my items actions ---------- */
  const toggleActive = async (item) => {
    setBusy(true);
    try {
      await itemsApi.update(item.id, { is_active: !item.is_active });
      toast.success(item.is_active ? 'Item deactivated' : 'Item activated');
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteItem = async () => {
    setBusy(true);
    try {
      const res = await itemsApi.remove(modal.item.id);
      toast.success(res.message);
      refreshAfter();
    } catch (err) {
      toast.error(getErrorMessage(err));
      closeModal();
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = (incoming || []).filter((b) => b.status === 'REQUESTED').length;
  const overdueCount = [...(borrowings || []), ...(incoming || [])].filter((b) => b.is_overdue).length;

  const list = tab === 'borrowings' ? borrowings : incoming;
  const filtered = list ? (filter ? list.filter((b) => b.status === filter) : list) : null;

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>Hello {user.name.split(' ')[0]} - manage what you lend and borrow.</p>
        </div>
        <Link to="/items/new" className="btn btn-blue">+ Lend an item</Link>
      </div>

      {overdueCount > 0 && (
        <div className="alert alert-error" role="alert">⚠ {plural(overdueCount, 'booking')} {overdueCount === 1 ? 'is' : 'are'} overdue. Check the flagged bookings below.</div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'incoming' && pendingCount > 0 && <span className="count">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadAll} />
      ) : items === null ? (
        <Loader label="Loading your dashboard..." />
      ) : tab === 'items' ? (
        items.length === 0 ? (
          <EmptyState icon="🧰" title="You have not listed anything yet" action={<Link to="/items/new" className="btn btn-primary">Add your first item</Link>}>
            Share a drill, a ladder or a projector with your community.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Item</th><th>Category</th><th>Max days</th><th>Bookings</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <ItemImage item={it} className="booking-thumb" tileClass="booking-tile" alt="" />
                        <div>
                          <Link to={`/items/${it.id}`}><strong>{it.title}</strong></Link>
                          <div className="muted small">Listed {formatDate(it.created_at)}</div>
                        </div>
                      </div>
                    </td>
                    <td>{it.category_name}</td>
                    <td>{it.max_days}</td>
                    <td>{it.booking_count}{it.open_booking_count > 0 && <span className="pill pill-blue" style={{ marginLeft: 6 }}>{it.open_booking_count} open</span>}</td>
                    <td><span className={`pill ${it.is_active ? 'pill-green' : 'pill-grey'}`}>{it.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="actions">
                        <Link to={`/items/${it.id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
                        <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => toggleActive(it)}>{it.is_active ? 'Deactivate' : 'Activate'}</button>
                        <button className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => setModal({ type: 'deleteItem', item: it })}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          {list.length > 0 && <StatusFilter bookings={list} value={filter} onChange={setFilter} />}
          {list.length === 0 ? (
            tab === 'borrowings' ? (
              <EmptyState icon="🛒" title="No borrowings yet" action={<Link to="/" className="btn btn-primary">Browse items</Link>}>Find something you need and send a request.</EmptyState>
            ) : (
              <EmptyState icon="📬" title="No incoming requests">When someone asks to borrow one of your items, it will show up here.</EmptyState>
            )
          ) : (
            <div className="list">
              {filtered.map((b) => (
                <BookingCard key={b.id} booking={b} role={tab === 'incoming' ? 'owner' : 'borrower'} on={onBookingAction} busy={busy} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------------- dialogs ---------------- */}
      {modal && ['reject', 'pickup', 'return'].includes(modal.type) && (
        <BookingActionModal action={modal.type} booking={modal.booking} onClose={closeModal} onDone={refreshAfter} />
      )}
      {modal?.type === 'edit' && <EditBookingModal booking={modal.booking} onClose={closeModal} onDone={refreshAfter} />}
      {modal?.type === 'review' && (
        <ReviewModal
          bookingId={modal.booking.id}
          who={tab === 'incoming' ? modal.booking.borrower_name : modal.booking.owner_name}
          onClose={closeModal}
          onDone={refreshAfter}
        />
      )}
      {modal?.type === 'cancel' && (
        <ConfirmDialog title="Cancel this request?" message={`Your request for "${modal.booking.item_title}" will be cancelled and the dates become free again.`} confirmText="Yes, cancel it" loading={busy} onConfirm={confirmCancel} onCancel={closeModal} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog title="Remove this booking?" message="This removes the cancelled / rejected booking from your list permanently." confirmText="Remove" loading={busy} onConfirm={confirmDeleteBooking} onCancel={closeModal} />
      )}
      {modal?.type === 'deleteItem' && (
        <ConfirmDialog
          title="Delete this item?"
          message={`"${modal.item.title}" will be deleted if it has never been booked. If it has booking history it is deactivated instead. Items with open bookings cannot be deleted.`}
          confirmText="Delete item"
          loading={busy}
          onConfirm={confirmDeleteItem}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}
