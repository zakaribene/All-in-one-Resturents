import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, QrCode, CreditCard, Store, Clock } from 'lucide-react';
import { useAdminAuth, useRestaurantAuth } from '../lib/AuthContext';

const HIGHLIGHTS = [
  { icon: QrCode, text: 'QR-ka miiska iyo jikada tooska ah · QR ordering & live kitchen' },
  { icon: CreditCard, text: 'Lacag-bixin, kharashaad iyo warbixinno · Payments, expenses & reports' },
  { icon: Store, text: 'Maqaayado badan hal gal · Multi-venue from one login' },
];

export default function Login() {
  const { isAuthed: isAdminAuthed, login: adminLogin } = useAdminAuth();
  const { isAuthed: isRestaurantAuthed, login: restaurantLogin } = useRestaurantAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [idleNote] = useState(() => {
    try {
      if (sessionStorage.getItem('miis_idle_logout')) {
        sessionStorage.removeItem('miis_idle_logout');
        return true;
      }
    } catch { /* ignore */ }
    return false;
  });
  const navigate = useNavigate();

  if (isAdminAuthed) return <Navigate to="/admin/overview" replace />;
  if (isRestaurantAuthed) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const admin = await adminLogin(username, password);
    if (admin.ok) {
      setBusy(false);
      navigate('/admin/overview');
      return;
    }

    const restaurant = await restaurantLogin(username, password);
    setBusy(false);
    if (restaurant.ok) navigate('/dashboard');
    else setError(restaurant.error || 'Isticmaale ama furaha sirta ayaa qalad · Invalid username or password');
  }

  return (
    <div className="login-shell">
      <style>{LOGIN_CSS}</style>

      {/* ── Brand panel ── */}
      <aside className="login-brand" aria-hidden="true">
        <div className="login-brand__glow login-brand__glow--a" />
        <div className="login-brand__glow login-brand__glow--b" />
        <div className="login-brand__grid" />

        <div className="login-brand__inner">
          <div className="login-brand__top">
            <div className="login-mark">M</div>
            <div>
              <div className="login-mark__name">Miis</div>
              <div className="login-mark__sub">Restaurant OS</div>
            </div>
          </div>

          <div className="login-brand__mid">
            <h2 className="login-brand__headline">
              Maamul maqaayadaada<br />meel kasta ood joogto.
            </h2>
            <p className="login-brand__lede">
              Hal nidaam oo isku xiraya dalabyada, jikada, lacagta iyo warbixinnada.
            </p>

            <ul className="login-brand__list">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span className="login-brand__ico"><Icon size={15} strokeWidth={2.5} /></span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="login-brand__foot">© {new Date().getFullYear()} Miis · Tabaarak</div>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="login-main">
        <div className="login-card">
          <div className="login-card__logo">
            <div className="login-mark login-mark--sm">M</div>
            <div>
              <div className="login-mark__name" style={{ fontSize: 16 }}>Miis</div>
              <div className="login-mark__sub">Restaurant OS</div>
            </div>
          </div>

          <h1 className="login-card__title">Ku soo dhawoow · Welcome back</h1>
          <p className="login-card__sub">Gal akoonkaaga si aad u sii wadato · Sign in to continue.</p>

          {idleNote && (
            <div className="login-note">
              <Clock size={14} strokeWidth={2.25} />
              Waa lagaa saaray 15 daqiiqo oo aan firfircooni lahayn · Signed out after 15 minutes of inactivity.
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            <label className="field-label" htmlFor="login-username">Isticmaale · Username</label>
            <div className="login-field">
              <User className="login-field__ico" size={16} strokeWidth={2.25} />
              <input
                id="login-username"
                className="field-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            <label className="field-label" htmlFor="login-password">Furaha sirta · Password</label>
            <div className="login-field">
              <Lock className="login-field__ico" size={16} strokeWidth={2.25} />
              <input
                id="login-password"
                className="field-input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? 'Qari furaha sirta' : 'Muuji furaha sirta'}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} strokeWidth={2.25} /> : <Eye size={16} strokeWidth={2.25} />}
              </button>
            </div>

            {error && (
              <div className="login-error" role="alert">{error}</div>
            )}

            <button className="btn btn-primary login-submit" disabled={busy} type="submit">
              {busy ? (
                <><span className="login-spinner" /> Gelayo…</>
              ) : (
                <>Gal · Sign in <ArrowRight size={16} strokeWidth={2.5} /></>
              )}
            </button>
          </form>

          <div className="login-card__foot">
            Macaamiisha waxay soo galaan iyagoo scan-gareeya QR-ka miiska ·{' '}
            Customers get in by scanning the QR code on their table.
          </div>
        </div>
      </main>
    </div>
  );
}

const LOGIN_CSS = `
.login-shell {
  min-height: 100vh; min-height: 100dvh;
  display: grid; grid-template-columns: 1fr;
  background: var(--bg); color: var(--text);
}
@media (min-width: 940px) {
  .login-shell { grid-template-columns: 1.05fr 1fr; }
}

/* Brand panel */
.login-brand { display: none; }
@media (min-width: 940px) {
  .login-brand {
    display: block; position: relative; overflow: hidden;
    background: linear-gradient(155deg, var(--accent) 0%, #4F46E5 45%, var(--purple) 100%);
    color: #fff;
  }
}
.login-brand__grid {
  position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(120% 90% at 20% 10%, #000 30%, transparent 75%);
}
.login-brand__glow { position: absolute; border-radius: 50%; filter: blur(30px); pointer-events: none; }
.login-brand__glow--a { top: -140px; right: -120px; width: 380px; height: 380px; background: rgba(255,255,255,.28); }
.login-brand__glow--b { bottom: -160px; left: -120px; width: 420px; height: 420px; background: rgba(139,92,246,.45); }
.login-brand__inner {
  position: relative; z-index: 1; height: 100%;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: clamp(40px, 6vw, 76px);
}
.login-brand__top { display: flex; align-items: center; gap: 14px; }
.login-brand__mid { max-width: 460px; }
.login-brand__headline {
  margin: 0 0 16px; font-size: clamp(28px, 3vw, 40px); line-height: 1.15;
  font-weight: 800; letter-spacing: -.025em;
}
.login-brand__lede { margin: 0 0 34px; font-size: 15.5px; line-height: 1.6; color: rgba(255,255,255,.82); }
.login-brand__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.login-brand__list li { display: flex; align-items: center; gap: 13px; font-size: 14.5px; font-weight: 600; color: rgba(255,255,255,.95); }
.login-brand__ico {
  flex: 0 0 auto; width: 30px; height: 30px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.22);
}
.login-brand__foot { font-size: 12.5px; color: rgba(255,255,255,.65); font-weight: 500; }

/* Shared mark */
.login-mark {
  width: 52px; height: 52px; border-radius: 15px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 24px; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  box-shadow: 0 14px 30px -12px color-mix(in srgb, var(--accent) 60%, transparent);
}
.login-brand .login-mark {
  background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.25);
  box-shadow: none;
}
.login-mark--sm { width: 40px; height: 40px; border-radius: 12px; font-size: 19px; }
.login-mark__name { font-weight: 800; font-size: 19px; letter-spacing: -.02em; line-height: 1.15; }
.login-brand .login-mark__name { color: #fff; }
.login-mark__sub { font-size: 11.5px; font-weight: 600; color: var(--muted-2); letter-spacing: .01em; }
.login-brand .login-mark__sub { color: rgba(255,255,255,.7); }

/* Form panel */
.login-main {
  display: flex; align-items: center; justify-content: center;
  padding: clamp(28px, 6vw, 56px) clamp(20px, 5vw, 48px);
}
.login-card {
  width: 100%; max-width: 400px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 20px; padding: clamp(26px, 4vw, 38px);
  box-shadow: 0 1px 2px rgba(16,26,43,.04), 0 30px 70px -34px rgba(16,26,43,.28);
}
.login-card__logo { display: flex; align-items: center; gap: 12px; margin-bottom: 26px; }
@media (min-width: 940px) { .login-card__logo { display: none; } }
.login-card__title { margin: 0 0 5px; font-size: 22px; font-weight: 800; letter-spacing: -.025em; }
.login-card__sub { margin: 0 0 24px; color: var(--muted-1); font-size: 13.5px; line-height: 1.5; }

.login-note {
  display: flex; align-items: flex-start; gap: 8px; margin-bottom: 18px;
  color: var(--muted-4); background: var(--panel-2);
  border: 1px solid var(--border-soft); border-radius: 11px;
  padding: 10px 13px; font-size: 12.5px; font-weight: 600; line-height: 1.45;
}
.login-note svg { flex: 0 0 auto; margin-top: 1px; }

.login-field { position: relative; margin-bottom: 16px; }
.login-field__ico {
  position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
  color: var(--muted-2); pointer-events: none;
}
.login-field .field-input { padding-left: 39px; }
.login-field:has(.login-field__toggle) .field-input { padding-right: 42px; }
.login-field__toggle {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px; border: none;
  background: transparent; color: var(--muted-2); cursor: pointer;
}
.login-field__toggle:hover { color: var(--muted-4); background: var(--panel-2); }

.login-error {
  color: var(--danger); background: var(--danger-bg);
  border: 1px solid var(--danger-border); border-radius: 11px;
  padding: 10px 13px; font-size: 12.5px; font-weight: 600; line-height: 1.45;
  margin-bottom: 16px;
}

.login-submit {
  width: 100%; padding: 13px; margin-top: 4px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 14px; border-radius: 11px;
}
.login-submit svg { transition: transform .15s ease; }
.login-submit:not(:disabled):hover svg { transform: translateX(3px); }

.login-spinner {
  width: 15px; height: 15px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.4); border-top-color: #fff;
  animation: login-spin .6s linear infinite;
}
@keyframes login-spin { to { transform: rotate(360deg); } }

.login-card__foot {
  margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border-soft);
  font-size: 12px; line-height: 1.55; color: var(--muted-3); text-align: center;
}
`;
