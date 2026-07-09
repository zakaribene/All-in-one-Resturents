import { useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';

export default function Settings() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match · Furayaasha isku mid ma aha'); return; }
    setBusy(true);
    try {
      await api.patch('/admin/me/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Furaha waa la beddelay · Password updated.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to update password'));
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">Dejinta · Settings</h1>
        <p className="page-sub">Maamul akoonkaaga · Manage your admin account.</p>
      </div>

      <div className="card card-pad" style={{ maxWidth: 440 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Beddel furaha sirta · Change password</div>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted-1)' }}>Fadlan geli furahaaga hore si aad u beddesho · Enter your current password to set a new one.</p>
        <form onSubmit={submit}>
          <label className="field-label">Furaha hore · Current password</label>
          <input className="field-input" style={{ marginBottom: 14 }} type="password" required value={form.currentPassword} onChange={set('currentPassword')} />
          <label className="field-label">Furaha cusub · New password</label>
          <input className="field-input" style={{ marginBottom: 14 }} type="password" required minLength={6} value={form.newPassword} onChange={set('newPassword')} />
          <label className="field-label">Xaqiiji furaha cusub · Confirm new password</label>
          <input className="field-input" style={{ marginBottom: 16 }} type="password" required minLength={6} value={form.confirmPassword} onChange={set('confirmPassword')} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12 }}>{success}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Beddel furaha · Update password'}</button>
        </form>
      </div>
    </div>
  );
}
