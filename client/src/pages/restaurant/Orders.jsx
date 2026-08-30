import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bell, Search, StickyNote, Play, Check, Trash2, Globe, ShoppingBag, MapPin, ShoppingCart } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import ReceiptModal from '../../components/ReceiptModal';

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
  { id: 'new', so: 'Cusub', en: 'New' },
  { id: 'preparing', so: 'Diyaarin', en: 'Preparing' },
  { id: 'done', so: 'Diyaar', en: 'Done' },
];

const PAGE_SIZE = 10;

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  return mins + 'm ago';
}

export default function Orders() {
  const { me, soundOn, setSoundOn, addToast, confirm } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [simulateError, setSimulateError] = useState('');

  useEffect(() => {
    api.get('/restaurant/orders').then((r) => setOrders(r.data));
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    const socket = getSocket();
    socket.emit('join:restaurant', me.id);
    function onNewOrder(order) {
      setOrders((prev) => [order, ...prev]);
    }
    socket.on('order:new', onNewOrder);
    return () => socket.off('order:new', onNewOrder);
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
  async function simulate() {
    setSimulateError('');
    try {
      await api.post('/restaurant/orders/simulate');
    } catch (e) {
      setSimulateError(e?.response?.data?.error || 'Add products first');
    }
  }

  const counts = useMemo(() => ({
    all: orders.length,
    new: orders.filter((o) => o.status === 'new').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    done: orders.filter((o) => o.status === 'done').length,
  }), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== 'all' && o.status !== tab) return false;
      if (!q) return true;
      const m = channelMeta(o.channel, o.tableLabel);
      return (
        String(o.number).includes(q) ||
        m.label.toLowerCase().includes(q) ||
        (o.phone || '').toLowerCase().includes(q)
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
          <button className="btn btn-primary btn-sm" onClick={simulate}><Play size={13} strokeWidth={2.25} /> Test order</button>
        </div>
      </div>
      {simulateError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{simulateError}</div>}

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
            placeholder="Raadi order, miis, taleefan…"
            value={query} onChange={(e) => onQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1fr 2fr 1.1fr .8fr 1.3fr 1.6fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
          <div>Order</div><div>Source</div><div>Items</div><div>Phone</div><div>Total</div><div>Status</div><div style={{ textAlign: 'right' }}>Actions</div>
        </div>
        {pageRows.map((o) => {
          const m = channelMeta(o.channel, o.tableLabel);
          const s = STATUS_META[o.status];
          return (
            <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '.9fr 1fr 2fr 1.1fr .8fr 1.3fr 1.6fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
              <div>
                <div className="mono" style={{ fontWeight: 800 }}>#{o.number}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{timeAgo(o.createdAt)}</div>
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
              <div className="mono">{o.phone}</div>
              <div style={{ fontWeight: 800 }}>${o.total.toFixed(2)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                <span style={{ background: s.bg, color: s.fg, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>{s.label}</span>
                {(() => { const pm = paymentMeta(o.payment); return (
                  <span style={{ background: pm.bg, color: pm.fg, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8 }}>{pm.label}</span>
                ); })()}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-outline btn-sm" onClick={() => setReceiptOrder(o)}>View</button>
                {o.status === 'new' && <button className="btn btn-primary btn-sm" onClick={() => accept(o.id)}>Aqbal · Accept</button>}
                {o.status === 'preparing' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => complete(o.id)}>
                    Diyaar <Check size={13} strokeWidth={2.5} />
                  </button>
                )}
                <button
                  title="Tirtir · Delete" onClick={() => removeOrder(o.id)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                ><Trash2 size={14} strokeWidth={2.25} /></button>
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
    </div>
  );
}
