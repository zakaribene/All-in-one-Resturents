const GATEWAYS = [
  { key: 'evc', label: 'EVC Plus', bg: '#E7F6EE', fg: '#12A150', short: 'EVC' },
  { key: 'zaad', label: 'ZAAD', bg: '#EEF3FF', fg: '#2563EB', short: 'ZAAD' },
  { key: 'edahab', label: 'eDahab', bg: '#F3E8FF', fg: '#8B5CF6', short: 'eDA' },
];

export default function Billing() {
  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">Lacagta · Billing</h1>
        <p className="page-sub">Qorshayaal iyo lacag-bixin · Plans &amp; payment collection.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 15 }}>Free</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>$0<span style={{ fontSize: 13, color: 'var(--muted-2)', fontWeight: 600 }}>/bil</span></div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.7 }}>1 maqaayad · 20 products<br />QR ordering<br />Basic reports</div>
        </div>
        <div className="card card-pad" style={{ border: '2px solid var(--accent)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -11, left: 22, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 99 }}>POPULAR</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Basic</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>$19<span style={{ fontSize: 13, color: 'var(--muted-2)', fontWeight: 600 }}>/bil</span></div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.7 }}>3 maqaayado · unlimited<br />Live orders + sound<br />Sales filtering</div>
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 15 }}>Pro</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>$49<span style={{ fontSize: 13, color: 'var(--muted-2)', fontWeight: 600 }}>/bil</span></div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.7 }}>Unlimited venues<br />Broadcast notifications<br />Priority support</div>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(180deg,#F8FAFC,#fff)', border: '1px dashed #C7D2E0', borderRadius: 16, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Lacag-bixin toos ah · Payment collection</span>
          <span style={{ background: 'var(--warning-bg)', color: 'var(--warning-fg)', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 99 }}>SOON · MUSTAQBAL</span>
        </div>
        <p style={{ margin: '0 0 18px', color: 'var(--muted-1)', fontSize: 14, maxWidth: 620 }}>
          Isku xir API-ga bixinta si macaamiishu ay si toos ah ugu bixiyaan marka ay dalbadaan. Connect mobile-money so customers pay automatically at checkout.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {GATEWAYS.map((g) => (
            <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', opacity: .85 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: g.bg, color: g.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{g.short}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{g.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>Not connected</div>
              </div>
              <button style={{ marginLeft: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel-2)', color: 'var(--muted-3)', fontSize: 12, fontWeight: 700, cursor: 'not-allowed' }} disabled>Connect</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
