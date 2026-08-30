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

function newClientRequestId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function declineMeta(info) {
  const reason = String(info.reason || '').toLowerCase();
  if (reason.includes('kuguma filna') || reason.includes('kuma filna') || reason.includes('insufficient')) {
    return {
      tone: 'danger', icon: '💳',
      title: { so: 'Haraaga akoonkaagu kugu ma filna', en: 'Insufficient balance in your account' },
      so: null, en: null, hint: null,
    };
  }
  if (info.needsManualVerification) {
    return {
      tone: 'warning', icon: '⏱',
      so: 'Waqtigii xaqiijinta ayaa dhammaaday — waxaa laga yaabaa in lacagtu la qaaday.',
      en: 'The confirmation timed out — your payment may or may not have gone through.',
      hint: {
        so: 'Fadlan la xiriir shaqaalaha maqaayada si loo hubiyo kahor inta aadan mar kale isku dayin.',
        en: 'Please check with restaurant staff to confirm before trying again.',
      },
    };
  }
  if (!info.allowRetry) {
    return { tone: 'danger', icon: '✕', so: info.error, en: null, hint: null };
  }
  return {
    tone: 'danger', icon: '✕',
    so: 'Lacagta maadan Aqbalin.',
    en: 'Payment was declined.',
   
  };
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
  const [paymentProvider, setPaymentProvider] = useState(null);
  const [clientRequestId, setClientRequestId] = useState(newClientRequestId);
  const [declineInfo, setDeclineInfo] = useState(null);

  useEffect(() => {
    api.get(`/public/menu/${code}`).then((r) => {
      setMenu(r.data);
      setPaymentProvider(r.data.defaultProvider || null);
    }).catch((e) => setError(apiErrorMessage(e, 'Invalid QR code')));
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

  const paymentOptions = menu?.paymentOptions || [];
  const hasPayment = paymentOptions.length > 0;
  const providerLabel = (key) => paymentOptions.find((p) => p.provider === key)?.label || key;

  function orderItemLines() {
    return Object.entries(cart).map(([pid, qty]) => {
      const p = menu.products.find((x) => x.id === pid);
      return { txt: `${qty}× ${p.en}` };
    });
  }

  async function placeOrder() {
    if (!phone.trim()) { setPhoneError(true); return; }
    setPlacing(true); setPlaceError(''); setDeclineInfo(null);
    setStep(hasPayment ? 'paying' : 'sending');
    try {
      const items = Object.entries(cart).map(([productId, qty]) => ({ productId, qty }));
      const { data } = await api.post('/public/orders', {
        code, phone: phone.trim(), note: note.trim(), items,
        paymentProvider: hasPayment ? paymentProvider : undefined,
        clientRequestId: hasPayment ? clientRequestId : undefined,
      }, { timeout: 50000 });
      setLastOrder({ number: data.number, items: orderItemLines(), total: cartTotal, payment: data.payment || null });
      setStep('placed');
    } catch (e) {
      const res = e?.response?.data;
      if (e?.response?.status === 402 && res?.orderId) {
        setDeclineInfo(res);
        setStep('declined');
      } else {
        setPlaceError(apiErrorMessage(e, 'Failed to place order'));
        setStep('cart');
      }
    } finally {
      setPlacing(false);
    }
  }

  async function retryPayment() {
    setClientRequestId(newClientRequestId());
    setDeclineInfo(null);
    setStep('cart');
  }

  async function payAtTableFallback() {
    if (!declineInfo?.orderId) return;
    setPlacing(true);
    try {
      const { data } = await api.post(`/public/orders/${declineInfo.orderId}/pay-at-table`);
      setLastOrder({ number: data.number, items: orderItemLines(), total: cartTotal, payment: { status: 'none', method: 'pay_at_table' } });
      setDeclineInfo(null);
      setStep('placed');
    } catch (e) {
      setPlaceError(apiErrorMessage(e, 'Failed to switch to pay at table'));
    } finally {
      setPlacing(false);
    }
  }

  function resetAll() {
    setStep('menu'); setCart({}); setPhone(''); setPhoneError(false); setNote(''); setLastOrder(null); setPlaceError('');
    setDeclineInfo(null); setClientRequestId(newClientRequestId());
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
              placeholder="061 xxxxxxx" value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(false); }}
            />
            {phoneError && <div style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Waa lagama maarmaan · Phone number is required</div>}
            <label className="field-label">Faah faahin · Note (optional)</label>
            <textarea
              className="field-input" style={{ marginBottom: 14, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Tusaale: aan lasoo darin basal · e.g. no onions" value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {paymentOptions.length > 1 && (
              <>
                <label className="field-label">Sida aad ku bixineyso · Pay with</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {paymentOptions.map((p) => (
                    <button
                      key={p.provider} type="button"
                      className={'chip' + (paymentProvider === p.provider ? ' active' : '')}
                      onClick={() => setPaymentProvider(p.provider)}
                    >{p.label}</button>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 14px' }}>
              <span style={{ color: 'var(--muted-1)', fontWeight: 600 }}>Wadarta · Total</span>
              <span style={{ fontWeight: 800, fontSize: 20 }}>${cartTotal.toFixed(2)}</span>
            </div>
            {placeError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{placeError}</div>}
            <button className="btn btn-primary" style={{ width: '100%', padding: 15, borderRadius: 14, fontSize: 15 }} onClick={placeOrder} disabled={placing}>
              {placing ? 'Diraya…' : 'Dir dalabka · Place order'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted-3)', marginTop: 10 }}>
              {hasPayment
                ? `Waxaad ku bixinaysaa · Paying via ${providerLabel(paymentProvider)}`
                : "Lacagta waxaad bixin doontaa miiska · Pay at table (online pay soon)"}
            </div>
          </div>
        </div>
      )}

      {step === 'paying' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 26px', minHeight: '100vh' }}>
          <div className="pay-ping-wrap">
            <span className="pay-ping" />
            <span className="pay-ping" style={{ animationDelay: '.8s' }} />
            <span className="pay-ping" style={{ animationDelay: '1.6s' }} />
            <div className="pay-icon">📱</div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            Fadlan hubi taleefankaaga
            <span className="pay-dots">
              <span className="pay-dot" /><span className="pay-dot" /><span className="pay-dot" />
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted-1)', marginBottom: 4 }}>Confirm the payment prompt on {phone}</div>
          <div className="pay-progress"><div className="pay-progress-bar" /></div>
          <div style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 14 }}>Kani wuxuu qaadan karaa ilaa 45 sekend · This can take up to 45 seconds</div>
        </div>
      )}

      {step === 'sending' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 26px', minHeight: '100vh' }}>
          <div className="pay-ping-wrap">
            <span className="pay-ping" />
            <span className="pay-ping" style={{ animationDelay: '.8s' }} />
            <span className="pay-ping" style={{ animationDelay: '1.6s' }} />
            <div className="pay-icon">🧾</div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            Dalabkaaga waa la diraynaa
            <span className="pay-dots">
              <span className="pay-dot" /><span className="pay-dot" /><span className="pay-dot" />
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted-1)', marginBottom: 4 }}>Sending your order to the kitchen · {phone}</div>
          <div className="pay-progress"><div className="pay-progress-bar" /></div>
        </div>
      )}

      {step === 'declined' && declineInfo && (() => {
        const meta = declineMeta(declineInfo);
        const isWarning = meta.tone === 'warning';
        const ref = declineInfo.orderId ? String(declineInfo.orderId).slice(-6).toUpperCase() : null;
        return (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 22px', minHeight: '100vh' }}>
            <div
              className="card"
              style={{
                width: '100%', maxWidth: 380, padding: '34px 28px', textAlign: 'center',
                boxShadow: '0 30px 70px -30px rgba(16,26,43,.35)', animation: 'cardIn .35s cubic-bezier(.2,.8,.2,1)',
              }}
            >
              <div
                style={{
                  width: 72, height: 72, borderRadius: 99, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, animation: 'badgeIn .45s cubic-bezier(.2,.8,.2,1)',
                  background: isWarning ? 'var(--warning-bg)' : 'var(--danger-bg)',
                  color: isWarning ? 'var(--warning-fg)' : 'var(--danger)',
                }}
              >
                {meta.icon}
              </div>

              <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 4 }}>
                {meta.title ? `${meta.title.so} · ${meta.title.en}` : declineInfo.error}
              </div>

              {meta.en && (
                <div style={{ fontSize: 13.5, color: 'var(--muted-1)', lineHeight: 1.55, marginTop: 10 }}>
                  <div>{meta.so}</div>
                  <div style={{ color: 'var(--muted-2)', marginTop: 2 }}>{meta.en}</div>
                </div>
              )}

              {meta.hint && (
                <div
                  style={{
                    fontSize: 12.5, lineHeight: 1.5, marginTop: 12, padding: '10px 13px', borderRadius: 11, textAlign: 'left',
                    background: isWarning ? 'var(--warning-bg)' : 'var(--panel)',
                    border: `1px solid ${isWarning ? 'var(--warning)' : 'var(--border-soft)'}`,
                    color: isWarning ? 'var(--warning-fg)' : 'var(--muted-2)',
                  }}
                >
                  <div>{meta.hint.so}</div>
                  <div style={{ opacity: .85, marginTop: 2 }}>{meta.hint.en}</div>
                </div>
              )}

              {ref && (
                <div className="mono" style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: 'var(--muted-3)',
                  background: 'var(--panel)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '5px 11px', marginTop: 18,
                }}>
                  Reference · {ref}
                </div>
              )}

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
                {declineInfo.allowRetry && (
                  <button className="btn btn-primary" style={{ width: '100%', padding: 14, borderRadius: 14 }} onClick={retryPayment} disabled={placing}>
                    Isku day mar kale · Try again
                  </button>
                )}
                {declineInfo.allowPayAtTable && (
                  <button className="btn-outline" style={{ width: '100%', padding: 14, borderRadius: 14 }} onClick={payAtTableFallback} disabled={placing}>
                    Bixi miiska · Pay at table instead
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {step === 'placed' && lastOrder && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 26px', minHeight: '100vh' }}>
          <div style={{ width: 84, height: 84, borderRadius: 99, background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, marginBottom: 20 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 22 }}>Dalabka waa la diray!</div>
          <div style={{ fontSize: 14, color: 'var(--muted-1)', marginBottom: 4 }}>Order sent to the kitchen</div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginBottom: 8 }}>#{lastOrder.number} · {cm.icon} {cm.label}</div>
          {lastOrder.payment?.status === 'paid' && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 12 }}>
              ✓ Lacagta ${lastOrder.total.toFixed(2)} waa la bixiyay · Paid via {providerLabel(paymentProvider)}
            </div>
          )}
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
