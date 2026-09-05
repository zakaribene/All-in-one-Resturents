import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Plus, Minus, Trash2, Phone, StickyNote, Wallet, HandCoins, Lock } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import ReceiptModal from '../../components/ReceiptModal';

const pinKeyStyle = {
  height: 56, fontSize: 20, fontWeight: 700, borderRadius: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function imgStyle(hue) {
  return {
    background: `repeating-linear-gradient(135deg, hsl(${hue} 70% 55% / .16) 0 9px, hsl(${hue} 70% 55% / .26) 9px 18px), var(--panel)`,
  };
}

function declineMeta(info) {
  const reason = String(info.reason || '').toLowerCase();
  if (reason.includes('kuguma filna') || reason.includes('kuma filna') || reason.includes('insufficient')) {
    return { title: { so: 'Xisaabta macmiilku ma filna', en: 'Insufficient balance in the customer account' }, hint: null };
  }
  if (info.needsManualVerification) {
    return {
      title: null,
      hint: {
        so: 'Waqtigii xaqiijinta ayaa dhammaaday — waxaa laga yaabaa in lacagtu la qaaday. Hubi macmiilka kahor inta aad isku dayin mar kale.',
        en: 'The confirmation timed out — the charge may have gone through. Check with the customer before retrying.',
      },
    };
  }
  return {
    title: null,
    hint: { so: 'Lacagtu lama qaadin.', en: 'The customer has not been charged.' },
  };
}

export default function Pos() {
  const { addToast, me, posLocked, setPosLocked } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState({});
  const [discount, setDiscount] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [note, setNote] = useState('');
  const [payNow, setPayNow] = useState(true);
  const [provider, setProvider] = useState(null);
  const [stage, setStage] = useState('cart');
  const [declineInfo, setDeclineInfo] = useState(null);
  const [placeError, setPlaceError] = useState('');
  const [clientRequestId, setClientRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [pin, setPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const posPinRequired = !!me?.posPinRequired;
  const noPin = posPinRequired && me?.hasPosPin === false;
  // `posLocked` lives in RestaurantLayout so the lock persists across navigation
  // and can be triggered by the idle timer for POS-only staff.

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/restaurant/categories'),
      api.get('/restaurant/products'),
      api.get('/restaurant/pos/payment-options'),
    ]).then(([c, p, po]) => {
      setCategories(c.data);
      setProducts(p.data.filter((x) => x.status === 'active'));
      setPaymentOptions(po.data.paymentOptions);
      setProvider(po.data.defaultProvider);
      setPayNow(!!po.data.paymentOptions.length);
    }).finally(() => setLoading(false));
  }, []);

  async function submitPin(value) {
    setUnlocking(true); setUnlockError('');
    try {
      await api.post('/restaurant/pos/unlock', { pin: value });
      setPosLocked(false); setPin('');
    } catch (e) {
      setUnlockError(apiErrorMessage(e, 'Wrong PIN'));
      setPin('');
    } finally {
      setUnlocking(false);
    }
  }

  function pressKey(k) {
    if (unlocking) return;
    setUnlockError('');
    if (k === 'del') { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) submitPin(next);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false;
      if (q && !p.en.toLowerCase().includes(q) && !p.so.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, cat, query]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([pid, qty]) => ({ product: products.find((p) => p.id === pid), qty }))
      .filter((l) => l.product);
  }, [cart, products]);
  const cartCount = cartLines.reduce((a, l) => a + l.qty, 0);
  const subtotal = cartLines.reduce((a, l) => a + l.product.price * l.qty, 0);
  const canDiscount = me?.role !== 'staff' || me?.permissions?.includes('pos_discount');
  const discountAmount = canDiscount ? Math.min(Math.max(0, Number(discount) || 0), subtotal) : 0;
  const total = subtotal - discountAmount;
  const useOnlinePay = payNow && paymentOptions.length > 0;

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
  function removeCart(pid) {
    setCart((c) => { const next = { ...c }; delete next[pid]; return next; });
  }

  function resetOrder() {
    setCart({}); setDiscount(''); setPhone(''); setPhoneError(false); setNote(''); setStage('cart');
    setDeclineInfo(null); setPlaceError(''); setClientRequestId('');
  }

  async function submit() {
    if (!cartLines.length) return;
    if (useOnlinePay && !phone.trim()) { setPhoneError(true); return; }
    setPlaceError(''); setBusy(true);
    if (useOnlinePay) setStage('paying');
    try {
      const items = cartLines.map((l) => ({ productId: l.product.id, qty: l.qty }));
      const crid = useOnlinePay ? (clientRequestId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))) : undefined;
      if (crid) setClientRequestId(crid);
      const { data } = await api.post('/restaurant/pos/orders', {
        phone: phone.trim(), note: note.trim(), items, discount: discountAmount,
        payNow: useOnlinePay, paymentProvider: useOnlinePay ? provider : undefined,
        clientRequestId: crid,
      }, { timeout: 50000 });
      addToast({ title: 'Dalabka waa la diray · Order sent to kitchen', body: `#${data.number} · $${total.toFixed(2)}`, tone: 'success' });
      resetOrder();
      if (!useOnlinePay) setReceiptOrder(data);
    } catch (e) {
      const res = e?.response?.data;
      if (e?.response?.status === 402 && res?.orderId) {
        setDeclineInfo(res);
        setStage('declined');
      } else {
        setPlaceError(apiErrorMessage(e, 'Failed to place order'));
        setStage('cart');
      }
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setClientRequestId('');
    setDeclineInfo(null);
    setStage('cart');
  }

  async function fallbackManual() {
    if (!declineInfo?.orderId) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/restaurant/pos/orders/${declineInfo.orderId}/pay-at-table`, {});
      addToast({ title: 'Dalabka waa la diray · Order sent to kitchen', body: `#${data.number} · Manual pay`, tone: 'success' });
      resetOrder();
      setReceiptOrder(data);
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const catName = (id) => categories.find((c) => c.id === id)?.en || '';

  if (noPin) {
    return (
      <div className="card card-pad" style={{ textAlign: 'center', padding: 50, maxWidth: 460, margin: '40px auto' }}>
        <Lock size={30} strokeWidth={1.75} color="var(--danger)" style={{ marginBottom: 12 }} />
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>PIN weli laguuma dejin · No POS PIN set</div>
        <div style={{ color: 'var(--muted-1)', fontSize: 13 }}>
          Weydiiso milkiilaha inuu PIN POS 4-lambar ah kuu sameeyo bogga Shaqaalaha ·
          Ask the owner to set your 4-digit POS PIN on the Staff page.
        </div>
      </div>
    );
  }

  if (posLocked) {
    return (
      <div style={{ maxWidth: 320, margin: '32px auto', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Lock size={24} strokeWidth={2} color="var(--muted-4)" />
        </div>
        <div style={{ fontWeight: 800, fontSize: 17 }}>POS waa xiran yahay · POS locked</div>
        <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4, marginBottom: 22 }}>
          Geli PIN-kaaga 4-lambar ah · Enter your 4-digit PIN{me?.staffName ? ` · ${me.staffName}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{
              width: 14, height: 14, borderRadius: 99,
              background: i < pin.length ? 'var(--accent)' : 'var(--border-strong)',
              transition: 'background .15s',
            }} />
          ))}
        </div>
        {unlockError && <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{unlockError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} className="btn-outline" style={pinKeyStyle} disabled={unlocking} onClick={() => pressKey(k)}>{k}</button>
          ))}
          <span />
          <button className="btn-outline" style={pinKeyStyle} disabled={unlocking} onClick={() => pressKey('0')}>0</button>
          <button className="btn-outline" style={pinKeyStyle} disabled={unlocking || !pin.length} onClick={() => pressKey('del')}>⌫</button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: 24 }}>POS · Dalab macmiil</h1>
            <p className="page-sub">U samee dalab macmiil markuu QR-ka ku dhibtoonaayo · Take an order on the customer's behalf.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {posPinRequired && (
              <button
                className="btn-outline" title="Xir POS · Lock POS"
                style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                onClick={() => { setPosLocked(true); setPin(''); setUnlockError(''); }}
              >
                <Lock size={14} strokeWidth={2.25} /> Xir · Lock
              </button>
            )}
            <div style={{ position: 'relative', minWidth: 220 }}>
              <Search size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-3)' }} />
              <input className="field-input" style={{ paddingLeft: 32 }} placeholder="Raadi cunto…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <button className={'chip' + (cat === 'all' ? ' active' : '')} onClick={() => setCat('all')}>All · Dhammaan</button>
          {categories.map((c) => (
            <button key={c.id} className={'chip' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)}>{c.en}</button>
          ))}
        </div>

        {loading && <div className="text-muted">Loading…</div>}
        {!loading && !products.length && (
          <div className="card card-pad text-muted">Weli cunto ma jirto · Add products first.</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {visible.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p.id)}
              className="card"
              style={{ overflow: 'hidden', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', padding: 0, fontFamily: 'inherit' }}
            >
              <div style={{ height: 80, position: 'relative', ...(p.imageUrl ? {} : imgStyle(p.hue)) }}>
                {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {!!cart[p.id] && (
                  <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 99, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                    {cart[p.id]}
                  </span>
                )}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.en}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{catName(p.category)}</div>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>${p.price.toFixed(2)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ position: 'sticky', top: 18, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 68px)' }}>
        {stage === 'cart' && (
          <>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Dalabka · Order</span>
              <span className="pill" style={{ background: 'var(--panel-2)', color: 'var(--muted-4)' }}>{cartCount} items</span>
            </div>
            <div style={{ overflow: 'auto', flex: 1, padding: '6px 18px', minHeight: 80 }}>
              {!cartLines.length && <div className="text-muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Weli waxba lama darin · Cart is empty.</div>}
              {cartLines.map((l) => (
                <div key={l.product.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.product.en}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>${l.product.price.toFixed(2)} × {l.qty}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => decCart(l.product.id)} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--muted-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={12} /></button>
                    <span className="mono" style={{ minWidth: 16, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{l.qty}</span>
                    <button onClick={() => addToCart(l.product.id)} style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={12} /></button>
                    <button onClick={() => removeCart(l.product.id)} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 2 }}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border-soft)', padding: 18 }}>
              <label className="field-label">
                Lambarka macmiilka · Customer phone {useOnlinePay ? '*' : <span style={{ color: 'var(--muted-3)', fontWeight: 500 }}>(ikhtiyaari · optional)</span>}
              </label>
              <div style={{ position: 'relative', marginBottom: phoneError ? 4 : 12 }}>
                <Phone size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-3)' }} />
                <input
                  className={'field-input' + (phoneError ? ' error' : '')} style={{ paddingLeft: 32 }}
                  placeholder="063 xxxxxxx" value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(false); }}
                />
              </div>
              {phoneError && <div style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Waa lagama maarmaan · Phone number is required</div>}

              <label className="field-label">Faah faahin · Note (optional)</label>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <StickyNote size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted-3)' }} />
                <textarea
                  className="field-input" style={{ paddingLeft: 32, minHeight: 50, resize: 'vertical', fontFamily: 'inherit' }}
                  value={note} onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {!!paymentOptions.length && (
                <>
                  <label className="field-label">Lacag-bixinta · Payment</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button
                      type="button"
                      className={'chip' + (payNow ? ' active' : '')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => setPayNow(true)}
                    >
                      <Wallet size={13} strokeWidth={2.25} /> Bixi hadda · Pay now
                    </button>
                    <button
                      type="button"
                      className={'chip' + (!payNow ? ' active' : '')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => setPayNow(false)}
                    >
                      <HandCoins size={13} strokeWidth={2.25} /> Manual
                    </button>
                  </div>
                  {payNow && paymentOptions.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                      {paymentOptions.map((p) => (
                        <button key={p.provider} type="button" className={'chip' + (provider === p.provider ? ' active' : '')} onClick={() => setProvider(p.provider)}>{p.label}</button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {canDiscount && (
                <>
                  <label className="field-label">Dhimis · Discount ($)</label>
                  <input
                    type="number" min="0" step="0.01" className="field-input" style={{ marginBottom: 12 }}
                    placeholder="0.00" value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0 2px' }}>
                <span style={{ color: 'var(--muted-2)', fontSize: 13 }}>Wadarta hoose · Subtotal</span>
                <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span style={{ color: 'var(--danger)', fontSize: 13 }}>Dhimis · Discount</span>
                  <span style={{ fontSize: 13, color: 'var(--danger)' }}>−${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0 14px' }}>
                <span style={{ color: 'var(--muted-1)', fontWeight: 600 }}>Wadarta · Total</span>
                <span style={{ fontWeight: 800, fontSize: 20 }}>${total.toFixed(2)}</span>
              </div>

              {placeError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{placeError}</div>}

              <button className="btn btn-primary" style={{ width: '100%', padding: 14, borderRadius: 14 }} disabled={!cartLines.length || busy} onClick={submit}>
                {busy ? 'Diraya…' : (payNow && paymentOptions.length ? 'Bixi & Dir · Charge & send' : 'Dir dalabka · Send order')}
              </button>
            </div>
          </>
        )}

        {stage === 'paying' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px' }}>
            <div className="pay-ping-wrap" style={{ width: 80, height: 80, marginBottom: 18 }}>
              <span className="pay-ping" />
              <span className="pay-ping" style={{ animationDelay: '.8s' }} />
              <div className="pay-icon" style={{ width: 60, height: 60, fontSize: 26 }}>📱</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Sug xaqiijinta macmiilka</div>
            <div style={{ fontSize: 13, color: 'var(--muted-1)' }}>Waiting for customer to confirm on {phone}</div>
          </div>
        )}

        {stage === 'declined' && declineInfo && (() => {
          const meta = declineMeta(declineInfo);
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 24px' }}>
              <div style={{ width: 60, height: 60, borderRadius: 99, background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>✕</div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                {meta.title ? `${meta.title.so} · ${meta.title.en}` : declineInfo.error}
              </div>
              {meta.hint && (
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.5, marginTop: 8 }}>
                  <div>{meta.hint.so}</div>
                  <div style={{ opacity: .85 }}>{meta.hint.en}</div>
                </div>
              )}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
                {declineInfo.allowRetry && (
                  <button className="btn btn-primary" style={{ width: '100%', padding: 13, borderRadius: 12 }} onClick={retry} disabled={busy}>
                    Isku day mar kale · Try again
                  </button>
                )}
                {declineInfo.allowPayAtTable && (
                  <button className="btn-outline" style={{ width: '100%', padding: 13, borderRadius: 12 }} onClick={fallbackManual} disabled={busy}>
                    U beddel manual · Switch to manual pay
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
    {receiptOrder && <ReceiptModal order={receiptOrder} restaurant={me} onClose={() => setReceiptOrder(null)} />}
    </>
  );
}
