import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../lib/api';
import { useRestaurantAuth } from '../lib/AuthContext';
import { useOutsideClick } from '../lib/useOutsideClick';

export default function ProfileMenu({ me, setMe, onClose }) {
  const { logout } = useRestaurantAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const coverInput = useRef(null);
  const logoInput = useRef(null);
  const panelRef = useRef(null);
  useOutsideClick(panelRef, onClose);

  async function upload(kind, file) {
    if (!file) return;
    setBusy(kind); setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('kind', kind);
      const { data } = await api.post('/restaurant/upload', fd);
      setMe((m) => ({ ...m, [kind === 'logo' ? 'logoUrl' : 'coverUrl']: data.url }));
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to upload image'));
    } finally {
      setBusy('');
    }
  }

  if (!me) return null;
  const isStaff = me.role === 'staff';

  return (
    <div ref={panelRef} className="dropdown-panel" style={{ width: 320, borderRadius: 18 }}>
        <div
          style={{
            height: 110, position: 'relative',
            ...(me.coverUrl
              ? { backgroundImage: `url(${me.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: `repeating-linear-gradient(135deg, hsl(${me.hue ?? 212} 45% 90%) 0 12px, hsl(${me.hue ?? 212} 45% 86%) 12px 24px)` }),
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 55%,rgba(14,26,43,.35))' }} />
          {!isStaff && (
            <button
              className="btn-outline btn-sm"
              style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,.92)', fontSize: 11, padding: '5px 9px' }}
              onClick={() => coverInput.current?.click()}
              disabled={busy === 'cover'}
            >
              📷 {busy === 'cover' ? 'Uploading…' : 'Edit cover'}
            </button>
          )}
          <input ref={coverInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => upload('cover', e.target.files?.[0])} />
        </div>

        <div style={{ padding: '0 18px 18px', marginTop: -30, position: 'relative' }}>
          <div style={{ position: 'relative', width: 62, height: 62, marginBottom: 10 }}>
            <div style={{
              width: 62, height: 62, borderRadius: 16, background: 'var(--surface)', border: '3px solid var(--surface)', boxShadow: '0 8px 20px -8px rgba(16,26,43,.3)',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22,
              color: `hsl(${me.hue ?? 212} 55% 42%)`,
            }}>
              {me.logoUrl ? <img src={me.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (me.name?.[0] || '·')}
            </div>
            {!isStaff && (
              <button
                className="btn btn-primary btn-sm"
                style={{ position: 'absolute', bottom: -3, right: -3, width: 24, height: 24, borderRadius: 99, padding: 0, fontSize: 11 }}
                onClick={() => logoInput.current?.click()}
                disabled={busy === 'logo'}
                title="Beddel logo · Edit logo"
              >✎</button>
            )}
            <input ref={logoInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => upload('logo', e.target.files?.[0])} />
          </div>

          <div style={{ fontWeight: 800, fontSize: 16 }}>{me.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 6 }}>{me.city}</div>
          <span className="pill" style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))', color: 'var(--accent)', fontWeight: 700, fontSize: 11 }}>{me.plan} plan</span>

          {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>{error}</div>}

          <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 16, paddingTop: 12 }}>
            {isStaff ? (
              <div style={{ fontSize: 12, color: 'var(--muted-1)' }}>Shaqaale · Staff: <b style={{ color: 'var(--text)' }}>{me.staffName || '—'}</b></div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted-1)' }}>Milkiile · Owner: <b style={{ color: 'var(--text)' }}>{me.ownerName || '—'}</b></div>
            )}
          </div>

          <button
            className="btn-outline"
            style={{ marginTop: 14, width: '100%', color: 'var(--danger)', borderColor: '#F0C6C6' }}
            onClick={() => { logout(); navigate('/'); }}
          >
            Ka bax · Logout
          </button>
        </div>
    </div>
  );
}
