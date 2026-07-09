import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useRestaurantAuth } from '../../lib/AuthContext';

export default function RestaurantLogin() {
  const { isAuthed, login } = useRestaurantAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (isAuthed) return <Navigate to="/dashboard/orders" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await login(username, password);
    setBusy(false);
    if (res.ok) navigate('/dashboard/orders');
    else setError(res.error);
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
        background: 'radial-gradient(1200px 500px at 50% -10%, #E8EEFB, #EEF1F6)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 30px 70px -30px rgba(16,26,43,.35)' }}>
        <div style={{ height: 120, background: 'repeating-linear-gradient(135deg, hsl(212 45% 90%) 0 12px, hsl(212 45% 86%) 12px 24px)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, bottom: 8, right: 0, textAlign: 'center', fontSize: 11, color: '#5b6b86' }} className="mono">cover photo · sawirka maqaayada</div>
        </div>
        <div style={{ padding: '0 30px 30px', marginTop: -34 }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: '#fff', border: '1px solid var(--border)', boxShadow: '0 8px 20px -8px rgba(16,26,43,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, color: 'var(--accent)', marginBottom: 16 }}>
            🍽
          </div>
          <form onSubmit={onSubmit}>
            <h1 style={{ margin: '0 0 3px', fontSize: 22, letterSpacing: '-.02em' }}>Ku soo dhawoow · Welcome back</h1>
            <p style={{ margin: '0 0 22px', color: 'var(--muted-1)', fontSize: 14 }}>Gal akoonkaaga maqaayada · Sign in to your venue.</p>

            <label className="field-label">Isticmaale · Username</label>
            <input className="field-input" style={{ marginBottom: 16 }} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

            <label className="field-label">Furaha sirta · Password</label>
            <input className="field-input" style={{ marginBottom: 12 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

            <button className="btn btn-primary" style={{ width: '100%', padding: 13 }} disabled={busy} type="submit">
              {busy ? 'Gelayo…' : 'Gal · Login'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--muted-3)' }}>
            Powered by <b style={{ color: 'var(--muted-4)' }}>Miis</b> · Restaurant OS
          </div>
        </div>
      </div>
    </div>
  );
}
