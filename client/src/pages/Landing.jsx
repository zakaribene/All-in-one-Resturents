import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 20,
        background: 'radial-gradient(1200px 500px at 50% -10%, #E8EEFB, #EEF1F6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 30 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22 }}>M</div>
        <div style={{ lineHeight: 1.1, textAlign: 'left' }}>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-.02em' }}>Miis</div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 600 }}>Restaurant OS</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 620 }}>
        <Link to="/admin/login" className="card" style={{ padding: 26, width: 260, textAlign: 'left', color: 'inherit' }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>⌂</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Admin Guud · Super Admin</div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.5 }}>Maamul dhammaan maqaayadaha · Manage every restaurant on the platform.</div>
        </Link>
        <Link to="/login" className="card" style={{ padding: 26, width: 260, textAlign: 'left', color: 'inherit' }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>⛭</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Maqaayad · Restaurant</div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.5 }}>Gal si aad u maamusho dalabyada, menu-ga iyo QR-ka · Sign in to manage orders, menu &amp; QR codes.</div>
        </Link>
      </div>

      <div style={{ marginTop: 26, fontSize: 12, color: 'var(--muted-3)', textAlign: 'center', maxWidth: 420 }}>
        Macaamiisha waxay soo galaan iyagoo scan-gareeya QR-ka miiska · Customers get in by scanning the QR code on their table.
      </div>
    </div>
  );
}
