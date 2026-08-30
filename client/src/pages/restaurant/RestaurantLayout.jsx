import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, ShoppingCart, CreditCard, UtensilsCrossed, FolderOpen, QrCode } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import ProfileMenu from '../../components/ProfileMenu';
import NotificationBell from '../../components/NotificationBell';
import ThemeToggle from '../../components/ThemeToggle';
import ToastStack from '../../components/ToastStack';
import { useConfirm } from '../../components/useConfirm';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { playBeep } from '../../lib/toast';
import { useToasts } from '../../lib/useToasts';

const NAV = [
  { id: 'overview', so: 'Guudmar', en: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', so: 'Dalabyada', en: 'Orders', icon: ClipboardList },
  { id: 'pos', so: 'Dalab macmiil', en: 'POS', icon: ShoppingCart },
  { id: 'payments', so: 'Lacag-bixinada', en: 'Payments', icon: CreditCard },
  { id: 'products', so: 'Cuntooyinka', en: 'Products', icon: UtensilsCrossed },
  { id: 'categories', so: 'Qaybaha', en: 'Categories', icon: FolderOpen },
  { id: 'qr', so: 'QR Codes', en: 'QR Codes', icon: QrCode },
];

export default function RestaurantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [ringing, setRinging] = useState(false);
  const { toasts, addToast, dismissToast } = useToasts();
  const { confirm, confirmNode } = useConfirm();
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const active = NAV.find((n) => location.pathname.includes(n.id))?.id || null;

  useEffect(() => {
    api.get('/restaurant/me').then((r) => setMe(r.data));
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    const socket = getSocket();
    socket.emit('join:restaurant', me.id);

    function ring() {
      setRinging(true);
      setTimeout(() => setRinging(false), 800);
    }
    function pushNotification(title, body) {
      setNotifications((prev) => [{ id: 'n' + Date.now() + Math.random(), title, body, time: Date.now() }, ...prev].slice(0, 30));
    }
    function onNewOrder(order) {
      const chLabel = order.channel === 'online' ? 'Online' : order.channel === 'takeaway' ? 'Takeaway' : 'Miis ' + order.tableLabel;
      const title = 'Dalab cusub · New order #' + order.number;
      const body = `${chLabel} · ${order.phone}`;
      addToast({ title, body });
      pushNotification(title, body);
      if (soundOnRef.current) playBeep();
      ring();
    }
    function onNotification(n) {
      addToast({ title: n.title, body: n.body });
      pushNotification(n.title, n.body);
      ring();
    }
    socket.on('order:new', onNewOrder);
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('notification:new', onNotification);
    };
  }, [me?.id, addToast]);

  return (
    <div className="app-root">
      <TopBar
        right={
          <>
            <ThemeToggle />
            <NotificationBell notifications={notifications} ringing={ringing} onClearAll={() => setNotifications([])} />
            <div style={{ position: 'relative' }}>
              <button className="btn-outline" onClick={() => setProfileOpen((v) => !v)}>
                <div style={{
                  width: 22, height: 22, borderRadius: 7, background: `hsl(${me?.hue ?? 212} 65% 95%)`, color: `hsl(${me?.hue ?? 212} 55% 42%)`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, overflow: 'hidden', marginRight: 8, verticalAlign: 'middle',
                }}>
                  {me?.logoUrl ? <img src={me.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (me?.name?.[0] || '·')}
                </div>
                Profile
              </button>
              {profileOpen && <ProfileMenu me={me} setMe={setMe} onClose={() => setProfileOpen(false)} />}
            </div>
          </>
        }
      />
      <div className="app-shell">
        <Sidebar
          header={
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px 16px', cursor: 'pointer' }}
              onClick={() => navigate('/dashboard/overview')}
            >
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
          <Outlet context={{ me, setMe, soundOn, setSoundOn, addToast, confirm }} />
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {confirmNode}
    </div>
  );
}
