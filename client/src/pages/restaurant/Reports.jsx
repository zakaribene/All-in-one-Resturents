import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BarChart3, Receipt, FileSpreadsheet, FileText, RotateCcw, Search } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

const money = (n) => '$' + Number(n || 0).toFixed(2);

function fmtCell(v, format) {
  if (v == null || v === '') return format === 'money' ? money(0) : '';
  if (format === 'money') return money(v);
  if (format === 'date') return new Date(v).toISOString().slice(0, 10);
  if (format === 'datetime') return new Date(v).toISOString().slice(0, 16).replace('T', ' ');
  return String(v);
}

function toInputDate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function downloadBlob(path, params, fallbackName) {
  const res = await api.get(path, { params, responseType: 'blob' });
  let name = fallbackName;
  const cd = res.headers['content-disposition'] || res.headers['Content-Disposition'] || '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  if (m) name = m[1];
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function blobError(err) {
  try {
    const text = await err.response.data.text();
    return JSON.parse(text).error || 'Export failed';
  } catch {
    return apiErrorMessage(err, 'Export failed');
  }
}

const TABS = [
  { id: 'sales', en: 'Sales Report', so: 'Warbixinta Iibka', Icon: BarChart3 },
  { id: 'expenses', en: 'Expense Report', so: 'Warbixinta Kharashka', Icon: Receipt },
];

export default function Reports() {
  const [tab, setTab] = useState('sales');

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Warbixinno · Reports</h1>
        <p className="page-sub">
          Filter taariikh iyo kuwo kale, kadibna ku soo dejiso Excel ama PDF oo xirfad leh — logada iyo magaca maqaayadaada ku qoran ·
          Filter by date and more, then export a professional Excel or PDF with your restaurant's logo and name.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={on ? 'btn btn-primary' : 'btn-outline'}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <t.Icon size={15} strokeWidth={2.25} />
              <span>{t.en} · {t.so}</span>
            </button>
          );
        })}
      </div>

      <ReportView key={tab} kind={tab} />
    </div>
  );
}

