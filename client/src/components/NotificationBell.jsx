import { useState } from 'react';

function timeAgo(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Hadda · now';
  if (mins < 60) return mins + 'm ago';
  return Math.round(mins / 60) + 'h ago';
}

export default function NotificationBell({ notifications, ringing, onClearAll }) {
  const [open, setOpen] = useState(false);
  const count = notifications.length;

  return (
    <div style={{ position: 'relative' }}>
      <button className={'bell-btn' + (ringing ? ' ringing' : '')} onClick={() => setOpen((v) => !v)} title="Ogeysiisyada · Notifications">
        🔔
        {count > 0 && <span className="bell-badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 80, width: 320, maxHeight: 420,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 24px 60px -20px rgba(16,26,43,.35)', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-soft)' }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>Ogeysiisyada · Notifications {count > 0 && `(${count})`}</span>
              {count > 0 && (
                <button
                  onClick={() => onClearAll()}
                  style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Tirtir dhammaan · Clear all
                </button>
              )}
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {!count && (
                <div className="text-muted" style={{ padding: 26, textAlign: 'center', fontSize: 13 }}>Ogeysiis lama helin · No notifications.</div>
              )}
              {notifications.map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flex: '0 0 auto' }}>🔔</div>
                  <div style={{ minWidth: 0, lineHeight: 1.35 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{n.body}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-3)', marginTop: 2 }}>{timeAgo(n.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
