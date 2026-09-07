import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, Bell, CreditCard, MessageSquare, Settings, Database } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import ThemeToggle from '../../components/ThemeToggle';
import AdminProfileMenu from '../../components/AdminProfileMenu';
import ToastStack from '../../components/ToastStack';
import { useConfirm } from '../../components/useConfirm';
import { api } from '../../lib/api';
import { useToasts } from '../../lib/useToasts';

const NAV = [
  { id: 'overview', so: 'Guudmar', en: 'Overview', icon: LayoutDashboard },
  { id: 'restaurants', so: 'Maqaayadaha', en: 'Restaurants', icon: Store },
  { id: 'notifications', so: 'Fariimaha', en: 'Notifications', icon: Bell },
  { id: 'billing', so: 'Lacagta', en: 'Billing', icon: CreditCard },
  { id: 'sms', so: 'SMS', en: 'SMS', icon: MessageSquare },
  { id: 'data', so: 'Xogta', en: 'Data', icon: Database },
  { id: 'settings', so: 'Dejinta', en: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { toasts, addToast, dismissToast } = useToasts();
  const { confirm, confirmNode } = useConfirm();
  const active = NAV.find((n) => location.pathname.includes(n.id))?.id || 'overview';

  useEffect(() => {
    api.get('/admin/me').then((r) => setMe(r.data));
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  return (
    <div className="app-root">
      <TopBar
        onMenu={() => setNavOpen(true)}
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
                <span className="hide-xs">Profile</span>
              </button>
              {profileOpen && <AdminProfileMenu me={me} onClose={() => setProfileOpen(false)} />}
            </div>
          </>
        }
      />
      <div className="app-shell">
        <Sidebar
          eyebrow="Admin Console"
          navItems={NAV}
          activeId={active}
          open={navOpen}
          onClose={() => setNavOpen(false)}
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
          <Outlet context={{ addToast, confirm }} />
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {confirmNode}
    </div>
  );
}
