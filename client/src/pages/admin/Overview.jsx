import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Store, ClipboardList, Wallet, Users, BarChart3, Activity as ActivityIcon } from 'lucide-react';
import { api } from '../../lib/api';

const STATUS_META = {
  expired: { label: 'Expired', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  grace: { label: 'Grace', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
  active: { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success)' },
};

// One icon + accent per stat, keyed off the same `tone` the API already sends —
// no new data, just a face for each number.
const STAT_ICON = [Store, ClipboardList, Wallet, Users];

function toneColor(tone) {
  return tone === 'accent' ? 'var(--accent)' : tone;
}

// "3d left", "Overdue 2d", etc. — endsAt can be in the past (expired) or future (grace/active).
function daysLabel(endsAt) {
  if (!endsAt) return '—';
  const ms = new Date(endsAt).getTime() - Date.now();
  const days = Math.ceil(Math.abs(ms) / 86400000);
  return ms < 0 ? `Overdue ${days}d` : `${days}d left`;
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/overview').then((r) => setData(r.data)).catch((e) => setError(e?.response?.data?.error || 'Failed to load'));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Guudmar · Overview</h1>
        <p className="page-sub">Fiiri xaaladda dhammaan maqaayadaha · Everything across your venues.</p>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {!data && !error && <div className="text-muted">Loading…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            {data.stats.map((st, i) => {
              const Icon = STAT_ICON[i] || Store;
              const c = toneColor(st.tone);
              return (
                <div
                  className="stat-card" key={i}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14, transition: 'box-shadow .15s ease, transform .15s ease' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700 }}>{st.en} · {st.so}</div>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `color-mix(in srgb, ${c} 14%, var(--surface))`, color: c,
                    }}>
                      <Icon size={16} strokeWidth={2.25} />
                    </div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', fontVariantNumeric: 'proportional-nums' }}>{st.val}</div>
                  {st.sub && <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{st.sub}</div>}
                </div>
              );
            })}
          </div>

          {data.expiringSoonCount > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--danger-border, var(--border))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}>
                  <AlertTriangle size={16} strokeWidth={2.25} color="var(--danger)" />
                  Subscriptions expiring soon
                  <span className="pill" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: 800 }}>{data.expiringSoonCount}</span>
                </div>
                <button className="btn-outline btn-sm" onClick={() => navigate('/admin/subscriptions')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  View all <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.expiringSoon.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <div
                      key={r.id}
                      onClick={() => navigate('/admin/subscriptions', { state: { restaurantId: r.id } })}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)', cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span className="pill" style={{ background: meta.bg, color: meta.fg, fontWeight: 800, flex: '0 0 auto' }}>{meta.label}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted-3)', flex: '0 0 auto' }}>{r.owner || '—'}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-2)', flex: '0 0 auto' }}>{daysLabel(r.endsAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
            <div className="card card-pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <BarChart3 size={15} strokeWidth={2.25} color="var(--muted-2)" />
                <div style={{ fontWeight: 800, fontSize: 15 }}>Orders by restaurant</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 20 }}>Dalabyada 30-cisho, ugu badan 8 · Top 8, last 30 days</div>
              <OrdersChart rows={data.chartRows} />
            </div>
            <div className="card card-pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <ActivityIcon size={15} strokeWidth={2.25} color="var(--muted-2)" />
                <div style={{ fontWeight: 800, fontSize: 15 }}>Activity</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.activity.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 6px', margin: '0 -6px',
                      borderRadius: 10, transition: 'background .12s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: a.dot, marginTop: 5, flex: '0 0 auto', boxShadow: `0 0 0 3px color-mix(in srgb, ${a.dot} 16%, transparent)` }} />
                    <div style={{ lineHeight: 1.4, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{a.t}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted-3)', marginTop: 1 }}>{a.d}</div>
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

// Single-measure ranking (order count by restaurant) — one sequential hue (accent),
// length is the only encoder. Rounded 4px data-end, capped thickness, a light track
// for context (same treatment as a meter), and a hover lift since each row is already
// direct-labeled with its value.
function OrdersChart({ rows }) {
  const [hovered, setHovered] = useState(null);

  if (!rows.length) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <BarChart3 size={26} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 8 }} />
        <div className="text-muted" style={{ fontSize: 13 }}>No orders yet.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((c, i) => (
        <div
          key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered((v) => (v === i ? null : v))}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px', margin: '0 -6px',
            borderRadius: 8, background: hovered === i ? 'var(--panel-2)' : 'transparent', transition: 'background .12s ease',
          }}
        >
          <div style={{
            width: 122, fontSize: 13, fontWeight: 600, color: 'var(--muted-5)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {c.name}
          </div>
          <div style={{ flex: 1, height: 14, background: 'var(--border-soft)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', width: c.barW, minWidth: c.orders > 0 ? 4 : 0, borderRadius: 4,
                background: hovered === i ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 88%, transparent)',
                transition: 'background .12s ease, width .3s cubic-bezier(.2,.8,.2,1)',
              }}
            />
          </div>
          <div style={{ width: 48, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: 'var(--muted-5)' }} className="mono">
            {c.ordStr}
          </div>
        </div>
      ))}
    </div>
  );
}
