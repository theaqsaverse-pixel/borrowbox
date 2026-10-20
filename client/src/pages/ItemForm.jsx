import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { categoriesApi, itemsApi } from '../api';
import { getErrorMessage, getFieldErrors } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Loader, { Spinner } from '../components/Loader';
import { ErrorState } from '../components/EmptyState';
import { CONDITIONS, imageSrc } from '../utils/format';

const EMPTY = { title: '', description: '', category_id: '', condition: 'good', max_days: 3, pickup_area: '', image_url: '', is_active: true };

/** Add item (/items/new) and edit item (/items/:id/edit) share this form. */
export default function ItemForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [imageMode, setImageMode] = useState('url'); // 'url' | 'upload'
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = await categoriesApi.list();
        if (cancelled) return;
        setCategories(cats.data);
        if (editing) {
          const res = await itemsApi.get(id);
          if (cancelled) return;
          const it = res.data;
          if (it.owner_id !== user.id) {
            setLoadError('Only the owner can edit this item.');
            return;
          }
          setForm({
            title: it.title,
            description: it.description || '',
            category_id: String(it.category_id),
            condition: it.condition,
            max_days: it.max_days,
            pickup_area: it.pickup_area || '',
            image_url: it.image_url || '',
            is_active: it.is_active,
          });
          if (it.image_url?.startsWith('/uploads')) setImageMode('upload');
        }
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, editing, user.id]);

  // local preview for a chosen file
  useEffect(() => {
    if (!file) return setPreview('');
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return setFile(null);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)) {
      toast.error('Only JPG, PNG, WEBP or GIF images are allowed');
      e.target.value = '';
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2 MB or smaller');
      e.target.value = '';
      return;
    }
    setFile(f);
  };

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    if (!form.category_id) e.category_id = 'Choose a category';
    const days = Number(form.max_days);
    if (!Number.isInteger(days) || days < 1 || days > 90) e.max_days = 'Enter a whole number from 1 to 90';
    if (imageMode === 'url' && form.image_url.trim() && !/^https?:\/\/\S+$/i.test(form.image_url.trim()) && !form.image_url.startsWith('/uploads/')) {
      e.image_url = 'Enter a valid http(s) image URL';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setSaving(true);
    try {
      let payload;
      if (imageMode === 'upload' && file) {
        payload = new FormData();
        ['title', 'description', 'category_id', 'condition', 'max_days', 'pickup_area'].forEach((k) => payload.append(k, form[k]));
        payload.append('is_active', String(form.is_active));
        payload.append('image', file);
      } else {
        payload = {
          title: form.title.trim(),
          description: form.description.trim(),
          category_id: Number(form.category_id),
          condition: form.condition,
          max_days: Number(form.max_days),
          pickup_area: form.pickup_area.trim(),
          is_active: form.is_active,
        };
        if (imageMode === 'url') payload.image_url = form.image_url.trim();
      }
      const res = editing ? await itemsApi.update(id, payload) : await itemsApi.create(payload);
      toast.success(editing ? 'Item updated' : 'Item added - it is now listed!');
      navigate(`/items/${res.data.id}`);
    } catch (err) {
      setServerError(getErrorMessage(err));
      setErrors((prev) => ({ ...prev, ...getFieldErrors(err) }));
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading..." />;
  if (loadError) return <div className="container page"><ErrorState message={loadError} /></div>;

  const shownImage = preview || (imageMode === 'url' || !file ? imageSrc(form.image_url) : '');

  return (
    <div className="container page">
      <Link to={editing ? `/items/${id}` : '/dashboard?tab=items'} className="back-link">← Back</Link>
      <div className="card" style={{ maxWidth: 760 }}>
        <h1>{editing ? 'Edit item' : 'Add an item'}</h1>
        <p className="muted">{editing ? 'Update the details of your listing.' : 'List something you are happy to lend to the community.'}</p>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" className={`input${errors.title ? ' invalid' : ''}`} value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Cordless Drill 18V" />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea id="description" className="textarea" value={form.description} onChange={set('description')} maxLength={2000} placeholder="What is included? Any care instructions?" />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="category_id">Category</label>
              <select id="category_id" className={`select${errors.category_id ? ' invalid' : ''}`} value={form.category_id} onChange={set('category_id')}>
                <option value="">Select a category...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.category_id && <span className="error-text">{errors.category_id}</span>}
            </div>
            <div className="field">
              <label htmlFor="condition">Condition</label>
              <select id="condition" className="select" value={form.condition} onChange={set('condition')}>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="max_days">Maximum lending days</label>
              <input id="max_days" type="number" min="1" max="90" className={`input${errors.max_days ? ' invalid' : ''}`} value={form.max_days} onChange={set('max_days')} />
              {errors.max_days && <span className="error-text">{errors.max_days}</span>}
            </div>
            <div className="field">
              <label htmlFor="pickup_area">Pickup area</label>
              <input id="pickup_area" className="input" value={form.pickup_area} onChange={set('pickup_area')} maxLength={120} placeholder="e.g. Block B" />
            </div>
          </div>

          <div className="field">
            <span className="label">Photo</span>
            <div className="seg" role="tablist">
              <button type="button" className={imageMode === 'url' ? 'active' : ''} onClick={() => { setImageMode('url'); setFile(null); }}>Image URL</button>
              <button type="button" className={imageMode === 'upload' ? 'active' : ''} onClick={() => setImageMode('upload')}>Upload file</button>
            </div>
            {imageMode === 'url' ? (
              <>
                <input className={`input${errors.image_url ? ' invalid' : ''}`} value={form.image_url} onChange={set('image_url')} placeholder="https://..." aria-label="Image URL" />
                {errors.image_url && <span className="error-text">{errors.image_url}</span>}
              </>
            ) : (
              <>
                <input type="file" className="input" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFile} aria-label="Upload image" />
                <span className="hint">JPG, PNG, WEBP or GIF, up to 2 MB.{editing && form.image_url ? ' Leave empty to keep the current photo.' : ''}</span>
              </>
            )}
            {shownImage && <img className="image-preview" src={shownImage} alt="Preview" onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} />}
          </div>

          {editing && (
            <label className="checkbox" style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
              Active (visible to other members and open for requests)
            </label>
          )}

          <div className="row">
            <button className="btn btn-primary" disabled={saving}>{saving && <Spinner />} {editing ? 'Save changes' : 'Add item'}</button>
            <Link to={editing ? `/items/${id}` : '/dashboard?tab=items'} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
