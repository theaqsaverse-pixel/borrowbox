import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi, categoriesApi, itemsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Loader, { Spinner } from '../components/Loader';
import EmptyState, { ErrorState } from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { STATUS_LABELS, STATUS_LIST, formatDate } from '../utils/format';

const TABS = [
  { key: 'stats', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'items', label: 'Items' },
  { key: 'categories', label: 'Categories' },
];

/* ============================ stats ============================ */
function Stats({ stats }) {
  const cards = [
    { label: 'Total users', value: stats.users.total, sub: `${stats.users.active} active`, color: 'var(--navy)' },
    { label: 'Total items', value: stats.items.total, sub: `${stats.items.active} active`, color: 'var(--blue)' },
    { label: 'Total bookings', value: stats.bookings.total, sub: 'all statuses', color: 'var(--teal)' },
    { label: 'Categories', value: stats.categories, sub: `${stats.reviews} reviews`, color: 'var(--indigo)' },
  ];
  return (
    <>
      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card" style={{ borderTopColor: c.color }}>
            <div className="num">{c.value}</div>
            <div className="lbl">{c.label}</div>
            <div className="muted small">{c.sub}</div>
          </div>
        ))}
      </div>
      <h3>Bookings by status</h3>
      <div className="stat-grid">
        {STATUS_LIST.map((s) => (
          <div key={s} className="stat-card" style={{ borderTopColor: `var(--st-${s.toLowerCase()})` }}>
            <div className="num">{stats.bookings.by_status[s] ?? 0}</div>
            <div className="lbl">{STATUS_LABELS[s]}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================ users ============================ */
function Users({ currentUser }) {
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await adminApi.users(query);
      setUsers(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await adminApi.setUserStatus(confirm.id, !confirm.is_active);
      toast.success(res.message);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <>
      <form className="row" style={{ marginBottom: 14 }} onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        <button className="btn btn-primary">Search</button>
        {query && <button type="button" className="btn btn-ghost" onClick={() => { setSearch(''); setQuery(''); }}>Clear</button>}
      </form>
      {users === null ? <Loader /> : users.length === 0 ? <EmptyState icon="👥" title="No users match" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Items</th><th>Borrowings</th><th>Trust</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><Link to={`/profile/${u.id}`}><strong>{u.name}</strong></Link><div className="muted small">{u.email}</div></td>
                  <td><span className={`pill ${u.role === 'admin' ? 'pill-indigo' : ''}`}>{u.role}</span></td>
                  <td>{u.item_count}</td>
                  <td>{u.borrowing_count}</td>
                  <td>{u.trust_score ? `★ ${Number(u.trust_score).toFixed(1)}` : '-'}</td>
                  <td>{formatDate(u.created_at)}</td>
                  <td>{u.deleted_at ? <span className="pill pill-grey">Deleted</span> : <span className={`pill ${u.is_active ? 'pill-green' : 'pill-red'}`}>{u.is_active ? 'Active' : 'Deactivated'}</span>}</td>
                  <td>
                    {u.deleted_at || u.id === currentUser.id ? <span className="muted small">-</span> : (
                      <button className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-success'}`} onClick={() => setConfirm(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.is_active ? 'Deactivate user?' : 'Activate user?'}
          message={confirm.is_active ? `${confirm.name} will be logged out and unable to log in. Their items are hidden from browsing.` : `${confirm.name} will be able to log in again.`}
          confirmText={confirm.is_active ? 'Deactivate' : 'Activate'}
          danger={confirm.is_active}
          loading={busy}
          onConfirm={toggle}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/* ============================ items ============================ */
function Items() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await adminApi.items()).data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await itemsApi.remove(confirm.id);
      toast.success(res.message);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (items === null) return <Loader />;
  if (items.length === 0) return <EmptyState icon="🧰" title="No items yet" />;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Item</th><th>Owner</th><th>Category</th><th>Bookings</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td><Link to={`/items/${it.id}`}><strong>{it.title}</strong></Link><div className="muted small">Listed {formatDate(it.created_at)}</div></td>
                <td><Link to={`/profile/${it.owner_id}`}>{it.owner_name}</Link></td>
                <td>{it.category_name}</td>
                <td>{it.booking_count}{it.open_booking_count > 0 && <span className="pill pill-blue" style={{ marginLeft: 6 }}>{it.open_booking_count} open</span>}</td>
                <td><span className={`pill ${it.is_active ? 'pill-green' : 'pill-grey'}`}>{it.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button className="btn btn-outline-danger btn-sm" onClick={() => setConfirm(it)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Remove this item?"
          message={`"${confirm.title}" will be deleted if it never had a booking, otherwise it is deactivated so history stays intact. Items with open bookings cannot be removed.`}
          confirmText="Remove item"
          loading={busy}
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/* ============================ categories ============================ */
function CategoryModal({ category, onClose, onSaved }) {
  const [name, setName] = useState(category?.name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Name must be at least 2 characters');
    setSaving(true);
    setError('');
    try {
      const res = category ? await categoriesApi.rename(category.id, name.trim()) : await categoriesApi.create(name.trim());
      toast.success(res.message);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={category ? 'Rename category' : 'Add category'} onClose={onClose} locked={saving}>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <label htmlFor="cat-name">Category name</label>
          <input id="cat-name" className="input" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving && <Spinner />} {category ? 'Rename' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Categories() {
  const [cats, setCats] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'add' | 'rename' | 'delete', category? }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setCats((await categoriesApi.list()).data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      await categoriesApi.remove(modal.category.id);
      toast.success('Category deleted');
      setModal(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err)); // 409 when items use it
      setModal(null);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (cats === null) return <Loader />;
  return (
    <>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <span className="muted">{cats.length} categor{cats.length === 1 ? 'y' : 'ies'}</span>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}>+ Add category</button>
      </div>
      {cats.length === 0 ? <EmptyState icon="🏷️" title="No categories yet">Add the first one so members can list items.</EmptyState> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Name</th><th>Items using it</th><th>Actions</th></tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.item_count}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setModal({ type: 'rename', category: c })}>Rename</button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => setModal({ type: 'delete', category: c })}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(modal?.type === 'add' || modal?.type === 'rename') && (
        <CategoryModal category={modal.category} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Delete category?"
          message={modal.category.item_count > 0 ? `"${modal.category.name}" is used by ${modal.category.item_count} item(s) and cannot be deleted.` : `"${modal.category.name}" will be permanently deleted.`}
          loading={busy}
          onConfirm={remove}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  );
}

/* ============================ page ============================ */
export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setError('');
    try {
      setStats((await adminApi.stats()).data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => { if (tab === 'stats') loadStats(); }, [tab, loadStats]);

  return (
    <div className="container page">
      <div className="page-head"><h1>Admin panel</h1></div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'stats' && (error ? <ErrorState message={error} onRetry={loadStats} /> : stats ? <Stats stats={stats} /> : <Loader />)}
      {tab === 'users' && <Users currentUser={user} />}
      {tab === 'items' && <Items />}
      {tab === 'categories' && <Categories />}
    </div>
  );
}
