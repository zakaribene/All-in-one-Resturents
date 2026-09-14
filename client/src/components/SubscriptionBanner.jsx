import { useEffect, useState } from 'react';

const COLOR_HEX = {
  orange: '#F5A623', red: '#E5484D', purple: '#8B5CF6', blue: '#2563EB', green: '#12A150', pink: '#EC4899',
};

function formatRemaining(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return (days > 0 ? `${days}d ` : '') + `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Live countdown to the end of a super-admin-granted grace period. Ticks client-side
// every second (no polling); when it hits zero it asks the parent to re-check with the
// server, which is what actually locks the dashboard out (enforced in requireRestaurantOrStaff).
export default function SubscriptionBanner({ graceEndsAt, message, color, onExpire }) {
  const [remaining, setRemaining] = useState(() => new Date(graceEndsAt).getTime() - Date.now());
  const [firedExpire, setFiredExpire] = useState(false);

  useEffect(() => {
    setRemaining(new Date(graceEndsAt).getTime() - Date.now());
    setFiredExpire(false);
  }, [graceEndsAt]);

  useEffect(() => {
    const tick = setInterval(() => {
      const left = new Date(graceEndsAt).getTime() - Date.now();
      setRemaining(left);
      if (left <= 0 && !firedExpire) {
        setFiredExpire(true);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [graceEndsAt, firedExpire, onExpire]);

  const bg = COLOR_HEX[color] || COLOR_HEX.orange;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 20px',
      background: bg, color: '#fff', flexWrap: 'wrap', textAlign: 'center',
    }}>
      <span style={{ fontWeight: 700, fontSize: 13, maxWidth: 720 }}>⚠ {message}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.2)',
        border: '1px solid rgba(255,255,255,.35)', borderRadius: 99, padding: '5px 14px', fontSize: 12, fontWeight: 800,
      }}>
        ⏱ WAXAA KUU HARAY <span className="mono">{formatRemaining(remaining)}</span>
      </span>
    </div>
  );
}
