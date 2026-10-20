import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { categoriesApi, itemsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import ItemCard, { SkeletonCard } from '../components/ItemCard';
import Pagination from '../components/Pagination';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { CONDITIONS, formatShort, todayISO } from '../utils/format';

const PAGE_SIZE = 12;

export default function Home() {
  const { isAuthenticated } = useAuth();
  // All filters live in the URL so a search can be shared or refreshed.
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const category = params.get('category') || '';
  const condition = params.get('condition') || '';
  const sort = params.get('sort') || 'newest';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // local form state for the search bar (applied on submit)
  const [form, setForm] = useState({ search, from, to, category });
  useEffect(() => setForm({ search, from, to, category }), [search, from, to, category]);

  useEffect(() => {
    categoriesApi.list().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await itemsApi.list({
        search: search || undefined,
        category: category || undefined,
        condition: condition || undefined,
        from: from || undefined,
        to: to || from || undefined,
        sort: sort !== 'newest' ? sort : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, category, condition, from, to, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page'); // any filter change goes back to page 1
    setParams(next);
  };

  const onSearch = (e) => {
    e.preventDefault();
    let { from: f, to: t } = form;
    if (f && !t) t = f;
    if (t && !f) f = t;
    if (f && t && t < f) [f, t] = [t, f];
    update({ search: form.search.trim(), from: f, to: t, category: form.category });
  };

  const clear = () => setParams(new URLSearchParams());
  const hasFilters = !!(search || from || to || category || condition || sort !== 'newest');
  const selectedCats = useMemo(() => category.split(',').filter(Boolean), [category]);

  const toggleCategory = (id) => {
    const set = new Set(selectedCats);
    set.has(String(id)) ? set.delete(String(id)) : set.add(String(id));
    update({ category: [...set].join(',') });
  };

  const rangeText = from && to ? (from === to ? formatShort(from) : `${formatShort(from)} - ${formatShort(to)}`) : '';

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Borrow what you need. Lend what you don't.</h1>
          <form className="search-bar" onSubmit={onSearch} role="search">
            <div className="field span-2">
              <label htmlFor="q">Search</label>
              <input id="q" className="input" placeholder="Search tools & gadgets..." value={form.search} onChange={(e) => setForm({ ...form, search: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="from">From</label>
              <input id="from" type="date" className="input" min={todayISO()} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="to">To</label>
              <input id="to" type="date" className="input" min={form.from || todayISO()} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cat">Category</label>
              <select id="cat" className="select" value={form.category.includes(',') ? '' : form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary">Search</button>
          </form>
        </div>
      </section>

      <div className="container page" style={{ minHeight: 'auto' }}>
        <div className="layout-2">
          <aside className="card filters" aria-label="Filters">
            <div className="row-between">
              <h3>Filters</h3>
              {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clear}>Clear filters</button>}
            </div>
            <div className="filters-body">
              <div className="filter-group">
                <span className="label">Category</span>
                {categories.map((c) => (
                  <label key={c.id} className="filter-option">
                    <input type="checkbox" checked={selectedCats.includes(String(c.id))} onChange={() => toggleCategory(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
              <div className="filter-group">
                <span className="label">Condition</span>
                {[{ value: '', label: 'Any' }, ...CONDITIONS].map((c) => (
                  <label key={c.value} className="filter-option">
                    <input type="radio" name="condition" checked={condition === c.value} onChange={() => update({ condition: c.value })} />
                    {c.label}
                  </label>
                ))}
              </div>
              <div className="filter-group">
                <label className="label" htmlFor="sort">Sort by</label>
                <select id="sort" className="select" value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Title A-Z</option>
                  <option value="rating">Top rated owners</option>
                </select>
              </div>
            </div>
          </aside>

          <section aria-live="polite">
            <div className="result-bar">
              <h2>{loading ? 'Searching...' : `${meta.total} item${meta.total === 1 ? '' : 's'} found`}</h2>
              {rangeText && !loading && <span className="pill pill-teal">Free on {rangeText}</span>}
            </div>

            {error ? (
              <ErrorState message={error} onRetry={load} />
            ) : loading ? (
              <div className="item-grid">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon="🔍" title="No items found" action={hasFilters ? <button className="btn btn-outline" onClick={clear}>Clear filters</button> : null}>
                {hasFilters ? 'Try different keywords or dates, or clear the filters.' : 'Nobody has listed an item yet. Be the first!'}
              </EmptyState>
            ) : (
              <>
                <div className="item-grid">
                  {items.map((item) => <ItemCard key={item.id} item={item} from={from} to={to} />)}
                </div>
                <Pagination page={page} totalPages={meta.totalPages} onChange={(p) => { update({ page: p > 1 ? String(p) : '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </>
            )}
          </section>
        </div>

        {!isAuthenticated && (
          <section id="how-it-works" style={{ marginTop: 48 }}>
            <h2>How it works</h2>
            <div className="how-grid">
              <div className="how-step"><div className="num">1</div><h3>List or search</h3><p className="muted">Members list tools they are happy to lend. Everyone can search by keyword, category and free dates.</p></div>
              <div className="how-step"><div className="num">2</div><h3>Request & approve</h3><p className="muted">Pick free dates on the calendar and send a request. The owner approves - no double bookings, ever.</p></div>
              <div className="how-step"><div className="num">3</div><h3>Hand over & rate</h3><p className="muted">Condition is logged at pickup and return, then both sides rate each other to build a trust score.</p></div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
