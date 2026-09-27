import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bell, Search, StickyNote, Check, Trash2, Globe, ShoppingBag, MapPin, ShoppingCart, Plus, Wallet, Pencil, Receipt } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import ReceiptModal from '../../components/ReceiptModal';
import Modal from '../../components/Modal';
import CustomerPicker from '../../components/CustomerPicker';
import { AddItemsModal, EditItemsModal } from '../../components/OrderItemsModals';

function channelMeta(channel, tableLabel) {
  if (channel === 'online') return { label: 'Online', Icon: Globe, bg: 'var(--purple-bg)', fg: 'var(--purple)' };
  if (channel === 'takeaway') return { label: 'Takeaway', Icon: ShoppingBag, bg: 'var(--border-soft)', fg: 'var(--muted-4)' };
  if (channel === 'pos') return { label: 'POS · Staff', Icon: ShoppingCart, bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' };
  return { label: 'Miis ' + tableLabel, Icon: MapPin, bg: 'color-mix(in srgb, var(--accent) 12%, var(--surface))', fg: 'var(--accent)' };
}

const STATUS_META = {
  new: { label: 'Cusub · New', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  preparing: { label: 'Diyaarin · Preparing', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
  done: { label: 'Diyaar · Done', bg: 'var(--success-bg)', fg: 'var(--success)' },
};

function paymentMeta(payment) {
  if (!payment || payment.status === 'none' || payment.method === 'pay_at_table') {
    return { label: 'Bixi miiska · Pay at table', bg: 'var(--panel-2)', fg: 'var(--muted-3)' };
  }
  if (payment.status === 'paid') return { label: `✓ Paid · ${payment.provider || ''}`, bg: 'var(--success-bg)', fg: 'var(--success)' };
  if (payment.status === 'timeout') return { label: '⚠ Verify manually', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' };
  return { label: 'Pending', bg: 'var(--panel-2)', fg: 'var(--muted-3)' };
}

const TABS = [
  { id: 'all', so: 'Dhammaan', en: 'All' },
  { id: 'pending', so: 'Sugaya', en: 'Pending' },
  { id: 'paid', so: 'La bixiyay', en: 'Paid' },
];

const PAGE_SIZE = 10;

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  return mins + 'm ago';
}

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// POS orders placed as "Manual" skip the kitchen New/Preparing/Done flow and
// instead just track whether the bill has been collected yet.
function isPosOrder(o) { return o.channel === 'pos'; }
function isPaid(o) { return o.payment?.status === 'paid'; }
function isDebt(o) { return !!o.debtorId; }

function MarkPaidModal({ order, onClose, onPaid, addToast }) {
  const [methods, setMethods] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/restaurant/pos/payment-options').then((r) => {
      const m = r.data.manualMethods || [];
      setMethods(m);
      setMethodId(m[0]?.id || null);
    });
  }, []);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/restaurant/orders/${order.id}/mark-paid`, { manualMethodId: methodId });
      onPaid(data);
      addToast({ title: 'Waa la bixiyay · Marked paid', body: `#${data.number}`, tone: 'success' });
      onClose();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={380}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Bixi dalabka · Mark as paid</div>
      <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 16 }}>Order #{order.number} · ${order.total.toFixed(2)}</div>
      {methods === null && <div className="text-muted" style={{ padding: '4px 0 16px' }}>Loading…</div>}
      {!!methods?.length && (
        <>
          <label className="field-label">Habka lacag-bixinta · Paid with</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {methods.map((m) => (
              <button key={m.id} type="button" className={'chip' + (methodId === m.id ? ' active' : '')} onClick={() => setMethodId(m.id)}>{m.name}</button>
            ))}
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn-outline" onClick={onClose}>Ka noqo · Cancel</button>
        <button className="btn btn-primary" disabled={busy || (!!methods?.length && !methodId)} onClick={submit}>{busy ? 'Diraya…' : 'Xaqiiji · Confirm'}</button>
      </div>
    </Modal>
  );
}

