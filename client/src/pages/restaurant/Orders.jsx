import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { playBeep } from '../../lib/toast';
import { useToasts } from '../../lib/useToasts';
import ToastStack from '../../components/ToastStack';
import ReceiptModal from '../../components/ReceiptModal';

function channelMeta(channel, tableLabel) {
  if (channel === 'online') return { label: 'Online', icon: '🌐', bg: '#F3E8FF', fg: '#8B5CF6' };
  if (channel === 'takeaway') return { label: 'Takeaway', icon: '🛒', bg: '#F1F4F9', fg: '#526077' };
  return { label: 'Miis ' + tableLabel, icon: '📍', bg: 'color-mix(in srgb, var(--accent) 12%, #fff)', fg: 'var(--accent)' };
}

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  return mins + 'm ago';
}

export default function Orders() {
  const { me } = useOutletContext();
  const [orders, setOrders] = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const { toasts, addToast, dismissToast } = useToasts();
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  useEffect(() => {
    api.get('/restaurant/orders').then((r) => setOrders(r.data));
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    const socket = getSocket();
    socket.emit('join:restaurant', me.id);

    function onNewOrder(order) {
      setOrders((prev) => [order, ...prev]);
      if (soundOnRef.current) playBeep();
      const m = channelMeta(order.channel, order.tableLabel);
      addToast({ title: 'Dalab cusub · New order #' + order.number, body: `${m.icon} ${m.label} · ${order.phone}` });
    }
    function onNotification(n) {
      addToast({ title: n.title, body: n.body });
    }
    socket.on('order:new', onNewOrder);
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('notification:new', onNotification);
    };
  }, [me?.id, addToast]);

  async function accept(id) {
    const { data } = await api.post(`/restaurant/orders/${id}/accept`);
    setOrders((prev) => prev.map((o) => (o.id === id ? data : o)));
  }
  async function complete(id) {
    const { data } = await api.post(`/restaurant/orders/${id}/complete`);
    setOrders((prev) => prev.map((o) => (o.id === id ? data : o)));
  }
  async function simulate() {
    try {
      await api.post('/restaurant/orders/simulate');
    } catch (e) {
      addToast({ title: 'Waa lagu guuldareystay · Failed', body: e?.response?.data?.error || 'Add products first' });
    }
  }

  const newO = orders.filter((o) => o.status === 'new');
  const prepO = orders.filter((o) => o.status === 'preparing');
  const doneO = orders.filter((o) => o.status === 'done');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24 }}>Dalabyada · Live orders</h1>
          <p className="page-sub">Dalabyada QR-ka ka imanaya · Orders arriving from tables.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSoundOn((v) => !v)}>
            <span style={{ fontSize: 15 }}>🔔</span> Sound: <b style={{ marginLeft: 2 }}>{soundOn ? 'On · Furan' : 'Off · Xiran'}</b>
          </button>
          <button className="btn btn-primary btn-sm" onClick={simulate}>▶ Test order</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'start' }}>
        <OrderColumn title="Cusub · New" dot="#E5484D" count={newO.length}>
          {newO.map((o) => (
            <OrderCard key={o.id} order={o} highlight onView={() => setReceiptOrder(o)}>
              <button className="btn btn-primary btn-sm" onClick={() => accept(o.id)}>Aqbal · Accept</button>
            </OrderCard>
          ))}
        </OrderColumn>
        <OrderColumn title="Diyaarin · Preparing" dot="#E8A317" count={prepO.length}>
          {prepO.map((o) => (
            <OrderCard key={o.id} order={o} onView={() => setReceiptOrder(o)}>
              <button className="btn btn-ghost btn-sm" onClick={() => complete(o.id)}>Diyaar ✓ · Done</button>
            </OrderCard>
          ))}
        </OrderColumn>
        <OrderColumn title="Dhammaystiran · Done" dot="#12A150" count={doneO.length}>
          {doneO.map((o) => (
            <OrderCard key={o.id} order={o} faded onView={() => setReceiptOrder(o)} />
          ))}
        </OrderColumn>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {receiptOrder && <ReceiptModal order={receiptOrder} restaurant={me} onClose={() => setReceiptOrder(null)} />}
    </div>
  );
}

function OrderColumn({ title, dot, count, children }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 12px', fontWeight: 800, fontSize: 13 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: dot }} />
        {title}
        <span style={{ marginLeft: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 9px', fontSize: 12 }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function OrderCard({ order, children, highlight, faded, onView }) {
  const m = channelMeta(order.channel, order.tableLabel);
  return (
    <div
      style={{
        background: '#fff', border: '1px solid ' + (highlight ? '#F0C6C6' : 'var(--border)'), borderRadius: 13, padding: 14,
        boxShadow: highlight ? '0 4px 14px -8px rgba(229,72,77,.4)' : 'none', opacity: faded ? .72 : 1, cursor: 'pointer',
      }}
      onClick={onView}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }} className="mono">#{order.number}</span>
        <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>{timeAgo(order.createdAt)}</span>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: m.bg, color: m.fg, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8, marginBottom: 10 }}>
        {m.icon} {m.label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted-5)', lineHeight: 1.5, marginBottom: faded ? 8 : 12 }}>
        {order.items.map((i) => `${i.qty}× ${i.name}`).join('  ·  ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={(e) => e.stopPropagation()}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>${order.total.toFixed(2)}</span>
        {children}
      </div>
    </div>
  );
}
