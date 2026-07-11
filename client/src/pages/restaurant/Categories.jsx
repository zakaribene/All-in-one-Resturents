import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

const ICONS = ['🍢', '🍜', '🥤', '🍰', '🥗', '🍲', '🍕', '🍞'];
function iconFor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return ICONS[h % ICONS.length];
}
function hueFor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([api.get('/restaurant/categories'), api.get('/restaurant/products')])
      .then(([c, p]) => { setCategories(c.data); setProducts(p.data); })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const countFor = (id) => products.filter((p) => p.category === id).length;

  async function removeCategory(c) {
    if (countFor(c.id) > 0) {
      window.alert('Qaybtan waxay leedahay cuntooyin · Move or delete its products first.');
      return;
    }
    if (!window.confirm(`Ma hubtaa inaad tirtirto "${c.en}"? · Delete this category?`)) return;
    try {
      await api.delete(`/restaurant/categories/${c.id}`);
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      window.alert(apiErrorMessage(err, 'Failed to delete category'));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24 }}>Qaybaha · Categories</h1>
          <p className="page-sub">Habee menu-gaaga · Organise your menu.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Qayb cusub · Add category
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {loading && <div className="text-muted">Loading…</div>}

      {!loading && !categories.length && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗂️</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Weli qayb ma jirto · No categories yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginBottom: 18 }}>Ku bilow qayb sida "Grill" ama "Drinks" · Start by adding a category like "Grill" or "Drinks".</div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ margin: '0 auto' }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Qayb cusub · Add category
          </button>
        </div>
      )}

      {!loading && !!categories.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {categories.map((c) => {
            const hue = hueFor(c.en);
            const n = countFor(c.id);
            return (
              <div key={c.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 46, height: 46, borderRadius: 12, flex: '0 0 auto', fontSize: 21,
                      background: `hsl(${hue} 65% 95%)`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {iconFor(c.en)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.en}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.so}</div>
                  </div>
                </div>

                <span
                  className="pill"
                  style={{
                    alignSelf: 'flex-start', background: `hsl(${hue} 55% 42% / .1)`, color: `hsl(${hue} 55% 38%)`,
                  }}
                >
                  {n} {n === 1 ? 'item' : 'items'}
                </span>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    className="btn-outline" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => setEditCat(c)}
                  >
                    ✎ Edit
                  </button>
                  <button
                    title="Tirtir · Delete" onClick={() => removeCategory(c)}
                    style={{ width: 34, height: 34, flex: '0 0 auto', borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <CategoryModal
          title="Qayb cusub · Add category"
          submitLabel="Ku dar · Add"
          onClose={() => setShowAdd(false)}
          onSubmit={(form) => api.post('/restaurant/categories', form)}
          onDone={(c) => { setCategories((prev) => [...prev, c]); setShowAdd(false); }}
        />
      )}
      {editCat && (
        <CategoryModal
          title="Wax ka beddel qayb · Edit category"
          submitLabel="Keydi · Save"
          initial={{ nameEn: editCat.en, nameSo: editCat.so }}
          onClose={() => setEditCat(null)}
          onSubmit={(form) => api.patch(`/restaurant/categories/${editCat.id}`, form)}
          onDone={(c) => { setCategories((prev) => prev.map((x) => (x.id === c.id ? c : x))); setEditCat(null); }}
        />
      )}
    </div>
  );
}

function CategoryModal({ title, submitLabel, initial, onClose, onSubmit, onDone }) {
  const [nameEn, setNameEn] = useState(initial?.nameEn || '');
  const [nameSo, setNameSo] = useState(initial?.nameSo || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await onSubmit({ nameEn, nameSo });
      onDone(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save category'));
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} width={380}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>{title}</div>
        <label className="field-label">Magaca (English)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <label className="field-label">Magaca (Soomaali)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={nameSo} onChange={(e) => setNameSo(e.target.value)} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
