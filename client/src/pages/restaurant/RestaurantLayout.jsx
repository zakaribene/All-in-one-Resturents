import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import { useRestaurantAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';

const NAV = [
  { id: 'orders', so: 'Dalabyada', en: 'Orders', ic: '▤' },
  { id: 'products', so: 'Cuntooyinka', en: 'Products', ic: '◈' },
  { id: 'categories', so: 'Qaybaha', en: 'Categories', ic: '≡' },
  { id: 'sales', so: 'Iibka', en: 'Sales', ic: '↗' },
  { id: 'qr', so: 'QR Codes', en: 'QR Codes', ic: '▦' },
];

export default function RestaurantLayout() {
  const { logout } = useRestaurantAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const active = NAV.find((n) => location.pathname.includes(n.id))?.id || 'orders';

  useEffect(() => {
    api.get('/restaurant/me').then((r) => setMe(r.data));
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar
        right={
          <button className="btn-outline" onClick={() => { logout(); navigate('/'); }}>
            Ka bax · Logout
          </button>
        }
      />
      <div className="app-shell" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <Sidebar
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px 16px' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, background: `hsl(${me?.hue ?? 212} 65% 95%)`, color: `hsl(${me?.hue ?? 212} 55% 42%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, overflow: 'hidden',
              }}>
                {me?.logoUrl ? <img src={me.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (me?.name?.[0] || '·')}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{me?.name || 'Loading…'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{me?.city} · {me?.plan}</div>
              </div>
            </div>
          }
          navItems={NAV}
          activeId={active}
          onSelect={(id) => navigate('/dashboard/' + id)}
        />
        <main className="main-area tight">
          <Outlet context={{ me, setMe }} />
        </main>
      </div>
    </div>
  );
}
