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
import SubscriptionBanner from '../../components/SubscriptionBanner';
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
  const [navOpen, setNavOpen] = useState(false);
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
  // QR disappears entirely while the super admin has ordering switched off for this restaurant.
  const featureAllowed = (id) => {
    if (id === 'payments') return !!me?.paymentsEnabled;
    if (id === 'sms') return !!me?.smsEnabled;
    if (id === 'qr') return me?.orderingEnabled !== false;
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
    // A 402 here (subscription already expired, e.g. a direct reload after lockout) is
    // handled by the response interceptor in lib/api.js, which redirects on its own.
    api.get('/restaurant/me').then((r) => setMe(r.data)).catch(() => {});
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

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

  function returnToAdmin() {
    logout();
    navigate('/admin/restaurants', { replace: true });
  }

  // Fired when the grace countdown hits zero. Re-checks with the server rather than
  // trusting the local clock — if grace truly ran out, the response interceptor in
  // lib/api.js catches the resulting 402 and bounces to /subscription-expired itself.
  function recheckSubscription() {
    api.get('/restaurant/me').then((r) => setMe(r.data)).catch(() => {});
  }

  // A grace period the admin scheduled ahead of time (bundled with a renewal) stays
  // dormant server-side until subscriptionEndsAt itself passes — see subscriptionStatus()
  // in server/src/utils/subscription.js. Nothing else pushes an update at that exact
  // moment (the admin isn't touching anything), so without this timer an already-open tab
  // would only notice on its next unrelated API call. Mirrors SubscriptionBanner's own
  // countdown-to-recheck pattern, just aimed at subscriptionEndsAt instead of graceEndsAt.
  // Re-schedules itself in <=20h hops rather than one setTimeout(msLeft) — a subscription
  // that's weeks or months out would otherwise overflow setTimeout's ~24.8-day signed
  // 32-bit ceiling and fire (recheck) immediately instead of when it's actually due.
  useEffect(() => {
    if (me?.subscriptionStatus !== 'active' || !me?.subscriptionEndsAt) return;
    const target = new Date(me.subscriptionEndsAt).getTime();
    const MAX_DELAY_MS = 20 * 60 * 60 * 1000;
    let timer;
    function schedule() {
      const msLeft = target - Date.now();
      if (msLeft <= 0) { recheckSubscription(); return; }
      timer = setTimeout(() => {
        if (Date.now() >= target) recheckSubscription();
        else schedule();
      }, Math.min(msLeft + 500, MAX_DELAY_MS));
    }
    schedule();
    return () => clearTimeout(timer);
  }, [me?.subscriptionStatus, me?.subscriptionEndsAt]);

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
    // Pushed the moment the super admin renews/grants/clears a subscription — merges
    // straight into `me` so the grace banner appears, updates, or disappears live,
    // with no reload, no matter what page of the dashboard is currently open.
    function onSubscriptionUpdated(patch) {
      setMe((prev) => (prev ? { ...prev, ...patch } : prev));
    }
    socket.on('order:new', onNewOrder);
    socket.on('notification:new', onNotification);
    socket.on('subscription:updated', onSubscriptionUpdated);
    return () => {
      socket.off('order:new', onNewOrder);
      socket.off('notification:new', onNotification);
      socket.off('subscription:updated', onSubscriptionUpdated);
    };
  }, [me?.id, addToast]);

  return (
    <div className="app-root">
      {me?.subscriptionStatus === 'grace' && me.graceEndsAt && (
        <SubscriptionBanner
          graceEndsAt={me.graceEndsAt} message={me.graceMessage} color={me.graceColor}
          onExpire={recheckSubscription}
        />
      )}
      {me?.impersonating && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '9px 16px',
          background: 'var(--purple, #8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, flexWrap: 'wrap',
        }}>
          <span>👁 Waxaad ku jirtaa dashboard-ka "{me.name}" — Super Admin view</span>
          <button
            onClick={returnToAdmin}
            style={{
              background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.4)',
              borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
          >
            ← Return to admin dashboard
          </button>
        </div>
      )}
      <TopBar
        onMenu={() => setNavOpen(true)}
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
                <span className="hide-xs">Profile</span>
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
          open={navOpen}
          onClose={() => setNavOpen(false)}
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
