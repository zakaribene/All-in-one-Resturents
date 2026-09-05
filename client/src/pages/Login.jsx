import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAdminAuth, useRestaurantAuth } from '../lib/AuthContext';

export default function Login() {
  const { isAuthed: isAdminAuthed, login: adminLogin } = useAdminAuth();
  const { isAuthed: isRestaurantAuthed, login: restaurantLogin } = useRestaurantAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(1200px 600px at 50% -10%, #E8EEFB, #EEF1F6)',
      }}
    >
      <div style={{
        position: 'absolute', top: -120, left: -100, width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)',
        filter: 'blur(10px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -140, right: -110, width: 380, height: 380, borderRadius: '50%',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--purple) 26%, transparent), transparent 70%)',
        filter: 'blur(10px)', pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 800, fontSize: 26, marginBottom: 14,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            boxShadow: '0 14px 28px -12px color-mix(in srgb, var(--accent) 55%, transparent)',
          }}>M</div>
          <div style={{ fontWeight: 800, fontSize: 21, letterSpacing: '-.02em' }}>Miis</div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 600 }}>Restaurant OS</div>
        </div>

        <form
          onSubmit={onSubmit}
          className="card"
          style={{ padding: 32, boxShadow: '0 30px 70px -30px rgba(16,26,43,.35)' }}
        >
          <h1 style={{ margin: '0 0 3px', fontSize: 22, letterSpacing: '-.02em' }}>Ku soo dhawoow · Welcome back</h1>
          <p style={{ margin: '0 0 24px', color: 'var(--muted-1)', fontSize: 14 }}>
            Gal akoonkaaga · Sign in to continue.
          </p>

          {idleNote && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-1)', background: 'var(--panel-2)',
              border: '1px solid var(--border-soft)', borderRadius: 10, padding: '9px 12px',
              fontSize: 13, fontWeight: 600, marginBottom: 14,
            }}>
              Waa lagaa saaray 15 daqiiqo oo aan firfircooni lahayn · Signed out after 15 minutes of inactivity.
            </div>
          )}

          <label className="field-label">Isticmaale · Username</label>
          <input
            className="field-input"
            style={{ marginBottom: 16 }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />

          <label className="field-label">Furaha sirta · Password</label>
          <input
            className="field-input"
            style={{ marginBottom: 12 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)', borderRadius: 10, padding: '9px 12px',
              fontSize: 13, fontWeight: 600, marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', padding: 13 }} disabled={busy} type="submit">
            {busy ? 'Gelayo…' : 'Gal · Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 22, fontSize: 12, color: 'var(--muted-3)', textAlign: 'center', maxWidth: 420 }}>
          Macaamiisha waxay soo galaan iyagoo scan-gareeya QR-ka miiska ·
          {' '}Customers get in by scanning the QR code on their table.
        </div>
      </div>
    </div>
  );
}
