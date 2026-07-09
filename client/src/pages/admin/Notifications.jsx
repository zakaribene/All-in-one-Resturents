import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';

export default function Notifications() {
  const [restaurants, setRestaurants] = useState([]);
  const [target, setTarget] = useState('all');
  const [restId, setRestId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/restaurants').then((r) => {
      setRestaurants(r.data);
      if (r.data.length) setRestId(r.data[0].id);
    });
  }, []);

  async function send() {
    if (!title.trim()) return;
    setError('');
    try {
      await api.post('/admin/notifications', { target, restaurantId: target === 'single' ? restId : undefined, title, body });
      setSent(true);
      setTimeout(() => { setSent(false); setTitle(''); setBody(''); }, 1800);
    } catch (e) {
      setError(apiErrorMessage(e, 'Failed to send'));
    }
  }

  const restName = restaurants.find((r) => r.id === restId)?.name || '';

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">Fariimaha · Notifications</h1>
        <p className="page-sub">U dir dhammaan ama hal maqaayad · Broadcast to all or a single venue.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card card-pad">
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-4)', marginBottom: 8 }}>Cida loo dirayo · Send to</div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--border-soft)', padding: 4, borderRadius: 10, marginBottom: 20 }}>
            <button
              onClick={() => setTarget('all')}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: target === 'all' ? 'var(--accent)' : 'transparent', color: target === 'all' ? '#fff' : 'var(--muted-1)' }}
            >
              Dhammaan · All
            </button>
            <button
              onClick={() => setTarget('single')}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: target === 'single' ? 'var(--accent)' : 'transparent', color: target === 'single' ? '#fff' : 'var(--muted-1)' }}
            >
              Hal maqaayad · One
            </button>
          </div>

          {target === 'single' && (
            <div style={{ marginBottom: 18 }}>
              <label className="field-label">Dooro maqaayad · Restaurant</label>
              <select className="field-input" value={restId} onChange={(e) => setRestId(e.target.value)}>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label className="field-label">Cinwaan · Title</label>
            <input className="field-input" placeholder="Tusaale: Casriyeyn cusub" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label className="field-label">Qoraalka · Message</label>
            <textarea className="field-input" rows={4} style={{ resize: 'vertical' }} placeholder="Qor fariintaada halkan…" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" onClick={send}>{sent ? 'La diray ✓ · Sent' : 'Dir fariinta · Send notification'}</button>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 12 }}>Live preview · Sida ay u muuqan doonto</div>
          <div style={{ background: 'var(--text)', borderRadius: 20, padding: 22, boxShadow: '0 20px 50px -20px rgba(16,26,43,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: '#fff', borderRadius: 14, padding: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 19, flex: '0 0 auto' }}>M</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>Miis</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>now</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, margin: '4px 0 3px' }}>{title || 'Cinwaanka fariinta · Message title'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted-4)', lineHeight: 1.4 }}>{body || 'Qoraalkaaga halkan ayuu ka muuqan doonaa. Your message preview appears here.'}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--muted-3)', fontWeight: 600 }}>
              → {target === 'all' ? 'Dhammaan · All restaurants' : restName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
