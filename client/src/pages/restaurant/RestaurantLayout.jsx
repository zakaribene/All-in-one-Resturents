import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useRestaurantAuth } from '../../lib/AuthContext';
import { useIdleTimer } from '../../lib/useIdleTimer';
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
import { NAV_PAGES, STAFF_PAGE, SETTINGS_PAGE } from '../../lib/navPages';

// Auto sign-out after this long with no activity.
const IDLE_MS = 15 * 60 * 1000;

export default function RestaurantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useRestaurantAuth();
  const [me, setMe] = useState(null);
  const [posLocked, setPosLocked] = useState(false);
  const posInitRef = useRef(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [ringing, setRinging] = useState(false);
  const { toasts, addToast, dismissToast } = useToasts();
  const { confirm, confirmNode } = useConfirm();
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  const isStaff = me?.role === 'staff';
  const allPages = useMemo(() => [...NAV_PAGES, STAFF_PAGE, SETTINGS_PAGE], []);
  // Payments/SMS only appear once the super admin has connected an account for this restaurant.
  const featureAllowed = (id) => {
    if (id === 'payments') return !!me?.paymentsEnabled;
    if (id === 'sms') return !!me?.smsEnabled;
    return true;
  };
  const visibleNav = useMemo(() => {
    const base = isStaff ? NAV_PAGES.filter((n) => me?.permissions?.includes(n.id)) : allPages;
    return base.filter((n) => featureAllowed(n.id));
  }, [isStaff, me, allPages]);
  const active = allPages.find((n) => location.pathname.includes(n.id))?.id || null;
  const hasAccess = !me || !active || (featureAllowed(active) && (!isStaff || me.permissions?.includes(active)));
  const homeId = isStaff ? (visibleNav[0]?.id || 'orders') : 'overview';

  useEffect(() => {
    api.get('/restaurant/me').then((r) => setMe(r.data));
  }, []);

  // POS starts locked for any staff account that has the POS page, so the
  // lock survives navigating away and back (and idle-lock, below).
  useEffect(() => {
    if (!me || posInitRef.current) return;
    posInitRef.current = true;
    if (me.posPinRequired) setPosLocked(true);
  }, [me]);

  // A staff account whose ONLY page is POS: idle should lock the till with the
  // PIN, not sign them out of the whole portal.
  const isPosOnly =
    isStaff &&
    (() => {
      const pages = (me?.permissions || []).filter((p) => allPages.some((n) => n.id === p));
      return pages.length === 1 && pages[0] === 'pos';
    })();

  const handleIdle = useCallback(() => {
    if (isPosOnly && me?.hasPosPin) {
      setPosLocked(true);
      navigate('/dashboard/pos', { replace: true });
    } else {
      try { sessionStorage.setItem('miis_idle_logout', '1'); } catch { /* ignore */ }
      logout();
      navigate('/', { replace: true });
    }
  }, [isPosOnly, me?.hasPosPin, logout, navigate]);

  useIdleTimer(IDLE_MS, handleIdle, !!me);

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
              onClick={() => navigate('/dashboard/' + homeId)}
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
                {isStaff && (
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                    👤 {me.staffName || 'Staff'}
                  </div>
                )}
              </div>
            </div>
          }
          navItems={visibleNav}
          activeId={active}
          onSelect={(id) => navigate('/dashboard/' + id)}
        />
        <main className="main-area tight">
          {hasAccess ? (
            <Outlet context={{ me, setMe, soundOn, setSoundOn, addToast, confirm, posLocked, setPosLocked }} />
          ) : (
            <div className="card card-pad" style={{ textAlign: 'center', padding: 50, maxWidth: 460, margin: '40px auto' }}>
              <ShieldAlert size={30} strokeWidth={1.75} color="var(--danger)" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Fasax kuma lihid · No access</div>
              <div style={{ color: 'var(--muted-1)', fontSize: 13 }}>
                Ma lihid ogolaanshaha boggan · You don't have permission to view this page. La xiriir milkiilaha · Contact the restaurant owner.
              </div>
            </div>
          )}
        </main>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {confirmNode}
    </div>
  );
}
