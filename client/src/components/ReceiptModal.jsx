import Modal from './Modal';

export default function ReceiptModal({ order, restaurant, onClose }) {
  const dateStr = new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal onClose={onClose} width={360}>
      <div id="receipt-print" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
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

        {!!restaurant?.receiptPaymentNumbers?.length && (
          <div style={{ marginBottom: 14, textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {restaurant.receiptPaymentNumbers.map((p, i) => (
                <div key={i} style={{ fontSize: 13, fontWeight: 800 }}>
                  {p.label}: {p.number}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--text)', borderBottom: '1px solid var(--text)', padding: '12px 0', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Order #{order.number}</div>
          {order.phone && (
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              📞 <a href={`tel:${order.phone}`} style={{ color: 'var(--accent)' }}>{order.phone}</a>
            </div>
          )}
          {order.note && <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>Note: {order.note}</div>}
          {order.createdByName && (
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>Taken by: {order.createdByName}</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {order.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 13 }}>
              <div>
                <div>{it.name}</div>
                <div style={{ fontSize: 11, color: '#000', fontWeight: 700 }}>${it.price.toFixed(2)} × {it.qty}</div>
              </div>
              <span>${(it.qty * it.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--text)', paddingTop: 10 }}>
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

        {!!restaurant?.receiptThankYouMessage && (
          <div style={{ borderTop: '1px solid var(--text)', marginTop: 12, paddingTop: 10, textAlign: 'center', fontSize: 12.5, color: 'var(--muted-1)' }}>
            {restaurant.receiptThankYouMessage}
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
