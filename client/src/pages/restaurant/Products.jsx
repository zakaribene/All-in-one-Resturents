import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

function imgStyle(hue) {
  return { background: `repeating-linear-gradient(135deg, hsl(${hue} 45% 91%) 0 9px, hsl(${hue} 45% 87%) 9px 18px)` };
}

export default function Products() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([api.get('/restaurant/categories'), api.get('/restaurant/products')])
      .then(([c, p]) => { setCategories(c.data); setProducts(p.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggle(id) {
    const { data } = await api.patch(`/restaurant/products/${id}/toggle`);
    setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
  }

  const catName = (id) => {
    const c = categories.find((c) => c.id === id);
    return c ? `${c.en} · ${c.so}` : '';
  };
  const visible = products.filter((p) => filter === 'all' || p.category === filter);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24 }}>Cuntooyinka · Products</h1>
          <p className="page-sub">Diiwaan geli oo maamul · Add and manage your menu.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={!categories.length}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Ku dar cunto · Add product
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button className={'chip' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>All · Dhammaan</button>
        {categories.map((c) => (
          <button key={c.id} className={'chip' + (filter === c.id ? ' active' : '')} onClick={() => setFilter(c.id)}>{c.en} · {c.so}</button>
        ))}
      </div>

      {loading && <div className="text-muted">Loading…</div>}
      {!categories.length && !loading && (
        <div className="card card-pad text-muted">Marka hore ku dar qayb · Add a category first, then add products.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {visible.map((p) => (
          <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 104, position: 'relative', ...imgStyle(p.hue) }}>
              <span
                onClick={() => toggle(p.id)}
                className="pill"
                style={{
                  position: 'absolute', top: 10, right: 10, cursor: 'pointer',
                  background: p.status === 'active' ? 'var(--success-bg)' : 'var(--border-soft)',
                  color: p.status === 'active' ? 'var(--success)' : 'var(--muted-2)',
                }}
              >
                {p.status === 'active' ? 'Live' : 'Hidden'}
              </span>
            </div>
            <div style={{ padding: 13 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.en}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 8 }}>{p.so} · {catName(p.category)}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>${p.price.toFixed(2)}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-3)', fontWeight: 600 }}>{p.sold} sold</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddProductModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onCreated={(p) => { setProducts((prev) => [p, ...prev]); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AddProductModal({ categories, onClose, onCreated }) {
  const [form, setForm] = useState({ nameEn: '', nameSo: '', price: '', category: categories[0]?.id || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/restaurant/products', { ...form, price: Number(form.price) });
      onCreated(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to add product'));
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} width={420}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>Ku dar cunto · Add product</div>
        <label className="field-label">Magaca (English)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={form.nameEn} onChange={set('nameEn')} />
        <label className="field-label">Magaca (Soomaali)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={form.nameSo} onChange={set('nameSo')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">Qiimaha · Price ($)</label>
            <input className="field-input" style={{ marginBottom: 14 }} required type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
          </div>
          <div>
            <label className="field-label">Qaybta · Category</label>
            <select className="field-input" style={{ marginBottom: 14 }} value={form.category} onChange={set('category')}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.en} · {c.so}</option>)}
            </select>
          </div>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Ku dar · Add'}</button>
        </div>
      </form>
    </Modal>
  );
}
