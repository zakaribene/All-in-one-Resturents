import Modal from './Modal';

function channelMeta(channel, tableLabel) {
  if (channel === 'online') return { label: 'Online', icon: '🌐' };
  if (channel === 'takeaway') return { label: 'Takeaway', icon: '🛒' };
  if (channel === 'pos') return { label: 'POS · Staff', icon: '🛒' };
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
            width: 64, height: 64, borderRadius: 18, background: `hsl(${restaurant?.hue ?? 212} 65% 95%)`, color: `hsl(${restaurant?.hue ?? 212} 55% 42%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, marginBottom: 10, overflow: 'hidden',
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
          {order.phone && (
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              📞 <a href={`tel:${order.phone}`} style={{ color: 'var(--accent)' }}>{order.phone}</a>
            </div>
          )}
          {order.note && <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>Note: {order.note}</div>}
          {order.createdByRole === 'staff' && order.createdByName && (
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>Waxaa qaatay · Taken by: {order.createdByName}</div>
          )}
          {order.channel === 'pos' && (
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: order.payment?.status === 'paid' ? 'var(--success)' : 'var(--warning-fg)' }}>
              {order.payment?.status === 'paid' ? '✓ La bixiyay · Paid' : '⏳ Sugaya lacag · Pending payment'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {order.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 13 }}>
              <div>
                <div>{it.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>${it.price.toFixed(2)} × {it.qty}</div>
              </div>
              <span>${(it.qty * it.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px dashed var(--border-strong)', paddingTop: 10 }}>
          {order.discount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted-2)', marginBottom: 4 }}>
                <span>Subtotal</span>
                <span>${(order.total + order.discount).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>
                <span>Discount</span>
                <span>−${order.discount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        {!!restaurant?.receiptPaymentNumbers?.length && (
          <div style={{ borderTop: '1px dashed var(--border-strong)', marginTop: 12, paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Lacag-bixinta · Payment info
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {restaurant.receiptPaymentNumbers.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--muted-2)' }}>{p.label}</span>
                  <span style={{ fontWeight: 700 }}>{p.number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn-outline" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
      </div>
    </Modal>
  );
}