// Corrects which wallet an already-paid order's money was attributed to — e.g. staff
// tapped the wrong one at checkout. See PATCH /orders/:id/payment-method.
function EditPaymentMethodModal({ order, onClose, onUpdated, addToast }) {
  const [methods, setMethods] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/restaurant/pos/payment-options').then((r) => {
      const m = r.data.manualMethods || [];
      setMethods(m);
      setMethodId(order.payment?.manualMethod || m[0]?.id || null);
    });
  }, [order]);

  const changed = methodId && methodId !== order.payment?.manualMethod;

  async function submit() {
    if (busy || !changed) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/restaurant/orders/${order.id}/payment-method`, { methodId });
      onUpdated(data);
      addToast({ title: 'Habka bixinta waa la beddelay · Payment method corrected', body: `#${data.number}`, tone: 'success' });
      onClose();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={380}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Beddel habka bixinta · Edit payment method</div>
      <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 16 }}>
        Order #{order.number} · ${order.total.toFixed(2)} · Hadda: {order.payment?.manualMethodName || '—'}
      </div>
      {methods === null && <div className="text-muted" style={{ padding: '4px 0 16px' }}>Loading…</div>}
      {!!methods?.length && (
        <>
          <label className="field-label">Habka saxda ah · Correct wallet</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {methods.map((m) => (
              <button key={m.id} type="button" className={'chip' + (methodId === m.id ? ' active' : '')} onClick={() => setMethodId(m.id)}>{m.name}</button>
            ))}
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn-outline" onClick={onClose}>Ka noqo · Cancel</button>
        <button className="btn btn-primary" disabled={busy || !changed} onClick={submit}>{busy ? 'Diraya…' : 'Xaqiiji · Confirm'}</button>
      </div>
    </Modal>
  );
}

// Charges an already-placed pending order to a customer's account — the "the customer
// says they have no money" case, after the order was already sent as a normal pending
// order rather than through POS's own "Deyn" button.
function AssignDebtModal({ order, onClose, onAssigned, addToast }) {
  const [customer, setCustomer] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!customer || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/restaurant/orders/${order.id}/assign-debt`, {
        customerId: customer.isNew ? undefined : customer.id,
        customerName: customer.isNew ? customer.name : undefined,
        customerPhone: customer.isNew ? customer.phone : undefined,
      });
      onAssigned(data);
      addToast({ title: 'Waxaa lagu daray cashaanka · Charged to account', body: `#${data.number} · ${customer.name}`, tone: 'success' });
      onClose();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={480}>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Deyn u dir · Charge to customer account</div>
      <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 16 }}>Order #{order.number} · ${order.total.toFixed(2)}</div>
      <label className="field-label">Macmiil · Customer *</label>
      <div style={{ marginBottom: 16 }}>
        <CustomerPicker value={customer} onChange={setCustomer} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn-outline" onClick={onClose}>Ka noqo · Cancel</button>
        <button className="btn btn-primary" disabled={busy || !customer} onClick={submit}>{busy ? 'Diraya…' : 'Xaqiiji · Confirm'}</button>
      </div>
    </Modal>
  );
}

