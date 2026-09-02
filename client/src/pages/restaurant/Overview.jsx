import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClipboardList, Wallet, UtensilsCrossed, Crown, Globe, ShoppingBag, ShoppingCart, MapPin } from 'lucide-react';
import { api } from '../../lib/api';

function channelMeta(channel, tableLabel) {
  if (channel === 'online') return { label: 'Online', Icon: Globe, bg: 'var(--purple-bg)', fg: 'var(--purple)' };
  if (channel === 'takeaway') return { label: 'Takeaway', Icon: ShoppingBag, bg: 'var(--border-soft)', fg: 'var(--muted-4)' };
  if (channel === 'pos') return { label: 'POS · Staff', Icon: ShoppingCart, bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' };
  return { label: 'Miis ' + tableLabel, Icon: MapPin, bg: 'color-mix(in srgb, var(--accent) 12%, var(--surface))', fg: 'var(--accent)' };
}

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  if (mins < 60) return mins + 'm ago';
  return Math.round(mins / 60) + 'h ago';
}

const STATUS_TONE = { new: 'var(--danger)', preparing: 'var(--warning-fg)', done: 'var(--success)' };
const STATUS_BG = { new: 'var(--danger-bg)', preparing: 'var(--warning-bg)', done: 'var(--success-bg)' };

const WALLET_TONES = [
  { tone: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 12%, var(--surface))' },
  { tone: 'var(--success)', bg: 'var(--success-bg)' },
  { tone: 'var(--purple)', bg: 'var(--purple-bg)' },
  { tone: 'var(--warning-fg)', bg: 'var(--warning-bg)' },
];

const money = (n) => '$' + Number(n || 0).toFixed(2);

export default function Overview() {
  const { me } = useOutletContext();
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    api.get('/restaurant/orders').then((r) => setOrders(r.data));
    api.get('/restaurant/products').then((r) => setProducts(r.data));
    api.get('/restaurant/payment-methods').then((r) => setMethods(r.data)).catch(() => setMethods([]));
  }, []);

  if (!orders || !products) return <div className="text-muted">Loading…</div>;

  const totalWalletBalance = methods.reduce((a, m) => a + (m.balance || 0), 0);

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
  const totalOrders = counts.new + counts.preparing + counts.done;

  const stats = [
    { so: 'Dalabyada maanta', en: 'Orders today', val: String(todayOrders.length), sub: `${orders.length} total · guud ahaan`, Icon: ClipboardList, tone: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 12%, var(--surface))' },
    { so: 'Dakhliga maanta', en: 'Revenue today', val: `$${todayRevenue.toFixed(2)}`, sub: 'Pay at table · lacagta miiska', Icon: Wallet, tone: 'var(--success)', bg: 'var(--success-bg)' },
    { so: 'Cuntooyinka firfircoon', en: 'Active products', val: String(activeProducts), sub: `${products.length} total`, Icon: UtensilsCrossed, tone: 'var(--purple)', bg: 'var(--purple-bg)' },
    { so: 'Qorshaha', en: 'Plan', val: me?.plan || '—', sub: me?.city || '', Icon: Crown, tone: 'var(--warning-fg)', bg: 'var(--warning-bg)' },
  ];

  const recent = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flex: '0 0 auto', overflow: 'hidden',
          background: `hsl(${me?.hue ?? 212} 65% 95%)`, color: `hsl(${me?.hue ?? 212} 55% 42%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18,
        }}>
          {me?.logoUrl ? <img src={me.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (me?.name?.[0] || '·')}
        </div>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, marginBottom: 2 }}>{me?.name} · Dashboard</h1>
          <p className="page-sub">Guudmarka maqaayadaada · Your restaurant at a glance.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
        {stats.map((st, i) => (
          <div className="stat-card" key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, lineHeight: 1.4 }}>{st.en}<br />{st.so}</div>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flex: '0 0 auto', background: st.bg, color: st.tone,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <st.Icon size={16} strokeWidth={2.25} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>{st.val}</div>
            {st.sub && <div style={{ fontSize: 12, fontWeight: 700, color: st.tone }}>{st.sub}</div>}
          </div>
        ))}
      </div>

      {!!methods.length && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Xisaabaadka lacagta · Wallet balances</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Hadhaaga guud ee hab kasta · All-time balance of each payment method</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>
              Wadarta guud · Total <b style={{ color: 'var(--text)' }}>{money(totalWalletBalance)}</b>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            {methods.map((m, i) => {
              const t = WALLET_TONES[i % WALLET_TONES.length];
              return (
                <div className="card card-pad" key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: m.status === 'active' ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{m.name}</div>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flex: '0 0 auto', background: t.bg, color: t.tone,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Wallet size={16} strokeWidth={2.25} />
                    </div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>{money(m.balance)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.tone }}>
                    Maanta · Today +{money(m.todayTotal)}
                  </div>
                  {m.status !== 'active' && (
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger)' }}>⏸ La xiray · Disabled</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Dalabyada xaaladdooda · Orders by status</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--muted-3)', fontWeight: 700 }}>{totalOrders} total</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 20 }}>Dhammaan dalabyada la soo diray · All orders received</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[['new', 'Cusub · New'], ['preparing', 'Diyaarin · Preparing'], ['done', 'Diyaar · Done']].map(([k, label]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: STATUS_TONE[k], flex: '0 0 auto' }} />
                <div style={{ width: 122, fontSize: 13, fontWeight: 600, color: 'var(--muted-5)' }}>{label}</div>
                <div style={{ flex: 1, height: 8, background: 'var(--border-soft)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(counts[k] / maxCount) * 100}%`, background: STATUS_TONE[k], borderRadius: 99, transition: 'width .4s ease' }} />
                </div>
                <span
                  className="mono"
                  style={{ minWidth: 28, textAlign: 'center', fontSize: 12, fontWeight: 800, color: STATUS_TONE[k], background: STATUS_BG[k], borderRadius: 7, padding: '3px 7px' }}
                >
                  {counts[k]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>Dalabyadii ugu dambeeyay · Recent orders</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recent.map((o) => {
              const m = channelMeta(o.channel, o.tableLabel);
              return (
                <div key={o.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flex: '0 0 auto', background: m.bg, color: m.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <m.Icon size={14} strokeWidth={2.25} />
                  </div>
                  <div style={{ lineHeight: 1.35, minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{o.number} · {m.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>${o.total.toFixed(2)} · {timeAgo(o.createdAt)}</div>
                  </div>
                  <span
                    className="pill" style={{ fontSize: 10, fontWeight: 800, flex: '0 0 auto', background: STATUS_BG[o.status], color: STATUS_TONE[o.status] }}
                  >
                    {o.status}
                  </span>
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
