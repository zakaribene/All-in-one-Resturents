export default function TopBar({ right }) {
  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 60, display: 'flex', alignItems: 'center', gap: 18,
        padding: '12px 22px', background: 'color-mix(in srgb, var(--surface) 90%, transparent)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>M</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.02em' }}>Miis</span>
          <span style={{ fontSize: 11, color: 'var(--muted-2)', fontWeight: 600 }}>Restaurant OS</span>
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>{right}</div>
    </div>
  );
}
