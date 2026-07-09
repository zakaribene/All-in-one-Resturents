import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api';
import ReceiptModal from '../../components/ReceiptModal';

function channelBadge(o) {
  if (o.channel === 'online') return '🌐 Online';
  if (o.channel === 'takeaway') return '🛒 Takeaway';
  return '📍 Miis ' + o.tableLabel;
}

export default function Sales() {
  const { me } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [cat, setCat] = useState('all');
  const [sales, setSales] = useState({ rows: [], totRev: 0, totSold: 0 });
  const [orders, setOrders] = useState([]);
  const [receiptOrder, setReceiptOrder] = useState(null);

  useEffect(() => { api.get('/restaurant/categories').then((r) => setCategories(r.data)); }, []);
  useEffect(() => { api.get('/restaurant/orders').then((r) => setOrders(r.data)); }, []);
  useEffect(() => {
    api.get('/restaurant/sales', { params: { category: cat } }).then((r) => setSales(r.data));
  }, [cat]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Iibka · Sales</h1>
        <p className="page-sub">Waxa la iibiyay oo dhan · Everything you've sold, filtered.</p>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '16px 20px', minWidth: 180 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700 }}>Wadarta iibka · Total revenue</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>${sales.totRev.toFixed(2)}</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', minWidth: 180 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700 }}>Xaddiga la iibiyay · Units sold</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{sales.totSold}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-4)' }}>Filter:</span>
          <select className="field-input" style={{ padding: '10px 13px', width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All · Dhammaan</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.en} · {c.so}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
          <div>Product</div><div>Category</div><div>Price</div><div>Sold</div><div style={{ textAlign: 'right' }}>Revenue</div>
        </div>
        {sales.rows.map((p) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>{p.en} <span style={{ color: 'var(--muted-3)', fontWeight: 500 }}>· {p.so}</span></div>
            <div style={{ color: 'var(--muted-4)' }}>{p.catEn} · {p.catSo}</div>
            <div className="mono">${p.price.toFixed(2)}</div>
            <div className="mono">{p.sold}</div>
            <div style={{ textAlign: 'right', fontWeight: 800 }} className="mono">${p.revenue.toFixed(2)}</div>
          </div>
        ))}
        {!sales.rows.length && <div style={{ padding: 20 }} className="text-muted">No sales in this category yet.</div>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Dalabyada iibsaday · Orders sold</div>
        <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Lambarka macmiilka + view rasiidka · Customer phone number + view receipt.</div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.7fr 1.1fr 1.4fr 1.6fr .8fr .7fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
          <div>Order</div><div>Channel</div><div>Phone</div><div>Items</div><div style={{ textAlign: 'right' }}>Total</div><div style={{ textAlign: 'right' }}>View</div>
        </div>
        {orders.map((o) => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '.7fr 1.1fr 1.4fr 1.6fr .8fr .7fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
            <div className="mono" style={{ fontWeight: 700 }}>#{o.number}</div>
            <div>{channelBadge(o)}</div>
            <div className="mono">{o.phone}</div>
            <div style={{ color: 'var(--muted-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
            <div style={{ textAlign: 'right', fontWeight: 800 }} className="mono">${o.total.toFixed(2)}</div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn-outline" onClick={() => setReceiptOrder(o)}>View</button>
            </div>
          </div>
        ))}
        {!orders.length && <div style={{ padding: 20 }} className="text-muted">No orders yet.</div>}
      </div>

      {receiptOrder && <ReceiptModal order={receiptOrder} restaurant={me} onClose={() => setReceiptOrder(null)} />}
    </div>
  );
}
