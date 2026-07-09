import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../lib/AuthContext';

export default function AdminProfileMenu({ me, onClose }) {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
      <div
        style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 80, width: 280,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 60px -20px rgba(16,26,43,.35)', padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--text)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flex: '0 0 auto' }}>
            {(me?.name || 'Super Admin').split(' ').map((w) => w[0]).slice(0, 2).join('')}
          </div>
          <div style={{ lineHeight: 1.3, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{me?.name || 'Super Admin'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>@{me?.username || '—'}</div>
          </div>
        </div>

        <button
          className="btn-outline"
          style={{ width: '100%', marginBottom: 8, justifyContent: 'flex-start' }}
          onClick={() => { onClose(); navigate('/admin/settings'); }}
        >
          ⚙ Settings · Dejinta
        </button>

        <button
          className="btn-outline"
          style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
          onClick={() => { logout(); navigate('/'); }}
        >
          Ka bax · Logout
        </button>
      </div>
    </>
  );
}
