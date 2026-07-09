import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../lib/AuthContext';

export default function AdminLogin() {
  const { isAuthed, login } = useAdminAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (isAuthed) return <Navigate to="/admin/overview" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await login(username, password);
    setBusy(false);
    if (res.ok) navigate('/admin/overview');
    else setError(res.error);
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
        background: 'radial-gradient(1200px 500px at 50% -10%, #E8EEFB, #EEF1F6)',
      }}
    >
      <form onSubmit={onSubmit} className="card" style={{ width: '100%', maxWidth: 400, padding: 32, boxShadow: '0 30px 70px -30px rgba(16,26,43,.35)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, marginBottom: 18 }}>M</div>
        <h1 style={{ margin: '0 0 3px', fontSize: 22, letterSpacing: '-.02em' }}>Admin Console</h1>
        <p style={{ margin: '0 0 22px', color: 'var(--muted-1)', fontSize: 14 }}>Gal si aad u maamusho platform-ka · Sign in to manage the platform.</p>

        <label className="field-label">Isticmaale · Username</label>
        <input className="field-input" style={{ marginBottom: 16 }} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

        <label className="field-label">Furaha sirta · Password</label>
        <input className="field-input" style={{ marginBottom: 12 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%', padding: 13 }} disabled={busy} type="submit">
          {busy ? 'Gelayo…' : 'Gal · Login'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--muted-3)' }}>
          Powered by <b style={{ color: 'var(--muted-4)' }}>Miis</b> · Restaurant OS
        </div>
      </form>
    </div>
  );
}
