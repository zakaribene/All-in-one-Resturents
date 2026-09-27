import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, HandCoins, Phone, Receipt, Wallet, Printer, Plus, Pencil } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';
import ReceiptModal from '../../components/ReceiptModal';
import { AddItemsModal, EditItemsModal } from '../../components/OrderItemsModals';

const money = (n) => '$' + Number(n || 0).toFixed(2);

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return new Date(date).toLocaleDateString();
}

function fullDate(date) {
  return new Date(date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// A printable statement of what a customer currently owes — every still-unpaid debt
// order with the date it was taken, plus the running total — so staff can hand the
// customer something on paper instead of reading numbers off the screen. Reuses the
// same #receipt-print / @media print machinery as the POS receipt (see theme.css and
// ReceiptModal), in its own modal so it doesn't get tangled up with the settle/add-debt
// forms on the customer detail screen underneath it.
function CustomerStatementModal({ customer, orders, restaurant, onClose, onViewOrder }) {
  const unpaid = orders.filter((o) => o.payment?.status !== 'paid');
  return (
    <Modal onClose={onClose} width={360}>
      <div id="receipt-print" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 14 }}>
          <div className="receipt-logo-box" style={{
            width: 56, height: 56, borderRadius: 16, background: `hsl(${restaurant?.hue ?? 212} 65% 95%)`, color: `hsl(${restaurant?.hue ?? 212} 55% 42%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, marginBottom: 10, overflow: 'hidden',
          }}>
            {restaurant?.logoUrl ? <img src={restaurant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : (restaurant?.name?.[0] || 'M')}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font)' }}>{restaurant?.name}</div>
          <div style={{ fontSize: 12, color: '#000', fontWeight: 800, marginTop: 6 }}>Diiwaanka Deynta · Debt Statement</div>
          <div style={{ fontSize: 11, color: '#000', fontWeight: 700 }}>{fullDate(new Date())}</div>
        </div>

        <div style={{ borderTop: '1px solid var(--text)', borderBottom: '1px solid var(--text)', padding: '10px 0', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{customer.name}</div>
          {customer.phone && <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>📞 {customer.phone}</div>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 90px 70px', gap: 6,
            borderBottom: '1px solid var(--text)', paddingBottom: 6, marginBottom: 6,
            fontSize: 11, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', color: '#000',
          }}>
            <span>Dalab · Order</span>
            <span>Taariikh · Date</span>
            <span style={{ textAlign: 'right' }}>Qadar · Amount</span>
          </div>
          {!unpaid.length && (
            <div style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 0' }}>Deyn ma jirto · No outstanding debt.</div>
          )}
          {unpaid.map((o) => (
            <button
              key={o.id} onClick={() => onViewOrder?.(o)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 90px 70px', gap: 6, width: '100%', textAlign: 'left',
                fontSize: 12.5, fontWeight: 700, padding: '4px 0', fontFamily: 'inherit', color: 'inherit',
                border: 'none', background: 'transparent', cursor: onViewOrder ? 'pointer' : 'default',
              }}
            >
              <span>#{o.number}</span>
              <span>{fullDate(o.createdAt)}</span>
              <span style={{ textAlign: 'right' }}>{money(o.total)}</span>
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--text)', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
            <span>Total</span>
            <span>{money(customer.balance)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn-outline" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
      </div>
    </Modal>
  );
}

function CustomerDetailModal({ customerId, restaurant, onClose, addToast, onSettled }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState(null);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [addItemsOrder, setAddItemsOrder] = useState(null);
  const [editItemsOrder, setEditItemsOrder] = useState(null);
  const canDebt = restaurant?.role !== 'staff' || restaurant?.permissions?.includes('pos_debt');
  const canDiscount = restaurant?.role !== 'staff' || restaurant?.permissions?.includes('pos_discount');

  function load() {
    api.get(`/restaurant/customers/${customerId}`).then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e)));
  }

  // Adding/removing items or changing the discount on a debt order also moves the
  // customer's balance server-side (see /orders/:id/items) — refetch here so this modal
  // and the parent list both pick up the new number, same as after a settlement.
  async function reloadAfterOrderEdit() {
    const { data: fresh } = await api.get(`/restaurant/customers/${customerId}`);
    setData(fresh);
    onSettled?.(fresh.customer);
  }
  useEffect(load, [customerId]);
  useEffect(() => {
    api.get('/restaurant/pos/payment-options').then((r) => {
      const m = r.data.manualMethods || [];
      setMethods(m);
      setMethodId((prev) => prev || m[0]?.id || null);
    });
  }, []);

  const balance = data?.customer.balance || 0;
  const amountNum = Math.round((Number(amount) || 0) * 100) / 100;
  const canSettle = amountNum > 0 && amountNum <= balance + 0.001 && methodId;

  async function settle() {
    if (!canSettle || busy) return;
    setBusy(true);
    try {
      const { data: res } = await api.post(`/restaurant/customers/${customerId}/payments`, { amount: amountNum, methodId, note: note.trim() });
      const settledCount = res.settledOrders?.length || 0;
      addToast({
        title: 'Lacagta waa la diiwaan geliyay · Payment recorded',
        body: settledCount
          ? `${money(amountNum)} · ${res.payment.methodName} — cashaanka waa la dhammeystiray, ${settledCount} dalab ayaa la bixiyay · balance cleared, ${settledCount} order(s) marked paid`
          : `${money(amountNum)} · ${res.payment.methodName}`,
        tone: 'success',
      });
      setAmount(''); setNote('');
      onSettled?.(res.customer);
      load();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={520}>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      {!data && !error && <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>Loading…</div>}
      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{data.customer.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{money(balance)}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Phone size={12} strokeWidth={2.25} /> {data.customer.phone || '—'}
          </div>

          {balance > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 18, background: 'var(--panel)' }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}>Dajiso lacagta · Settle payment</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="number" min="0" step="0.01" max={balance} className="field-input" style={{ flex: 1 }}
                  placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                />
                <button className="btn-outline btn-sm" onClick={() => setAmount(String(balance))} title="Dhammaan · Full amount">Dhammaan</button>
              </div>
              {methods === null && <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>Loading wallets…</div>}
              {!!methods?.length && (
                <>
                  <label className="field-label">Halka lacagtu ku dhacday · Received into</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {methods.map((m) => (
                      <button key={m.id} type="button" className={'chip' + (methodId === m.id ? ' active' : '')} onClick={() => setMethodId(m.id)}>{m.name}</button>
                    ))}
                  </div>
                </>
              )}
              {methods !== null && !methods.length && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>
                  Weli hab lacag-bixin ma jiro · No wallet yet — create one on the Payment Methods page first.
                </div>
              )}
              <input
                className="field-input" style={{ marginBottom: 10 }} placeholder="Faallo (ikhtiyaari) · Note (optional)"
                value={note} onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={!canSettle || busy} onClick={settle}>
                {busy ? 'Diiwaan gelinaya…' : `Xaqiiji ${amountNum > 0 ? money(amountNum) : ''} · Confirm`}
              </button>
            </div>
          )}

          <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>Dalabyada deynta · Debt orders</div>
          <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 6 }}>Guji dalab si aad u aragto alaabta (magaca, qty, qiimaha) · Click an order to see its items (product, qty, price).</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
            {!data.orders.length && <div className="text-muted" style={{ fontSize: 12.5 }}>Wax dalab ah lama helin · No debt orders.</div>}
            {data.orders.map((o) => {
              const editable = canDebt && o.payment?.status !== 'paid';
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border-soft)' }}>
                  <button
                    onClick={() => setViewOrder(o)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', flex: 1, minWidth: 0, textAlign: 'left',
                      padding: '7px 4px', fontSize: 12.5,
                      border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit',
                    }}
                  >
                    <span>#{o.number} · {timeAgo(o.createdAt)}</span>
                    <span style={{ fontWeight: 700 }}>{money(o.total)}</span>
                  </button>
                  {editable && (
                    <>
                      <button
                        title="Ku dar alaab · Add items" onClick={() => setAddItemsOrder(o)}
                        style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--muted-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      ><Plus size={13} strokeWidth={2.5} /></button>
                      <button
                        title="Wax ka beddel · Edit items & discount" onClick={() => setEditItemsOrder(o)}
                        style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--muted-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      ><Pencil size={12} strokeWidth={2.5} /></button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>Taariikhda lacag-bixinta · Payment history</div>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {!data.payments.length && <div className="text-muted" style={{ fontSize: 12.5 }}>Weli wax lacag ah lama bixin · No payments yet.</div>}
            {data.payments.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-soft)', fontSize: 12.5 }}>
                <span>{p.methodName} · {p.staffName} · {timeAgo(p.createdAt)}</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>+{money(p.amount)}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setShowStatement(true)}>
              <Printer size={14} strokeWidth={2.25} /> Diiwaanka deynta · Statement
            </button>
            <button className="btn-outline" onClick={onClose}>Close</button>
          </div>
        </>
      )}

      {showStatement && data && (
        <CustomerStatementModal
          customer={data.customer} orders={data.orders} restaurant={restaurant}
          onClose={() => setShowStatement(false)}
          onViewOrder={(o) => setViewOrder(o)}
        />
      )}

      {viewOrder && (
        <ReceiptModal order={viewOrder} restaurant={restaurant} onClose={() => setViewOrder(null)} />
      )}

      {addItemsOrder && (
        <AddItemsModal
          order={addItemsOrder} addToast={addToast}
          onClose={() => setAddItemsOrder(null)}
          onAdded={reloadAfterOrderEdit}
        />
      )}

      {editItemsOrder && (
        <EditItemsModal
          order={editItemsOrder} addToast={addToast} canDiscount={canDiscount}
          onClose={() => setEditItemsOrder(null)}
          onUpdated={reloadAfterOrderEdit}
        />
      )}
    </Modal>
  );
}

export default function Customers() {
  const { addToast, me } = useOutletContext();
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // No search typed: only who still owes something — the "who do I need to collect
  // from" view, so a customer drops off the list the moment they're fully paid up.
  // Typing a search hits the backend without that filter, so it can still find someone
  // by name even after their balance has reached $0 (reusing the same record for a new
  // tab later, rather than the picker creating a duplicate "customer").
  function load() {
    const q = query.trim();
    const params = q ? { q } : { owing: 1 };
    api.get('/restaurant/customers', { params }).then((r) => setCustomers(r.data)).catch((e) => setError(apiErrorMessage(e)));
  }
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const totalOwed = useMemo(() => (customers || []).reduce((a, c) => a + c.balance, 0), [customers]);
  const debtorCount = useMemo(() => (customers || []).filter((c) => c.balance > 0).length, [customers]);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Macaamiisha · Customers</h1>
        <p className="page-sub">Macaamiisha deynta leh iyo dajinta lacagtooda · Customers with store credit ("Deyn") and settling what they owe.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, marginBottom: 8 }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{money(totalOwed)}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, marginBottom: 8 }}>Macaamiisha deynta leh · Customers owing</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{debtorCount}</div>
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
        <Search size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-3)' }} />
        <input className="field-input" style={{ paddingLeft: 32 }} placeholder="Raadi macmiil… · Search customers…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {!customers && !error && <div className="text-muted">Loading…</div>}

      {customers && !customers.length && (
        <div className="card" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <HandCoins size={30} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {query.trim() ? 'Wax macmiil ah lama helin · No matches' : 'Cid deyn ku leh ma jirto hadda · No one owes anything right now'}
          </div>
          {!query.trim() && (
            <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4 }}>
              Waxaa lagu daraa marka POS lagu doorto "Deyn" · Added from the POS page's "Deyn" option.
            </div>
          )}
        </div>
      )}

      {customers && !!customers.length && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 40px', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
            <div>Macmiil · Customer</div><div>Lambar · Phone</div><div style={{ textAlign: 'right' }}>Wadarta · Balance</div><div />
          </div>
          {customers.map((c) => (
            <button
              key={c.id} onClick={() => setSelectedId(c.id)}
              style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 40px', gap: 12, padding: '13px 20px',
                borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13, width: '100%', textAlign: 'left',
                border: 'none', borderBottomWidth: '1px', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div className="mono" style={{ color: 'var(--muted-3)' }}>{c.phone || '—'}</div>
              <div style={{ textAlign: 'right', fontWeight: 800, color: c.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{money(c.balance)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--muted-3)' }}>
                {c.balance > 0 ? <Receipt size={14} strokeWidth={2.25} /> : <Wallet size={14} strokeWidth={2.25} />}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <CustomerDetailModal
          customerId={selectedId} restaurant={me} addToast={addToast}
          onClose={() => setSelectedId(null)}
          onSettled={(updated) => setCustomers((prev) => {
            if (!prev) return prev;
            // Fully paid off, and we're on the default "who still owes" view (no search
            // typed) — this customer drops off the list immediately rather than sitting
            // there at $0.00 until the next reload.
            if (updated.balance <= 0 && !query.trim()) return prev.filter((c) => c.id !== updated.id);
            return prev.map((c) => (c.id === updated.id ? updated : c));
          })}
        />
      )}
    </div>
  );
}