export default function Orders() {
  const { me, soundOn, setSoundOn, addToast, confirm } = useOutletContext();
  const canDelete = me?.role !== 'staff' || me?.permissions?.includes('orders_delete');
  const canDebt = me?.role !== 'staff' || me?.permissions?.includes('pos_debt');
  const canDiscount = me?.role !== 'staff' || me?.permissions?.includes('pos_discount');
  const [orders, setOrders] = useState([]);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [addItemsOrder, setAddItemsOrder] = useState(null);
  const [editItemsOrder, setEditItemsOrder] = useState(null);
  const [payOrder, setPayOrder] = useState(null);
  const [debtOrder, setDebtOrder] = useState(null);
  const [editPaymentOrder, setEditPaymentOrder] = useState(null);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/restaurant/orders').then((r) => setOrders(r.data));
  }, []);

  function upsertOrder(order) {
    setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev.map((o) => (o.id === order.id ? order : o)) : [order, ...prev]));
  }

  useEffect(() => {
    if (!me?.id) return;
    const socket = getSocket();
    socket.emit('join:restaurant', me.id);
    function onNewOrder(order) {
      setOrders((prev) => [order, ...prev]);
    }
    function onUpdatedOrder(order) {
      upsertOrder(order);
    }
    socket.on('order:new', onNewOrder);
    socket.on('order:updated', onUpdatedOrder);
    return () => { socket.off('order:new', onNewOrder); socket.off('order:updated', onUpdatedOrder); };
  }, [me?.id]);

  async function accept(id) {
    const { data } = await api.post(`/restaurant/orders/${id}/accept`);
    setOrders((prev) => prev.map((o) => (o.id === id ? data : o)));
  }
  async function complete(id) {
    const { data } = await api.post(`/restaurant/orders/${id}/complete`);
    setOrders((prev) => prev.map((o) => (o.id === id ? data : o)));
  }
  async function removeOrder(id) {
    const ok = await confirm({ title: 'Tirtir dalabkan · Delete this order?', tone: 'danger', confirmLabel: 'Tirtir · Delete' });
    if (!ok) return;
    try {
      await api.delete(`/restaurant/orders/${id}`);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      addToast({ title: 'Dalabka waa la tirtiray · Order deleted', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to delete', body: apiErrorMessage(err), tone: 'error' });
    }
  }
  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((o) => !isPaid(o)).length,
    paid: orders.filter((o) => isPaid(o)).length,
  }), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab === 'pending' && isPaid(o)) return false;
      if (tab === 'paid' && !isPaid(o)) return false;
      if (!q) return true;
      const m = channelMeta(o.channel, o.tableLabel);
      return (
        String(o.number).includes(q) ||
        m.label.toLowerCase().includes(q) ||
        (o.phone || '').toLowerCase().includes(q) ||
        o.items.some((it) => {
          const name = it.name.toLowerCase();
          return name.includes(q) || `${it.qty} ${name}`.includes(q);
        })
      );
    });
  }, [orders, tab, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = (pageSafe - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function onTab(id) { setTab(id); setPage(1); }
  function onQuery(v) { setQuery(v); setPage(1); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24 }}>Dalabyada · Live orders</h1>
          <p className="page-sub">Dalabyada QR-ka ka imanaya · Orders arriving from tables.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSoundOn((v) => !v)}>
            <Bell size={14} strokeWidth={2.25} /> Sound: <b style={{ marginLeft: 2 }}>{soundOn ? 'On · Furan' : 'Off · Xiran'}</b>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={'chip' + (tab === t.id ? ' active' : '')}
              onClick={() => onTab(t.id)}
            >
              {t.so} · {t.en} {counts[t.id]}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', maxWidth: 260, flex: '1 1 220px' }}>
          <Search size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-3)' }} />
          <input
            className="field-input" style={{ paddingLeft: 32 }}
            placeholder="Raadi order & product"
            value={query} onChange={(e) => onQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.8fr .9fr 1.8fr 1fr .7fr 1.1fr 2.4fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
          <div>Order</div><div>Source</div><div>Items</div><div>Phone</div><div>Total</div><div>Status</div><div style={{ textAlign: 'right' }}>Actions</div>
        </div>
        {pageRows.map((o) => {
          const m = channelMeta(o.channel, o.tableLabel);
          const s = STATUS_META[o.status];
          return (
            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '.8fr .9fr 1.8fr 1fr .7fr 1.1fr 2.4fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
              <div>
                <div className="mono" style={{ fontWeight: 800 }}>#{o.number}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{timeAgo(o.createdAt)}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted-3)', opacity: .75 }}>{formatDateTime(o.createdAt)}</div>
              </div>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: m.bg, color: m.fg, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>
                  <m.Icon size={12} strokeWidth={2.5} /> {m.label}
                </span>
              </div>
              <div style={{ color: 'var(--muted-5)' }}>
                {o.items.map((i) => `${i.qty}× ${i.name}`).join('  ·  ')}
                {o.note && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', marginTop: 3 }}>
                    <StickyNote size={12} strokeWidth={2.25} /> {o.note}
                  </div>
                )}
              </div>
              <div className="mono">{o.phone || <span style={{ color: 'var(--muted-3)' }}>—</span>}</div>
              <div style={{ fontWeight: 800 }}>${o.total.toFixed(2)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                {isDebt(o) ? (
                  <span style={{ background: 'color-mix(in srgb, var(--accent) 14%, var(--surface))', color: 'var(--accent)', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Receipt size={12} strokeWidth={2.5} /> Deyn · {o.debtorName}
                  </span>
                ) : isPosOrder(o) ? (
                  isPaid(o)
                    ? <span style={{ background: 'var(--success-bg)', color: 'var(--success)', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>La bixiyay · Paid</span>
                    : <span style={{ background: 'var(--warning-bg)', color: 'var(--warning-fg)', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>Sugaya · Pending</span>
                ) : (
                  <>
                    <span style={{ background: s.bg, color: s.fg, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>{s.label}</span>
                    {(() => { const pm = paymentMeta(o.payment); return (
                      <span style={{ background: pm.bg, color: pm.fg, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8 }}>{pm.label}</span>
                    ); })()}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                <button className="btn-outline btn-sm" style={{ height: 32 }} onClick={() => setReceiptOrder(o)}>View</button>
                {isPaid(o) && o.payment?.manualMethod && (
                  <button className="btn-outline btn-sm" style={{ height: 32 }} title="Beddel habka bixinta · Edit payment method" onClick={() => setEditPaymentOrder(o)}>
                    <Pencil size={13} strokeWidth={2.5} /> Edit
                  </button>
                )}
                {/* A debt order settles through the Customers page only — its total is
                    tracked on the customer's balance now, so editing/paying/deleting it
                    here would desync the two. The server refuses these too; hiding them
                    here is clearer than letting staff tap into an error. */}
                {isPosOrder(o) && !isDebt(o) ? (
                  !isPaid(o) && (
                    <>
                      <button className="btn-outline btn-sm" style={{ height: 32 }} title="Wax ka beddel · Edit items" onClick={() => setEditItemsOrder(o)}>
                        <Pencil size={13} strokeWidth={2.5} /> Edit
                      </button>
                      <button className="btn-outline btn-sm" style={{ height: 32 }} title="Ku dar alaab · Add items" onClick={() => setAddItemsOrder(o)}>
                        <Plus size={13} strokeWidth={2.5} /> Ku dar
                      </button>
                      {canDebt && (
                        <button className="btn-outline btn-sm" style={{ height: 32 }} title="Deyn u dir · Charge to customer account" onClick={() => setDebtOrder(o)}>
                          <Receipt size={13} strokeWidth={2.5} /> Deyn
                        </button>
                      )}
                      <button className="btn btn-primary btn-sm" style={{ height: 32 }} title="Bixi dalabka · Mark as paid" onClick={() => setPayOrder(o)}>
                        <Wallet size={13} strokeWidth={2.25} /> Bixi
                      </button>
                    </>
                  )
                ) : !isPosOrder(o) && (
                  <>
                    {o.status === 'new' && <button className="btn btn-primary btn-sm" style={{ height: 32 }} onClick={() => accept(o.id)}>Aqbal · Accept</button>}
                    {o.status === 'preparing' && (
                      <button className="btn btn-ghost btn-sm" style={{ height: 32 }} onClick={() => complete(o.id)}>
                        Diyaar <Check size={13} strokeWidth={2.5} />
                      </button>
                    )}
                  </>
                )}
                {/* A paid order — or one charged to a customer account — is a financial
                    record; the server refuses to delete it too. */}
                {canDelete && !isPaid(o) && !isDebt(o) && (
                  <button
                    title="Tirtir · Delete" onClick={() => removeOrder(o.id)}
                    style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  ><Trash2 size={14} strokeWidth={2.25} /></button>
                )}
              </div>
            </div>
          );
        })}
        {!pageRows.length && <div className="text-muted" style={{ padding: 30, textAlign: 'center' }}>Wax dalab ah lama helin · No orders found.</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 13, color: 'var(--muted-2)' }}>
        <span>{filtered.length ? `${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length}` : '0 of 0'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline btn-sm" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>{pageSafe}</span>
          <button className="btn-outline btn-sm" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
        </div>
      </div>

      {receiptOrder && <ReceiptModal order={receiptOrder} restaurant={me} onClose={() => setReceiptOrder(null)} />}
      {addItemsOrder && (
        <AddItemsModal
          order={addItemsOrder} addToast={addToast}
          onClose={() => setAddItemsOrder(null)}
          onAdded={(o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)))}
        />
      )}
      {editItemsOrder && (
        <EditItemsModal
          order={editItemsOrder} addToast={addToast} canDiscount={canDiscount}
          onClose={() => setEditItemsOrder(null)}
          onUpdated={(o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)))}
        />
      )}
      {payOrder && (
        <MarkPaidModal
          order={payOrder} addToast={addToast}
          onClose={() => setPayOrder(null)}
          onPaid={(o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)))}
        />
      )}
      {debtOrder && (
        <AssignDebtModal
          order={debtOrder} addToast={addToast}
          onClose={() => setDebtOrder(null)}
          onAssigned={(o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)))}
        />
      )}
      {editPaymentOrder && (
        <EditPaymentMethodModal
          order={editPaymentOrder} addToast={addToast}
          onClose={() => setEditPaymentOrder(null)}
          onUpdated={(o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)))}
        />
      )}
    </div>
  );
}
