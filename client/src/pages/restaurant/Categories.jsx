import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  function load() {
    Promise.all([api.get('/restaurant/categories'), api.get('/restaurant/products')])
      .then(([c, p]) => { setCategories(c.data); setProducts(p.data); });
  }
  useEffect(load, []);

  const countFor = (id) => products.filter((p) => p.category === id).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24 }}>Qaybaha · Categories</h1>
          <p className="page-sub">Habee menu-gaaga · Organise your menu.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Qayb cusub · Add category
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden', maxWidth: 640 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 8%, #fff)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>≡</div>
            <div style={{ flex: 1, lineHeight: 1.25 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.en} · {c.so}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{countFor(c.id)} items</div>
            </div>
          </div>
        ))}
        {!categories.length && <div style={{ padding: 20 }} className="text-muted">No categories yet.</div>}
      </div>

      {showAdd && (
        <AddCategoryModal onClose={() => setShowAdd(false)} onCreated={(c) => { setCategories((prev) => [...prev, c]); setShowAdd(false); }} />
      )}
    </div>
  );
}

function AddCategoryModal({ onClose, onCreated }) {
  const [nameEn, setNameEn] = useState('');
  const [nameSo, setNameSo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/restaurant/categories', { nameEn, nameSo });
      onCreated(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to add category'));
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} width={380}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>Qayb cusub · Add category</div>
        <label className="field-label">Magaca (English)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <label className="field-label">Magaca (Soomaali)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={nameSo} onChange={(e) => setNameSo(e.target.value)} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Ku dar · Add'}</button>
        </div>
      </form>
    </Modal>
  );
}
