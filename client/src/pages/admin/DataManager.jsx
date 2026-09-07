import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Database, AlertTriangle, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

export default function DataManager() {
  const { addToast, confirm } = useOutletContext();
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/restaurants').then((r) => {
      setRestaurants(r.data);
      if (r.data.length) setRestaurantId(r.data[0].id);
    }).catch((e) => setError(apiErrorMessage(e)));
  }, []);

  function load() {
    if (!restaurantId) return;
    setLoading(true); setSelected([]); setError('');
    api.get(`/admin/restaurants/${restaurantId}/data`)
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [restaurantId]);

  const operational = items.filter((it) => !it.isAccount);
  const account = items.find((it) => it.isAccount);
  const allOperationalSelected = operational.length > 0 && operational.every((it) => selected.includes(it.id));

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAllOperational() {
    setSelected((prev) => {
      const opIds = operational.map((it) => it.id);
      if (allOperationalSelected) return prev.filter((id) => !opIds.includes(id));
      return [...new Set([...prev, ...opIds])];
    });
  }

  const selectedItems = useMemo(() => items.filter((it) => selected.includes(it.id)), [items, selected]);
  const selectedAccount = selectedItems.some((it) => it.isAccount);

  async function purgeSelected() {
    if (!selectedItems.length) return;
    const restaurant = restaurants.find((r) => r.id === restaurantId);
    const lines = selectedItems.map((it) => `${it.label} (${it.count})`).join(' · ');
    const ok = await confirm({
      title: `Tirtir xogta "${restaurant?.name}" · Delete data for "${restaurant?.name}"?`,
      message: (
        <>
          {selectedAccount && (
            <div style={{ color: 'var(--danger)', fontWeight: 700, marginBottom: 6 }}>
              Taas oo ay ku jirto xisaabta maqaayadda oo dhan — mar dambe lama geli karo · This includes the restaurant's own account — it will no longer be able to log in.
            </div>
          )}
          <div style={{ marginBottom: 6 }}>Lama soo celin karo · This cannot be undone.</div>
          <div style={{ fontSize: 12.5 }}>{lines}</div>
        </>
      ),
      tone: 'danger', confirmLabel: 'Tirtir · Delete',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/restaurants/${restaurantId}/data/purge`, { ids: selected });
      addToast({ title: 'Xogta waa la tirtiray · Data deleted', body: data.results.map((r) => `${r.label}: ${r.deletedCount}`).join(' · '), tone: 'success' });
      if (selectedAccount) {
        // The restaurant itself is gone — drop it from the picker and land on whatever's left.
        const remaining = restaurants.filter((r) => r.id !== restaurantId);
        setRestaurants(remaining);
        setRestaurantId(remaining[0]?.id || '');
        if (!remaining.length) { setItems([]); setSelected([]); }
      } else {
        load();
      }
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to delete', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">Xogta maqaayadaha · Restaurant data</h1>
        <p className="page-sub">
          Dooro maqaayad, kadibna tirtir xogteeda si gaar ah — kaliya tan aad doorato ayaa saameyn ku yeelan doonta · Pick a restaurant, then wipe its data selectively — only the one you pick is ever touched.
        </p>
      </div>

      <div style={{ background: 'linear-gradient(180deg,#F8FAFC,#fff)', border: '1px dashed #C7D2E0', borderRadius: 16, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={17} strokeWidth={2.25} /> Maqaayadda · Restaurant
          </span>
          <select className="field-input" style={{ maxWidth: 280 }} value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name} · @{r.username}</option>)}
          </select>
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {loading && <div className="text-muted">Loading…</div>}

        {!loading && !!operational.length && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={allOperationalSelected} onChange={toggleAllOperational} />
                Dhammaan · Select all
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 22 }}>
              {operational.map((it) => (
                <label
                  key={it.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer',
                    background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
                    opacity: it.count ? 1 : 0.55,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={selected.includes(it.id)} onChange={() => toggle(it.id)} disabled={!it.count} />
                    {it.label}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--muted-3)' }}>{it.count}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {!loading && account && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13, color: 'var(--danger)', marginBottom: 6 }}>
              <AlertTriangle size={15} strokeWidth={2.25} /> Xisaabta maqaayadda · Restaurant account
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--danger)' }}>
              <input type="checkbox" checked={selected.includes(account.id)} onChange={() => toggle(account.id)} />
              Tirtir xisaabta oo dhan — mar dambe lama geli karo · Delete the account entirely — it will no longer be able to log in
            </label>
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ background: selected.length ? 'var(--danger)' : undefined, display: 'flex', alignItems: 'center', gap: 8 }}
          disabled={!selected.length || busy}
          onClick={purgeSelected}
        >
          <Trash2 size={15} strokeWidth={2.25} /> {busy ? 'Tirtiraya…' : `Tirtir doorashada (${selected.length}) · Delete selected`}
        </button>
      </div>
    </div>
  );
}
