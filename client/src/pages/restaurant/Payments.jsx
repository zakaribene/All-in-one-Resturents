import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const STATUS_META = {
  paid: { label: '✓ Guulaystay · Paid', bg: 'var(--success-bg)', fg: 'var(--success)' },
  declined: { label: '✕ Diiday · Declined', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  timeout: { label: '⚠ Lama xaqiijin · Timeout', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
  failed: { label: '⚠ Khalad adeeg · Failed', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
  pending: { label: '… Sugaya · Pending', bg: 'var(--panel-2)', fg: 'var(--muted-3)' },
  none: { label: '—', bg: 'var(--panel-2)', fg: 'var(--muted-3)' },
};

const TABS = [
  { id: 'all', so: 'Dhammaan', en: 'All' },
  { id: 'paid', so: 'Guulaystay', en: 'Paid' },
  { id: 'notpaid', so: 'Fashilmay', en: 'Failed' },
];

function description(p) {
  if (p.status === 'paid') return 'Lacagta si guul leh ayaa loo bixiyay · Payment completed successfully.';
  if (p.status === 'declined') return p.failureReason || 'Macmiilku wuu diiday ama wuu joojiyay bixinta · Customer declined or cancelled the prompt.';
  if (p.status === 'timeout') return 'Lama xaqiijin — macmiilku ma jawaabin xilliga la qabo · Not confirmed in time — customer may not have responded.';
  if (p.status === 'failed') return 'Khalad adeeg ayaa dhacay marka la gaarayay bixiyaha · A service/connection error occurred reaching the payment provider.';
  return 'Sugaya xaqiijinta · Awaiting confirmation.';
}

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return new Date(date).toLocaleDateString();
}

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/restaurant/payments').then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all: rows.length,
    paid: rows.filter((r) => r.payment.status === 'paid').length,
    notpaid: rows.filter((r) => r.payment.status !== 'paid').length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === 'paid' && r.payment.status !== 'paid') return false;
      if (tab === 'notpaid' && r.payment.status === 'paid') return false;
      if (!q) return true;
      return String(r.number).includes(q) || (r.phone || '').toLowerCase().includes(q);
    });
  }, [rows, tab, query]);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Lacag-bixinada · Payments</h1>
        <p className="page-sub">Dalabyada lagu bixiyay mobile-money · Orders paid through mobile-money.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.id} className={'chip' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
              {t.so} · {t.en} {counts[t.id]}
            </button>
          ))}
        </div>
        <input
          className="field-input" style={{ maxWidth: 260 }}
          placeholder="🔍 Raadi order, taleefan…"
          value={query} onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr .8fr 1.5fr 2.2fr .9fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
          <div>Order</div><div>Phone</div><div>Amount</div><div>Status</div><div>Description</div><div style={{ textAlign: 'right' }}>Action</div>
        </div>
        {loading && <div className="text-muted" style={{ padding: 24 }}>Loading…</div>}
        {!loading && filtered.map((r) => {
          const p = r.payment;
          const s = STATUS_META[p.status] || STATUS_META.none;
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr .8fr 1.5fr 2.2fr .9fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
              <div>
                <div className="mono" style={{ fontWeight: 800 }}>#{r.number}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{timeAgo(r.createdAt)}</div>
              </div>
              <div className="mono">{r.phone}</div>
              <div style={{ fontWeight: 800 }}>${r.total.toFixed(2)}</div>
              <div>
                <span style={{ background: s.bg, color: s.fg, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>{s.label}</span>
                {p.provider && <div style={{ fontSize: 11, color: 'var(--muted-3)', marginTop: 4, textTransform: 'uppercase' }}>{p.provider}</div>}
              </div>
              <div style={{ color: 'var(--muted-5)', lineHeight: 1.4 }}>{description(p)}</div>
              <div style={{ textAlign: 'right' }}>
                {p.status !== 'paid' && (
                  <a href={`tel:${r.phone}`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'inline-block' }}>
                    📞 Wac · Call
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {!loading && !filtered.length && <div className="text-muted" style={{ padding: 30, textAlign: 'center' }}>Wax lacag-bixin ah lama helin · No payments found.</div>}
      </div>
    </div>
  );
}
