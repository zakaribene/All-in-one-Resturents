import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

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

const PAGE_SIZE = 10;

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

function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function paymentTime(row) {
  return row.payment.status === 'paid' ? (row.payment.paidAt || row.updatedAt) : (row.updatedAt || row.createdAt);
}

export default function Payments() {
  const { addToast, confirm } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/restaurant/payments').then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, []);

  async function removeRow(id) {
    const ok = await confirm({ title: 'Tirtir diiwaankan · Delete this record?', tone: 'danger', confirmLabel: 'Tirtir · Delete' });
    if (!ok) return;
    try {
      await api.delete(`/restaurant/orders/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      addToast({ title: 'Waa la tirtiray · Deleted', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to delete', body: apiErrorMessage(err), tone: 'error' });
    }
  }

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = (pageSafe - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function onTab(id) { setTab(id); setPage(1); }
  function onQuery(v) { setQuery(v); setPage(1); }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Lacag-bixinada · Payments</h1>
        <p className="page-sub">Dalabyada lagu bixiyay mobile-money · Orders paid through mobile-money.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.id} className={'chip' + (tab === t.id ? ' active' : '')} onClick={() => onTab(t.id)}>
              {t.so} · {t.en} {counts[t.id]}
            </button>
          ))}
        </div>
        <input
          className="field-input" style={{ maxWidth: 260 }}
          placeholder="🔍 Raadi order, taleefan…"
          value={query} onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr .8fr 1.5fr 2.2fr .9fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
          <div>Order</div><div>Phone</div><div>Amount</div><div>Status</div><div>Description</div><div style={{ textAlign: 'right' }}>Action</div>
        </div>
        {loading && <div className="text-muted" style={{ padding: 24 }}>Loading…</div>}
        {!loading && pageRows.map((r) => {
          const p = r.payment;
          const s = STATUS_META[p.status] || STATUS_META.none;
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr .8fr 1.5fr 2.2fr .9fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
              <div>
                <div className="mono" style={{ fontWeight: 800 }}>#{r.number}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{timeAgo(r.createdAt)}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted-3)', opacity: .75 }}>{formatDateTime(r.createdAt)}</div>
              </div>
              <div className="mono">{r.phone}</div>
              <div style={{ fontWeight: 800 }}>${r.total.toFixed(2)}</div>
              <div>
                <span style={{ background: s.bg, color: s.fg, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>{s.label}</span>
                {p.provider && <div style={{ fontSize: 11, color: 'var(--muted-3)', marginTop: 4, textTransform: 'uppercase' }}>{p.provider}</div>}
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted-3)', opacity: .75, marginTop: 3 }}>{formatDateTime(paymentTime(r))}</div>
              </div>
              <div style={{ color: 'var(--muted-5)', lineHeight: 1.4 }}>{description(p)}</div>
              <div style={{ textAlign: 'right' }}>
                <button
                  type="button" className="btn-danger-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => removeRow(r.id)}
                >
                  <Trash2 size={13} strokeWidth={2.25} /> Tirtir · Delete
                </button>
              </div>
            </div>
          );
        })}
        {!loading && !pageRows.length && <div className="text-muted" style={{ padding: 30, textAlign: 'center' }}>Wax lacag-bixin ah lama helin · No payments found.</div>}
      </div>

      {!loading && !!filtered.length && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 13, color: 'var(--muted-2)' }}>
          <span>{`${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length}`}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline btn-sm" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>{pageSafe}</span>
            <button className="btn-outline btn-sm" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}
