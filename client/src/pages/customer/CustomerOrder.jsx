import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../../lib/api';

function imgStyle(hue) {
  return { background: `repeating-linear-gradient(135deg, hsl(${hue} 45% 91%) 0 9px, hsl(${hue} 45% 87%) 9px 18px)` };
}

function channelMeta(type, label) {
  if (type === 'online') return { label: 'Online order', icon: '🌐', sub: 'Online order · online' };
  if (type === 'takeaway') return { label: 'Takeaway', icon: '🛒', sub: "Miis la'aan" };
  return { label: 'Miis ' + label, icon: '📍', sub: 'Isku dalbo · self order' };
}

export default function CustomerOrder() {
  const { code } = useParams();
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState({});
  const [step, setStep] = useState('menu');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [note, setNote] = useState('');
  const [lastOrder, setLastOrder] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');

  useEffect(() => {
    api.get(`/public/menu/${code}`).then((r) => setMenu(r.data)).catch((e) => setError(apiErrorMessage(e, 'Invalid QR code')));
  }, [code]);

  const categories = useMemo(() => [{ id: 'all', en: 'All', so: 'Dhammaan' }, ...(menu?.categories || [])], [menu]);
  const products = useMemo(() => (menu?.products || []).filter((p) => cat === 'all' || p.category === cat), [menu, cat]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [pid, qty]) => {
    const p = menu?.products.find((x) => x.id === pid);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  function addToCart(pid) { setCart((c) => ({ ...c, [pid]: (c[pid] || 0) + 1 })); }
  function decCart(pid) {
    setCart((c) => {
      const next = { ...c };
      if (!next[pid]) return c;
      next[pid] -= 1;
      if (next[pid] <= 0) delete next[pid];
      return next;
    });
  }

  async function placeOrder() {
    if (!phone.trim()) { setPhoneError(true); return; }
    setPlacing(true); setPlaceError('');
    try {
      const items = Object.entries(cart).map(([productId, qty]) => ({ productId, qty }));
      const { data } = await api.post('/public/orders', { code, phone: phone.trim(), note: note.trim(), items });
      setLastOrder({
        number: data.number,
        items: Object.entries(cart).map(([pid, qty]) => {
          const p = menu.products.find((x) => x.id === pid);
          return { txt: `${qty}× ${p.en}` };
        }),
        total: cartTotal,
      });
      setStep('placed');
    } catch (e) {
      setPlaceError(apiErrorMessage(e, 'Failed to place order'));
    } finally {
      setPlacing(false);
    }
  }

  function resetAll() {
    setStep('menu'); setCart({}); setPhone(''); setPhoneError(false); setNote(''); setLastOrder(null); setPlaceError('');
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>QR code-kan ma shaqeynayo</div>
          <div style={{ color: 'var(--muted-1)', fontSize: 14 }}>{error}</div>
        </div>
      </div>
    );
  }
  if (!menu) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="text-muted">Loading…</div>;

  const cm = channelMeta(menu.table.type, menu.table.label);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {step === 'menu' && (
        <>
          <div style={{ flex: 1, overflow: 'auto', paddingBottom: cartCount > 0 ? 90 : 20 }}>
            <div style={{ height: 150, position: 'relative', ...(menu.restaurant.coverUrl ? { backgroundImage: `url(${menu.restaurant.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `repeating-linear-gradient(135deg, hsl(${menu.restaurant.hue} 45% 88%) 0 12px, hsl(${menu.restaurant.hue} 45% 83%) 12px 24px)` }) }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(14,26,43,.55))' }} />
              <div style={{ position: 'absolute', left: 16, bottom: 14, right: 16, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div style={{ width: 54, height: 54, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: 'var(--accent)', flex: '0 0 auto', overflow: 'hidden' }}>
                  {menu.restaurant.logoUrl ? <img src={menu.restaurant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : menu.restaurant.name[0]}
                </div>
                <div style={{ color: '#fff', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{menu.restaurant.name}</div>
                  <div style={{ fontSize: 12, opacity: .9 }}>{menu.restaurant.city}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 16px 6px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'color-mix(in srgb, var(--accent) 8%, #fff)', color: 'var(--accent)', fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                {cm.icon} {cm.label} <span style={{ opacity: .7, fontWeight: 600 }}>· {cm.sub}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 16px' }}>
              {categories.map((c) => (
                <button key={c.id} className={'chip' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)}>{c.en}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 16px 12px' }}>
              {products.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 15, padding: 10 }}>
                    <div style={{ width: 66, height: 66, borderRadius: 12, flex: '0 0 auto', overflow: 'hidden', ...(p.imageUrl ? {} : imgStyle(p.hue)) }}>
                      {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.en}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 5 }}>{p.so}</div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>${p.price.toFixed(2)}</div>
                    </div>
                    {qty > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                        <button style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: 'var(--muted-4)' }} onClick={() => decCart(p.id)}>−</button>
                        <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 800 }}>{qty}</span>
                        <button style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer' }} onClick={() => addToCart(p.id)}>+</button>
                      </div>
                    ) : (
                      <button style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 11, border: 'none', background: 'color-mix(in srgb, var(--accent) 12%, #fff)', color: 'var(--accent)', fontSize: 22, fontWeight: 700, cursor: 'pointer' }} onClick={() => addToCart(p.id)}>+</button>
                    )}
                  </div>
                );
              })}
              {!products.length && <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>No items in this category.</div>}
            </div>
          </div>
          {cartCount > 0 && (
            <div style={{ position: 'sticky', bottom: 0, padding: '0 14px 16px', background: 'linear-gradient(180deg, transparent, #fff 30%)' }}>
              <button className="btn btn-primary" style={{ width: '100%', padding: 15, borderRadius: 15, fontSize: 15 }} onClick={() => setStep('cart')}>
                <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 8, padding: '2px 9px', fontSize: 13 }}>{cartCount}</span>
                Fiiri dalabka · View cart
                <span style={{ marginLeft: 'auto' }}>${cartTotal.toFixed(2)}</span>
              </button>
            </div>
          )}
        </>
      )}

      {step === 'cart' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 16px 12px', borderBottom: '1px solid var(--border-soft)' }}>
            <button style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: '#fff', fontSize: 18, cursor: 'pointer' }} onClick={() => setStep('menu')}>←</button>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Dalabkaaga · Your order</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{cm.icon} {cm.label}</div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(cart).map(([pid, qty]) => {
              const p = menu.products.find((x) => x.id === pid);
              return (
                <div key={pid} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '10px 12px' }}>
                  <div style={{ flex: 1, lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.en}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>${(p.price * qty).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: 17, cursor: 'pointer', color: 'var(--muted-4)' }} onClick={() => decCart(pid)}>−</button>
                    <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 800 }}>{qty}</span>
                    <button style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 17, cursor: 'pointer' }} onClick={() => addToCart(pid)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: '1px solid var(--border-soft)', padding: 16 }}>
            <label className="field-label">Lambarka taleefanka · Phone number *</label>
            <input
              className={'field-input' + (phoneError ? ' error' : '')} style={{ marginBottom: phoneError ? 4 : 14 }}
              placeholder="063 xxxxxxx" value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(false); }}
            />
            {phoneError && <div style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Waa lagama maarmaan · Phone number is required</div>}
            <label className="field-label">Faah faahin · Note (optional)</label>
            <textarea
              className="field-input" style={{ marginBottom: 14, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Tusaale: aan lasoo darin basal · e.g. no onions" value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 14px' }}>
              <span style={{ color: 'var(--muted-1)', fontWeight: 600 }}>Wadarta · Total</span>
              <span style={{ fontWeight: 800, fontSize: 20 }}>${cartTotal.toFixed(2)}</span>
            </div>
            {placeError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{placeError}</div>}
            <button className="btn btn-primary" style={{ width: '100%', padding: 15, borderRadius: 14, fontSize: 15 }} onClick={placeOrder} disabled={placing}>
              {placing ? 'Diraya…' : 'Dir dalabka · Place order'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted-3)', marginTop: 10 }}>Lacagta waxaad bixin doontaa miiska · Pay at table (online pay soon)</div>
          </div>
        </div>
      )}

      {step === 'placed' && lastOrder && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 26px', minHeight: '100vh' }}>
          <div style={{ width: 84, height: 84, borderRadius: 99, background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, marginBottom: 20 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 22 }}>Dalabka waa la diray!</div>
          <div style={{ fontSize: 14, color: 'var(--muted-1)', marginBottom: 4 }}>Order sent to the kitchen</div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginBottom: 20 }}>#{lastOrder.number} · {cm.icon} {cm.label}</div>
          <div style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '14px 16px', textAlign: 'left', marginBottom: 8 }}>
            {lastOrder.items.map((i, idx) => <div key={idx} style={{ fontSize: 13, color: 'var(--muted-5)', padding: '3px 0' }}>{i.txt}</div>)}
            <div style={{ borderTop: '1px dashed var(--border-strong)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Total</span><span>${lastOrder.total.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', margin: '14px 0 20px' }}>🔔 Maqaayada ayaa la ogeysiiyay cod leh · Restaurant notified with sound</div>
          <button className="btn btn-ghost" style={{ width: '100%', padding: 13 }} onClick={resetAll}>Dib ugu noqo menu-ka · Back to menu</button>
        </div>
      )}
    </div>
  );
}
