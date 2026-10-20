import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { reviewsApi, usersApi } from '../api';
import { getErrorMessage, getFieldErrors } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Loader, { Spinner } from '../components/Loader';
import { ErrorState } from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import ReviewList from '../components/ReviewList';
import ReviewModal from '../components/ReviewModal';
import { Stars } from '../components/StarRating';
import { formatMonthYear } from '../utils/format';

function EditProfileModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', area: user.area || '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters' });
    setSaving(true);
    setServerError('');
    try {
      const res = await usersApi.updateMe({ name: form.name.trim(), phone: form.phone.trim(), area: form.area.trim() });
      toast.success('Profile updated');
      onSaved(res.data.user);
    } catch (err) {
      setServerError(getErrorMessage(err));
      setErrors(getFieldErrors(err));
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={onClose} locked={saving}>
      <form onSubmit={submit} noValidate>
        {serverError && <div className="alert alert-error">{serverError}</div>}
        <div className="field">
          <label htmlFor="p-name">Name</label>
          <input id="p-name" className={`input${errors.name ? ' invalid' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="p-phone">Phone</label>
          <input id="p-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
        </div>
        <div className="field">
          <label htmlFor="p-area">Area</label>
          <input id="p-area" className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} maxLength={120} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Save</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Profile() {
  const { id } = useParams();
  const { user, setUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editReview, setEditReview] = useState(null);
  const [deleteReview, setDeleteReview] = useState(null);
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.get(id);
      setProfile(res.data);
    } catch (err) {
      setError({ status: err.response?.status, message: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader label="Loading profile..." />;
  if (error) {
    return (
      <div className="container page">
        {error.status === 404 ? <div className="empty"><div className="icon">👤</div><h3>User not found</h3><Link to="/" className="btn btn-primary">Back to browse</Link></div> : <ErrorState message={error.message} onRetry={load} />}
      </div>
    );
  }

  const isMe = user?.id === profile.id;
  // For your own profile show the private details from the logged-in user object.
  const me = isMe ? user : null;

  const doDeleteReview = async () => {
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

  const doDeleteAccount = async () => {
    setBusy(true);
    try {
      await usersApi.deleteMe();
      toast.success('Your account has been deleted');
      logout();
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteAccount(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="card">
        <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
          <span className="avatar avatar-lg">{profile.name.charAt(0).toUpperCase()}</span>
          <div className="grow">
            <h1 style={{ marginBottom: 2 }}>{profile.name}</h1>
            <div className="muted">
              {profile.area ? `${profile.area} · ` : ''}Member since {formatMonthYear(profile.created_at)}
              {profile.role === 'admin' && <span className="pill pill-indigo" style={{ marginLeft: 8 }}>Admin</span>}
            </div>
            {me && (
              <div className="muted small" style={{ marginTop: 4 }}>
                {me.email}{me.phone ? ` · ${me.phone}` : ''}
              </div>
            )}
            {isMe && (
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit profile</button>
                {profile.role !== 'admin' && <button className="btn btn-outline-danger btn-sm" onClick={() => setDeleteAccount(true)}>Delete account</button>}
              </div>
            )}
          </div>
          <div className="center" style={{ minWidth: 130 }}>
            <div className="label">Trust score</div>
            {profile.review_count > 0 ? (
              <>
                <div className="score-big">{Number(profile.trust_score).toFixed(1)}</div>
                <Stars value={profile.trust_score} />
                <div className="muted small">{profile.review_count} review{profile.review_count === 1 ? '' : 's'}</div>
              </>
            ) : (
              <div className="muted small" style={{ marginTop: 6 }}>No reviews yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><h2 style={{ margin: 0 }}>Reviews received</h2></div>
        {profile.reviews.length === 0 ? (
          <p className="muted">No reviews yet. They appear after a loan is returned and the other person rates it.</p>
        ) : (
          <ReviewList
            reviews={profile.reviews}
            showItem
            canManage={(r) => user && (r.reviewer_id === user.id || isAdmin)}
            onEdit={(r) => (r.reviewer_id === user.id ? setEditReview({ ...r, reviewee_name: profile.name }) : toast.error('Only the author can edit a review'))}
            onDelete={setDeleteReview}
          />
        )}
      </div>

      {editing && <EditProfileModal user={user} onClose={() => setEditing(false)} onSaved={(u) => { setUser(u); setEditing(false); load(); }} />}
      {editReview && <ReviewModal review={editReview} who={profile.name} onClose={() => setEditReview(null)} onDone={() => { setEditReview(null); load(); }} />}
      {deleteReview && <ConfirmDialog title="Delete review?" message="This review will be permanently removed and the trust score recalculated." loading={busy} onConfirm={doDeleteReview} onCancel={() => setDeleteReview(null)} />}
      {deleteAccount && (
        <ConfirmDialog
          title="Delete your account?"
          message="Your account will be deactivated and your items hidden. This is blocked while you have open bookings (requested, approved or picked up). Your booking and review history is kept."
          confirmText="Delete my account"
          loading={busy}
          onConfirm={doDeleteAccount}
          onCancel={() => setDeleteAccount(false)}
        />
      )}
    </div>
  );
}
