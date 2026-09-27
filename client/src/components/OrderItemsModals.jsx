import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import Modal from './Modal';

// Adds extra items to a still-pending order — e.g. the customer orders more before the
// bill is settled. Shared by the Orders page and the Customers page (editing a debt
// order's items keeps Customer.balance in sync server-side — see /orders/:id/items).
export function AddItemsModal({ order, onClose, onAdded, addToast }) {
  const [products, setProducts] = useState(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/restaurant/products').then((r) => setProducts(r.data.filter((p) => p.status === 'active')));
  }, []);

  const visible = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.en.toLowerCase().includes(q) || p.so.toLowerCase().includes(q));
  }, [products, query]);

  const lines = useMemo(() => {
    if (!products) return [];
    return Object.entries(cart).map(([pid, qty]) => ({ product: products.find((p) => p.id === pid), qty })).filter((l) => l.product);
  }, [cart, products]);
  const addTotal = lines.reduce((a, l) => a + l.product.price * l.qty, 0);

  function inc(pid) { setCart((c) => ({ ...c, [pid]: (c[pid] || 0) + 1 })); }
  function dec(pid) {
    setCart((c) => {
      const next = { ...c };
      if (!next[pid]) return c;
      next[pid] -= 1;
      if (next[pid] <= 0) delete next[pid];
      return next;
    });
  }

  async function submit() {
    if (!lines.length || busy) return;
    setBusy(true);
    try {
      const items = lines.map((l) => ({ productId: l.product.id, qty: l.qty }));
      const { data } = await api.post(`/restaurant/orders/${order.id}/items`, { items });
      onAdded(data);
      addToast({ title: 'Waa la daray · Items added', body: `#${data.number}`, tone: 'success' });
      onClose();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to add items', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Ku dar alaab · Add items</div>
      <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 14 }}>Order #{order.number}</div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-3)' }} />
        <input className="field-input" style={{ paddingLeft: 32 }} placeholder="Raadi cunto…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!products && <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>Loading…</div>}
      <div style={{ maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
        {visible.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.en}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>${p.price.toFixed(2)}</div>
            </div>
            <button onClick={() => dec(p.id)} disabled={!cart[p.id]} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--muted-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={12} /></button>
            <span className="mono" style={{ minWidth: 16, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{cart[p.id] || 0}</span>
            <button onClick={() => inc(p.id)} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={12} /></button>
          </div>
        ))}
        {products && !visible.length && <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>Wax lama helin · No products.</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>{lines.length ? `+ $${addTotal.toFixed(2)}` : ''}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline" onClick={onClose}>Ka noqo · Cancel</button>
          <button className="btn btn-primary" disabled={!lines.length || busy} onClick={submit}>{busy ? 'Diraya…' : 'Ku dar · Add'}</button>
        </div>
      </div>
    </Modal>
  );
}

// Edits (reduces or removes) the CURRENT items on a still-pending order, and — if the
// signed-in user has the discount permission — its discount too. Getting a line to 0
// drops it from the list; the order must end up with at least one item (use Delete on
// the whole order for "the customer doesn't want any of it" — the backend enforces this
// too). Shared by the Orders page and the Customers page.
export function EditItemsModal({ order, onClose, onUpdated, addToast, canDiscount = true }) {
  const [items, setItems] = useState(() => order.items.map((it) => ({ ...it })));
  const [discount, setDiscount] = useState(String(order.discount || ''));
  const [busy, setBusy] = useState(false);

  function setQty(i, qty) {
    setItems((prev) => {
      const next = [...prev];
      if (qty <= 0) { next.splice(i, 1); return next; }
      next[i] = { ...next[i], qty };
      return next;
    });
  }

  const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
  const discountNum = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = subtotal - discountNum;
  const changed = items.length !== order.items.length
    || items.some((it, i) => it.qty !== order.items[i]?.qty)
    || discountNum !== (order.discount || 0);

  async function submit() {
    if (!items.length || busy || !changed) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/restaurant/orders/${order.id}/items`, {
        items: items.map(({ name, qty, price }) => ({ name, qty, price })),
        discount: discountNum,
      });
      onUpdated(data);
      addToast({ title: 'Dalabka waa la beddelay · Order updated', body: `#${data.number}`, tone: 'success' });
      onClose();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to update', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={440}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Wax ka beddel dalabka · Edit order</div>
      <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 14 }}>Order #{order.number}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>${it.price.toFixed(2)} · ${(it.price * it.qty).toFixed(2)}</div>
            </div>
            <button onClick={() => setQty(i, it.qty - 1)} style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--muted-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={12} /></button>
            <span className="mono" style={{ minWidth: 16, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{it.qty}</span>
            <button onClick={() => setQty(i, it.qty + 1)} style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={12} /></button>
            <button onClick={() => setQty(i, 0)} title="Ka saar · Remove" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
          </div>
        ))}
        {!items.length && (
          <div style={{ padding: '16px 4px', fontSize: 12.5, color: 'var(--danger)' }}>
            Dalabku waa in uu haystaa ugu yaraan hal alaab — haddii aadan waxba rabin, Delete isticmaal ·
            An order needs at least one item — use Delete on the whole order if none should remain.
          </div>
        )}
      </div>
      {canDiscount && (
        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Dhimis · Discount</label>
          <input
            type="number" min="0" step="0.01" max={subtotal} className="field-input"
            placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>${total.toFixed(2)}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline" onClick={onClose}>Ka noqo · Cancel</button>
          <button className="btn btn-primary" disabled={!items.length || busy || !changed} onClick={submit}>{busy ? 'Keydinaya…' : 'Keydi · Save'}</button>
        </div>
      </div>
    </Modal>
  );
}
