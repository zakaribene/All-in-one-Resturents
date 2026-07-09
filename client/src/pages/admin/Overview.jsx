import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/overview').then((r) => setData(r.data)).catch((e) => setError(e?.response?.data?.error || 'Failed to load'));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">Guudmar · Overview</h1>
        <p className="page-sub">Fiiri xaaladda dhammaan maqaayadaha · Everything across your venues.</p>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {!data && !error && <div className="text-muted">Loading…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
            {data.stats.map((st, i) => (
              <div className="stat-card" key={i}>
                <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, marginBottom: 10 }}>{st.en} · {st.so}</div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em' }}>{st.val}</div>
                {st.sub && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: st.tone === 'accent' ? 'var(--accent)' : st.tone }}>{st.sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Orders by restaurant</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 18 }}>Dalabyada 30-cisho · last 30 days</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.chartRows.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 120, fontSize: 13, fontWeight: 600, color: 'var(--muted-5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ flex: 1, height: 10, background: 'var(--border-soft)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: c.barW, background: c.fg, borderRadius: 99 }} />
                    </div>
                    <div style={{ width: 52, textAlign: 'right', fontSize: 12, fontWeight: 700 }} className="mono">{c.ordStr}</div>
                  </div>
                ))}
                {data.chartRows.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No orders yet.</div>}
              </div>
            </div>
            <div className="card card-pad">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>Activity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {data.activity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 9, height: 9, borderRadius: 99, background: a.dot, marginTop: 5, flex: '0 0 auto' }} />
                    <div style={{ lineHeight: 1.35 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{a.t}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{a.d}</div>
                    </div>
                  </div>
                ))}
                {data.activity.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No activity yet.</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
