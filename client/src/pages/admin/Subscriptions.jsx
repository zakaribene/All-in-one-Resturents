import { useEffect, useState } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

const COLORS = [
  { key: 'orange', hex: '#F5A623' },
  { key: 'red', hex: '#E5484D' },
  { key: 'purple', hex: '#8B5CF6' },
  { key: 'blue', hex: '#2563EB' },
  { key: 'green', hex: '#12A150' },
  { key: 'pink', hex: '#EC4899' },
];

const STATUS_META = {
  active: { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success)' },
  grace: { label: 'Grace', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
  expired: { label: 'Expired', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

// "3 daqiiqo", "1 maalin iyo 2 saacadood", etc. — whatever units are actually non-zero.
function formatDurationSo(days, hours, minutes) {
  const d = Math.max(0, Number(days) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const m = Math.max(0, Number(minutes) || 0);
  const parts = [];
  if (d > 0) parts.push(`${d} ${d === 1 ? 'maalin' : 'maalmood'}`);
  if (h > 0) parts.push(`${h} saacadood`);
  if (m > 0) parts.push(`${m} daqiiqo`);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' iyo ' + parts[parts.length - 1];
}

function buildGraceMessage(days, hours, minutes) {
  const duration = formatDurationSo(days, hours, minutes);
  return (
    `Subscription-kaagu wuu dhammaaday. Waxaa lagu siiyey ${duration || 'xilli dheeraad ah'} oo dheeraad ah. ` +
    'Fadlan bixi lacagta Subscription-ka inta muddadan ay socoto si adeeggaagu u sii shaqeeyo.'
  );
}

// Local-time datetime-local <input> value from an ISO date, for pre-filling the renew field.
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "3d left", "Overdue 2d" — endsAt can be in the past (expired) or future (grace/active).
function daysLabel(endsAt) {
  if (!endsAt) return '—';
  const ms = new Date(endsAt).getTime() - Date.now();
  const d = Math.ceil(Math.abs(ms) / 86400000);
  return ms < 0 ? `Overdue ${d}d` : `${d}d left`;
}

export default function Subscriptions() {
  const { addToast } = useOutletContext();
  const location = useLocation();
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [renewDate, setRenewDate] = useState('');
  const [renewBusy, setRenewBusy] = useState(false);

  const [days, setDays] = useState(3);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [message, setMessage] = useState(() => buildGraceMessage(3, 0, 0));
  const [messageTouched, setMessageTouched] = useState(false);
  const [color, setColor] = useState('orange');
  const [graceBusy, setGraceBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  useEffect(() => {
    api.get('/admin/restaurants').then((r) => {
      setRestaurants(r.data);
      // Arriving from the Overview "expiring soon" widget pre-selects that store;
      // otherwise default to the first one in the list, as before.
      const fromNav = location.state?.restaurantId;
      const initial = (fromNav && r.data.some((x) => x.id === fromNav)) ? fromNav : r.data[0]?.id;
      if (initial) setRestaurantId(initial);
    }).catch((e) => setError(apiErrorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    if (!restaurantId) return;
    setLoading(true); setError('');
    api.get(`/admin/restaurants/${restaurantId}/subscription`)
      .then((r) => {
        setSub(r.data);
        setRenewDate(toLocalInputValue(r.data.subscriptionEndsAt));
        setColor(r.data.graceColor || 'orange');
        if (r.data.graceMessage) {
          // An existing grace message belongs to a different (already-granted) duration —
          // don't let the Days/Hours/Minutes inputs below silently rewrite it.
          setMessage(r.data.graceMessage);
          setMessageTouched(true);
        } else {
          setMessage(buildGraceMessage(days, hours, minutes));
          setMessageTouched(false);
        }
      })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, [restaurantId]);

  // Live-sync the banner message to whatever duration is currently entered — until the
  // admin edits the text themselves, at which point their wording takes over.
  useEffect(() => {
    if (!messageTouched) setMessage(buildGraceMessage(days, hours, minutes));
  }, [days, hours, minutes, messageTouched]);

  async function renew() {
    if (!renewDate) return;
    setRenewBusy(true);
    try {
      await api.patch(`/admin/restaurants/${restaurantId}/subscription/renew`, { newEndsAt: new Date(renewDate).toISOString() });
      addToast({ title: 'Subscription-ka waa la cusbooneysiiyay · Subscription renewed', tone: 'success' });
      load();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to renew', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setRenewBusy(false);
    }
  }

  async function grantGrace() {
    setGraceBusy(true);
    try {
      await api.patch(`/admin/restaurants/${restaurantId}/subscription/grace`, { days, hours, minutes, message, color });
      addToast({ title: 'Xilli dheeraad ah waa la siiyay · Grace period granted', tone: 'success' });
      load();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setGraceBusy(false);
    }
  }

  async function clearGrace() {
    setClearBusy(true);
    try {
      await api.patch(`/admin/restaurants/${restaurantId}/subscription/clear-grace`);
      addToast({ title: 'Banner-ka waa la tirtiray · Grace banner cleared', tone: 'success' });
      load();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setClearBusy(false);
    }
  }

  const meta = sub ? STATUS_META[sub.status] : null;
  const restaurant = restaurants.find((r) => r.id === restaurantId);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">Rukumaadka · Subscriptions</h1>
        <p className="page-sub">Maamul xilliga rukumaadka maqaayad kasta · Renew subscriptions and grant grace periods.</p>
      </div>

      <ExpiringSoonList onPick={setRestaurantId} selectedId={restaurantId} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Dooro maqaayad · Find a store</div>
          <select className="field-input" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {restaurant && (
          <div className="card card-pad">
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{restaurant.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{restaurant.owner || '—'}{restaurant.owner ? ' · ' : ''}@{restaurant.username}</div>
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            {loading && <div className="text-muted">Loading…</div>}

            {sub && !loading && (
              <>
                <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--panel)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--muted-1)' }}>Current status:</span>
                    <span className="pill" style={{ background: meta.bg, color: meta.fg, fontWeight: 800 }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted-4)', lineHeight: 1.7 }}>
                    {sub.graceEndsAt && (
                      sub.status === 'active' ? (
                        <div>
                          Grace period scheduled — starts when subscription ends, runs until <b>{new Date(sub.graceEndsAt).toLocaleString()}</b>
                        </div>
                      ) : (
                        <div>Grace period ends <b>{new Date(sub.graceEndsAt).toLocaleString()}</b></div>
                      )
                    )}
                    <div>
                      Subscription ends {sub.subscriptionEndsAt ? <b>{new Date(sub.subscriptionEndsAt).toLocaleString()}</b> : <span style={{ color: 'var(--muted-3)' }}>never set (unrestricted)</span>}
                    </div>
                  </div>
                  {sub.graceEndsAt && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>Already paid? Clear the grace banner without setting a new end date.</span>
                      <button className="btn-outline btn-sm" disabled={clearBusy} onClick={clearGrace}>{clearBusy ? 'Clearing…' : 'Clear grace period'}</button>
                    </div>
                  )}
                </div>

                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Renew subscription (payment received)</div>
                <label className="field-label">New subscription end date *</label>
                <input
                  className="field-input" type="datetime-local" style={{ marginBottom: 14, maxWidth: 320 }}
                  value={renewDate} onChange={(e) => setRenewDate(e.target.value)}
                />
                <div style={{ marginBottom: 24 }}>
                  <button className="btn btn-primary" disabled={renewBusy || !renewDate} onClick={renew}>
                    {renewBusy ? 'Saving…' : 'Renew subscription'}
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Grant grace period / reactivate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 14, maxWidth: 420 }}>
                    <div>
                      <label className="field-label">Days</label>
                      <input className="field-input" type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Hours</label>
                      <input className="field-input" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Minutes</label>
                      <input className="field-input" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                    </div>
                  </div>

                  <label className="field-label">Banner message *</label>
                  <textarea
                    className="field-input" style={{ minHeight: 70, resize: 'vertical', fontFamily: 'inherit', marginBottom: 4, maxWidth: 520 }}
                    value={message} onChange={(e) => { setMessage(e.target.value); setMessageTouched(true); }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 16 }}>
                    Waxay si live ah isu beddeshaa marka Days/Hours/Minutes la beddelo, ilaa aad qoraalka tuqaan · Live-updates with the duration above until you edit it yourself.
                  </div>

                  <label className="field-label">Banner color</label>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                    {COLORS.map((c) => (
                      <button
                        key={c.key} onClick={() => setColor(c.key)} title={c.key}
                        style={{
                          width: 30, height: 30, borderRadius: 99, background: c.hex, cursor: 'pointer',
                          border: color === c.key ? '3px solid var(--text)' : '3px solid transparent',
                          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-3)', marginBottom: 18 }}>Shown to the store owner while the countdown is running.</div>

                  <button className="btn btn-primary" disabled={graceBusy} onClick={grantGrace}>
                    {graceBusy ? 'Saving…' : 'Grant grace period'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const WINDOW_OPTIONS = [7, 14, 30];

// Full "expiring soon" list — already-expired, grace running out, or still-active but
// ending within the chosen window. Clicking a row jumps straight into that store below
// (same as arriving here from the Overview widget via location.state.restaurantId).
function ExpiringSoonList({ onPick, selectedId }) {
  const [windowDays, setWindowDays] = useState(7);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    api.get('/admin/subscriptions/expiring', { params: { days: windowDays } })
      .then((r) => setRows(r.data.rows))
      .catch((e) => setError(apiErrorMessage(e)));
  }, [windowDays]);

  if (!rows) return error ? <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div> : null;
  if (!rows.length) return null;

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: open ? 14 : 0 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}
        >
          <AlertTriangle size={16} strokeWidth={2.25} color="var(--danger)" />
          Subscriptions expiring soon
          <span className="pill" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: 800 }}>{rows.length}</span>
        </button>
        {open && (
          <div style={{ display: 'flex', gap: 6 }}>
            {WINDOW_OPTIONS.map((d) => (
              <button
                key={d} onClick={() => setWindowDays(d)}
                className={windowDays === d ? 'btn btn-primary btn-sm' : 'btn-outline btn-sm'}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              onClick={() => onPick(r.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${r.id === selectedId ? 'var(--accent)' : 'var(--border-soft)'}`,
                background: r.id === selectedId ? 'var(--panel)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span className="pill" style={{ background: STATUS_META[r.status].bg, color: STATUS_META[r.status].fg, fontWeight: 800, flex: '0 0 auto' }}>
                  {STATUS_META[r.status].label}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted-3)', flex: '0 0 auto' }}>{r.owner || '—'}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-2)', flex: '0 0 auto' }}>{daysLabel(r.endsAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