function ReportView({ kind }) {
  const { addToast } = useOutletContext();
  const isSales = kind === 'sales';

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const [from, setFrom] = useState(toInputDate(monthStart));
  const [to, setTo] = useState(toInputDate(today));
  const [orderId, setOrderId] = useState('');
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [category, setCategory] = useState('all');

  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const params = useCallback(() => {
    const p = {};
    if (from) p.from = from;
    if (to) p.to = to;
    if (isSales) {
      if (orderId.trim()) p.orderId = orderId.trim();
      if (channel !== 'all') p.channel = channel;
      if (status !== 'all') p.status = status;
      if (method !== 'all') p.method = method;
    } else {
      if (category !== 'all') p.category = category;
      if (method !== 'all') p.method = method;
    }
    return p;
  }, [from, to, orderId, channel, status, method, category, isSales]);

  const fetchReport = useCallback(() => {
    setBusy(true);
    setError('');
    api.get(`/restaurant/reports/${kind}`, { params: params() })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => { setBusy(false); setLoaded(true); });
  }, [kind, params]);

  // Auto-run the report as filters change — no need to press a button.
  // Debounced so typing an Order ID doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchReport, 350);
    return () => clearTimeout(t);
  }, [fetchReport]);

  async function runExport(fmt) {
    setExporting(fmt);
    try {
      await downloadBlob(`/restaurant/reports/${kind}.${fmt}`, params(), `${kind}-report.${fmt}`);
      addToast({ title: 'Waa la soo dejiyay · Downloaded', body: `${kind}-report.${fmt}`, tone: 'success' });
    } catch (err) {
      addToast({ title: 'Soo dejinta way fashilantay · Export failed', body: await blobError(err), tone: 'error' });
    } finally {
      setExporting('');
    }
  }

  function reset() {
    setFrom(toInputDate(monthStart));
    setTo(toInputDate(today));
    setOrderId(''); setChannel('all'); setStatus('all'); setMethod('all'); setCategory('all');
  }

  // Filter dropdown options derived from the rows currently loaded.
  const methodOptions = useMemo(() => {
    if (!data?.rows) return [];
    const key = isSales ? 'payMethod' : 'methodName';
    const set = new Set();
    for (const r of data.rows) {
      const v = r[key];
      if (!v || v === '—') continue;
      if (isSales && String(v).startsWith('Online')) { set.add('online'); continue; }
      set.add(v);
    }
    return [...set].sort();
  }, [data, isSales]);

  const categoryOptions = useMemo(() => {
    if (isSales || !data?.rows) return [];
    return [...new Set(data.rows.map((r) => r.categoryName).filter(Boolean))].sort();
  }, [data, isSales]);

  const rowCount = data?.rows?.length || 0;

  return (
    <div>
      {/* ---- Filters ---- */}
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Laga bilaabo · From">
            <input type="date" className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minWidth: 150 }} />
          </Field>
          <Field label="Ilaa · To">
            <input type="date" className="field-input" value={to} onChange={(e) => setTo(e.target.value)} style={{ minWidth: 150 }} />
          </Field>

          {isSales && (
            <>
              <Field label="Order ID · Lambar dalab">
                <input className="field-input" inputMode="numeric" placeholder="e.g. 1024" value={orderId}
                  onChange={(e) => setOrderId(e.target.value.replace(/\D/g, ''))} style={{ minWidth: 130 }} />
              </Field>
              <Field label="Kanaal · Channel">
                <select className="field-input" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ minWidth: 140 }}>
                  <option value="all">Dhammaan · All</option>
                  <option value="table">Table · Miis</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="online">Online</option>
                  <option value="pos">POS</option>
                </select>
              </Field>
              <Field label="Xaalad · Status">
                <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: 130 }}>
                  <option value="all">Dhammaan · All</option>
                  <option value="new">new</option>
                  <option value="preparing">preparing</option>
                  <option value="done">done</option>
                </select>
              </Field>
            </>
          )}

          {!isSales && (
            <Field label="Qayb · Category">
              <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ minWidth: 160 }}>
                <option value="all">Dhammaan · All</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          )}

          <Field label={isSales ? 'Lacag-bixin · Payment' : 'Hab · Method'}>
            <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value)} style={{ minWidth: 150 }}>
              <option value="all">Dhammaan · All</option>
              {isSales && <option value="online">Online</option>}
              {methodOptions.filter((m) => m !== 'online').map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--muted-3)', alignSelf: 'center' }}>
            <Search size={14} strokeWidth={2.5} />
           
          </div>
          
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn-outline" onClick={() => runExport('xlsx')} disabled={!!exporting || busy || !rowCount}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <FileSpreadsheet size={15} strokeWidth={2.25} color="var(--success)" />
            {exporting === 'xlsx' ? 'Diyaarinaya…' : 'Excel (.xlsx)'}
          </button>
          <button className="btn-outline" onClick={() => runExport('pdf')} disabled={!!exporting || busy || !rowCount}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <FileText size={15} strokeWidth={2.25} color="var(--danger)" />
            {exporting === 'pdf' ? 'Diyaarinaya…' : 'PDF (.pdf)'}
          </button>
          <div style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted-3)' }}>
            {rowCount} saf · rows
          </div>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      {/* ---- Summary ---- */}
      {data?.summary?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: 14, marginBottom: 18 }}>
          {data.summary.map((s, i) => (
            <div className="stat-card" key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Table ---- */}
      {!loaded && <div className="text-muted">Loading…</div>}

      {loaded && data && !rowCount && (
        <div className="card" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <BarChart3 size={30} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Wax xog ah lama helin · No data for these filters</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4 }}>Beddel taariikhda ama filtarrada · Try a different date range or filters.</div>
        </div>
      )}

      {loaded && data && !!rowCount && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', opacity: busy ? 0.55 : 1, transition: 'opacity .15s' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isSales ? 1000 : 720 }}>
              <thead>
                <tr style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
                  {data.columns.map((c) => (
                    <th key={c.key} style={{
                      textAlign: c.align === 'right' ? 'right' : 'left', padding: '12px 16px',
                      fontSize: 11, fontWeight: 800, letterSpacing: '.03em', color: 'var(--muted-3)',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>
                      {c.header}{c.headerSo ? <div style={{ fontWeight: 600, textTransform: 'none', color: 'var(--muted-4)' }}>{c.headerSo}</div> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    {data.columns.map((c) => (
                      <td key={c.key} style={{
                        padding: '10px 16px', textAlign: c.align === 'right' ? 'right' : 'left',
                        whiteSpace: c.key === 'note' ? 'normal' : 'nowrap',
                        fontWeight: c.key === 'total' || c.key === 'amount' ? 700 : 400,
                        color: c.key === 'amount' ? 'var(--danger)' : 'var(--text)',
                      }}>
                        {fmtCell(row[c.key], c.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {data.totalsRow && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--panel)' }}>
                    {data.columns.map((c, i) => {
                      const has = data.totalsRow.values && c.key in data.totalsRow.values;
                      return (
                        <td key={c.key} style={{
                          padding: '11px 16px', textAlign: c.align === 'right' ? 'right' : 'left',
                          fontWeight: 800, whiteSpace: 'nowrap',
                        }}>
                          {i === 0 ? (data.totalsRow.label || 'TOTAL') : has ? fmtCell(data.totalsRow.values[c.key], c.format) : ''}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="field-label" style={{ margin: 0 }}>{label}</label>
      {children}
    </div>
  );
}
