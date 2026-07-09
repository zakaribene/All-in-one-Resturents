import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import ThemeToggle from '../../components/ThemeToggle';
import AdminProfileMenu from '../../components/AdminProfileMenu';
import { api } from '../../lib/api';

const NAV = [
  { id: 'overview', so: 'Guudmar', en: 'Overview', ic: '▤' },
  { id: 'restaurants', so: 'Maqaayadaha', en: 'Restaurants', ic: '⌂' },
  { id: 'notifications', so: 'Fariimaha', en: 'Notifications', ic: '◉' },
  { id: 'billing', so: 'Lacagta', en: 'Billing', ic: '▸' },
  { id: 'settings', so: 'Dejinta', en: 'Settings', ic: '⚙' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const active = NAV.find((n) => location.pathname.includes(n.id))?.id || 'overview';

  useEffect(() => {
    api.get('/admin/me').then((r) => setMe(r.data));
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar
        right={
          <>
            <ThemeToggle />
            <div style={{ position: 'relative' }}>
              <button className="btn-outline" onClick={() => setProfileOpen((v) => !v)}>
                <div style={{
                  width: 22, height: 22, borderRadius: 7, background: 'var(--text)', color: 'var(--surface)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, marginRight: 8, verticalAlign: 'middle',
                }}>
                  {(me?.name || 'SA').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                Profile
              </button>
              {profileOpen && <AdminProfileMenu me={me} onClose={() => setProfileOpen(false)} />}
            </div>
          </>
        }
      />
      <div className="app-shell" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <Sidebar
          eyebrow="Admin Console"
          navItems={NAV}
          activeId={active}
          onSelect={(id) => navigate('/admin/' + id)}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--panel-2)', borderRadius: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 99, background: 'var(--text)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                {(me?.name || 'Super Admin').split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{me?.name || 'Super Admin'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>Platform owner</div>
              </div>
            </div>
          }
        />
        <main className="main-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
