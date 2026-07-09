import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import { useAdminAuth } from '../../lib/AuthContext';

const NAV = [
  { id: 'overview', so: 'Guudmar', en: 'Overview', ic: '▤' },
  { id: 'restaurants', so: 'Maqaayadaha', en: 'Restaurants', ic: '⌂' },
  { id: 'notifications', so: 'Fariimaha', en: 'Notifications', ic: '◉' },
  { id: 'billing', so: 'Lacagta', en: 'Billing', ic: '▸' },
];

export default function AdminLayout() {
  const { logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const active = NAV.find((n) => location.pathname.includes(n.id))?.id || 'overview';

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
          eyebrow="Admin Console"
          navItems={NAV}
          activeId={active}
          onSelect={(id) => navigate('/admin/' + id)}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--panel-2)', borderRadius: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 99, background: 'var(--text)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>SA</div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Super Admin</div>
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
