import { Menu } from 'lucide-react';

export default function TopBar({ right, onMenu }) {
  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 60, display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px clamp(12px, 3vw, 22px)', background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
        backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)',
      }}
    >
      {onMenu && (
        <button className="nav-toggle" onClick={onMenu} aria-label="Furan liiska · Open menu">
          <Menu size={18} strokeWidth={2.25} />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flex: '0 0 auto' }}>M</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.02em' }}>Miis</span>
          <span className="hide-xs" style={{ fontSize: 11, color: 'var(--muted-2)', fontWeight: 600 }}>Restaurant OS</span>
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </div>
  );
}
