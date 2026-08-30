import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, Users, User } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

const STATUS_META = {
  sent: { label: '✓ La diray · Sent', bg: 'var(--success-bg)', fg: 'var(--success)' },
  failed: { label: '✕ Fashilantay · Failed', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function Sms() {
  const { addToast } = useOutletContext();
  const [status, setStatus] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [mode, setMode] = useState('all');
  const [selected, setSelected] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function loadLogs() {
    api.get('/restaurant/sms/logs').then((r) => setLogs(r.data));
  }

  useEffect(() => {
    setLoading(true);
    api.get('/restaurant/sms/status').then((r) => {
      setStatus(r.data);
      if (r.data.connected) {
        Promise.all([api.get('/restaurant/sms/recipients'), api.get('/restaurant/sms/logs')])
          .then(([rec, lg]) => { setRecipients(rec.data); setLogs(lg.data); });
      }
    }).finally(() => setLoading(false));
  }, []);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  function toggleRecipient(phone) {
    setSelected((s) => ({ ...s, [phone]: !s[phone] }));
  }

  async function send() {
    setError('');
    if (!message.trim()) { setError('Fadlan qor fariinta · Message is required'); return; }
    if (mode === 'selected' && !selectedCount) { setError('Dooro ugu yaraan hal lambar · Select at least one recipient'); return; }
    setBusy(true);
    try {
      const phones = mode === 'selected' ? Object.keys(selected).filter((p) => selected[p]) : undefined;
      const { data } = await api.post('/restaurant/sms/send', { mode, phones, message: message.trim() });
      addToast({
        title: 'SMS-ka waa la diray · SMS sent',
        body: `${data.sent} guuleystay${data.failed ? ` · ${data.failed} fashilantay` : ''} (${data.total} total)`,
        tone: data.failed && !data.sent ? 'error' : 'success',
      });
      setMessage(''); setSelected({}); loadLogs();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to send SMS'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-muted">Loading…</div>;

  if (!status?.connected) {
    return (
      <div>
        <div style={{ marginBottom: 22 }}>
          <h1 className="page-title" style={{ fontSize: 24 }}>SMS</h1>
          <p className="page-sub">U dir fariimo macaamiisha dalabyada leh · Send SMS to your order customers.</p>
        </div>
        <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📵</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>SMS lama xirin · SMS not connected</div>
          <div style={{ color: 'var(--muted-1)', fontSize: 13 }}>
            Fadlan la xiriir maamulaha si loo xiro Hormuud SMS · Please contact the platform admin to connect Hormuud SMS for your restaurant.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' }}>
      <div>
        <div style={{ marginBottom: 22 }}>
          <h1 className="page-title" style={{ fontSize: 24 }}>SMS</h1>
          <p className="page-sub">U dir fariimo macaamiisha dalabyada leh · Send SMS to your order customers.</p>
        </div>

        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Taariikhda · History</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 2.4fr 1.3fr 1fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
            <div>Phone</div><div>Message</div><div>Status</div><div>Time</div>
          </div>
          {logs.map((l) => {
            const s = STATUS_META[l.status];
            return (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 2.4fr 1.3fr 1fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
                <div className="mono">{l.phone}</div>
                <div style={{ color: 'var(--muted-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.message}>{l.message}</div>
                <div>
                  <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 8 }}>{s.label}</span>
                  {l.error && <div style={{ fontSize: 10, color: 'var(--muted-3)', marginTop: 3 }}>{l.error}</div>}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted-3)' }}>{formatDateTime(l.createdAt)}</div>
              </div>
            );
          })}
          {!logs.length && <div className="text-muted" style={{ padding: 30, textAlign: 'center' }}>Weli SMS lama dirin · No SMS sent yet.</div>}
        </div>
      </div>

      <div className="card" style={{ position: 'sticky', top: 18, padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Dir fariin cusub · Send new SMS</div>

        <label className="field-label">Cidda loo diraayo · Recipients</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className={'chip' + (mode === 'all' ? ' active' : '')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setMode('all')}>
            <Users size={13} strokeWidth={2.25} /> Dhammaan · All ({recipients.length})
          </button>
          <button type="button" className={'chip' + (mode === 'selected' ? ' active' : '')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setMode('selected')}>
            <User size={13} strokeWidth={2.25} /> Doorasho · Selected
          </button>
        </div>

        {mode === 'selected' && (
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border-soft)', borderRadius: 10, marginBottom: 14 }}>
            {recipients.map((r) => (
              <label key={r.phone} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--border-soft)', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!selected[r.phone]} onChange={() => toggleRecipient(r.phone)} />
                <span className="mono" style={{ flex: 1 }}>{r.phone}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>#{r.lastOrderNumber} · {r.orders}x</span>
              </label>
            ))}
            {!recipients.length && <div className="text-muted" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>No order phone numbers yet.</div>}
          </div>
        )}

        <label className="field-label">Fariinta · Message</label>
        <textarea
          className="field-input" style={{ marginBottom: 14, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
          value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Qor fariinta halkan…"
        />

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%', padding: 13, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={send} disabled={busy}>
          <Send size={14} strokeWidth={2.25} /> {busy ? 'Diraya…' : 'Dir SMS · Send SMS'}
        </button>
      </div>
    </div>
  );
}
