import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../lib/api';

function channelMeta(channel, tableLabel) {
  if (channel === 'online') return { label: 'Online', icon: '🌐' };
  if (channel === 'takeaway') return { label: 'Takeaway', icon: '🛒' };
  return { label: 'Miis ' + tableLabel, icon: '📍' };
}

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  if (mins < 60) return mins + 'm ago';
  return Math.round(mins / 60) + 'h ago';
}

const STATUS_TONE = { new: '#E5484D', preparing: '#B5750B', done: '#12A150' };

export default function Overview() {
  const { me } = useOutletContext();
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);

  useEffect(() => {
    api.get('/restaurant/orders').then((r) => setOrders(r.data));
    api.get('/restaurant/products').then((r) => setProducts(r.data));
  }, []);

  if (!orders || !products) return <div className="text-muted">Loading…</div>;

  const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
  const todayOrders = orders.filter((o) => isToday(o.createdAt));
  const todayRevenue = todayOrders.reduce((a, o) => a + o.total, 0);
  const activeProducts = products.filter((p) => p.status === 'active').length;

  const counts = {
    new: orders.filter((o) => o.status === 'new').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    done: orders.filter((o) => o.status === 'done').length,
  };
  const maxCount = Math.max(1, counts.new, counts.preparing, counts.done);

  const stats = [
    { so: 'Dalabyada maanta', en: 'Orders today', val: String(todayOrders.length), sub: `${orders.length} total · guud ahaan`, tone: 'var(--accent)' },
    { so: 'Dakhliga maanta', en: 'Revenue today', val: `$${todayRevenue.toFixed(2)}`, sub: 'Pay at table · lacagta miiska', tone: '#12A150' },
    { so: 'Cuntooyinka firfircoon', en: 'Active products', val: String(activeProducts), sub: `${products.length} total`, tone: '#8B5CF6' },
    { so: 'Qorshaha', en: 'Plan', val: me?.plan || '—', sub: me?.city || '', tone: '#E8A317' },
  ];

  const recent = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>{me?.name} · Dashboard</h1>
        <p className="page-sub">Guudmarka maqaayadaada · Your restaurant at a glance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
        {stats.map((st, i) => (
          <div className="stat-card" key={i}>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, marginBottom: 10 }}>{st.en} · {st.so}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{st.val}</div>
            {st.sub && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: st.tone }}>{st.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Dalabyada xaaladdooda · Orders by status</div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 18 }}>Dhammaan dalabyada la soo diray · All orders received</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['new', 'Cusub · New'], ['preparing', 'Diyaarin · Preparing'], ['done', 'Diyaar · Done']].map(([k, label]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 140, fontSize: 13, fontWeight: 600, color: 'var(--muted-5)' }}>{label}</div>
                <div style={{ flex: 1, height: 10, background: 'var(--border-soft)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(counts[k] / maxCount) * 100}%`, background: STATUS_TONE[k], borderRadius: 99 }} />
                </div>
                <div style={{ width: 30, textAlign: 'right', fontSize: 12, fontWeight: 700 }} className="mono">{counts[k]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>Dalabyadii ugu dambeeyay · Recent orders</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {recent.map((o) => {
              const m = channelMeta(o.channel, o.tableLabel);
              return (
                <div key={o.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 9, height: 9, borderRadius: 99, background: STATUS_TONE[o.status], marginTop: 5, flex: '0 0 auto' }} />
                  <div style={{ lineHeight: 1.35 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>#{o.number} · {m.icon} {m.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>${o.total.toFixed(2)} · {timeAgo(o.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            {!recent.length && <div className="text-muted" style={{ fontSize: 13 }}>No orders yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
