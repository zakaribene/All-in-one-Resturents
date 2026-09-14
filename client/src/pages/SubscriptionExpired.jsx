import { useNavigate } from 'react-router-dom';

const FALLBACK =
  'Subscription-kaagu wuu dhammaaday. Fadlan bixi lacagta si dashboard-ku u sii shaqeeyo · ' +
  'Your subscription has expired. Please pay your subscription fee to continue.';

export default function SubscriptionExpired() {
  const navigate = useNavigate();
  let message = FALLBACK;
  try {
    message = sessionStorage.getItem('miis_subscription_expired_message') || FALLBACK;
  } catch { /* ignore */ }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg, #F4F5F7)' }}>
      <div className="card card-pad" style={{ maxWidth: 440, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>⏰</div>
        <div style={{ fontWeight: 800, fontSize: 19, marginBottom: 10 }}>Subscription-ka wuu dhammaaday</div>
        <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.7, marginBottom: 24 }}>{message}</div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/', { replace: true })}>
          Ku noqo login-ka · Back to login
        </button>
      </div>
    </div>
  );
}
