import Modal from './Modal';

function channelMeta(channel, tableLabel) {
  if (channel === 'online') return { label: 'Online', icon: '🌐' };
  if (channel === 'takeaway') return { label: 'Takeaway', icon: '🛒' };
  return { label: 'Miis ' + tableLabel, icon: '📍' };
}

export default function ReceiptModal({ order, restaurant, onClose }) {
  const m = channelMeta(order.channel, order.tableLabel);
  const dateStr = new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal onClose={onClose} width={360}>
      <div id="receipt-print" style={{ fontFamily: 'var(--mono)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, background: `hsl(${restaurant?.hue ?? 212} 65% 95%)`, color: `hsl(${restaurant?.hue ?? 212} 55% 42%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, marginBottom: 10, overflow: 'hidden',
          }}>
            {restaurant?.logoUrl ? <img src={restaurant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (restaurant?.name?.[0] || 'M')}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font)' }}>{restaurant?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{dateStr}</div>
        </div>

        <div style={{ borderTop: '1px dashed var(--border-strong)', borderBottom: '1px dashed var(--border-strong)', padding: '12px 0', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            <span>Order #{order.number}</span>
            <span>{m.icon} {m.label}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            📞 <a href={`tel:${order.phone}`} style={{ color: 'var(--accent)' }}>{order.phone}</a>
          </div>
          {order.note && <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>Note: {order.note}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {order.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{it.qty}× {it.name}</span>
              <span>${(it.qty * it.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px dashed var(--border-strong)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
          <span>Total</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn-outline" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
      </div>
    </Modal>
  );
}
