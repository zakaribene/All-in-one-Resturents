import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { History, FileSpreadsheet, FileText } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

function fmtDateTime(v) {
  if (!v) return '';
  return new Date(v).toLocaleString();
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

const ACTION_TONE = {
  Create: 'var(--success)', Update: 'var(--accent)', Delete: 'var(--danger)', Login: '#8B5CF6',
};

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="field-label" style={{ margin: 0 }}>{label}</label>
      {children}
    </div>
  );
}

export default function ActivityLog() {
  const { addToast } = useOutletContext();
  const today = useMemo(() => new Date(), []);
  const [module, setModule] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(toInputDate(today));
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const params = useCallback(() => {
    const p = {};
    if (module !== 'all') p.module = module;
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [module, from, to]);

  const fetchLog = useCallback(() => {
    setBusy(true); setError('');
    api.get('/restaurant/activity-log', { params: params() })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => { setBusy(false); setLoaded(true); });
  }, [params]);

  useEffect(() => {
    const t = setTimeout(fetchLog, 300);
    return () => clearTimeout(t);
  }, [fetchLog]);

  async function runExport(fmt) {
    setExporting(fmt);
    try {
      await downloadBlob(`/restaurant/activity-log.${fmt}`, params(), `activity-log.${fmt}`);
      addToast({ title: 'Waa la soo dejiyay · Downloaded', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Soo dejinta way fashilantay · Export failed', body: await blobError(err), tone: 'error' });
    } finally {
      setExporting('');
    }
  }

  const rowCount = data?.rows?.length || 0;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Diiwaanka Dhaqdhaqaaqa · Activity Log</h1>
        <p className="page-sub">
          Abuur, wax-ka-badal, tirtir iyo login — dhammaan waxa maqaayadan ku dhacay ·
          Every create, edit, delete and login recorded for this store.
        </p>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Module">
            <select className="field-input" value={module} onChange={(e) => setModule(e.target.value)} style={{ minWidth: 150 }}>
              <option value="all">Dhammaan · All</option>
              {(data?.moduleOptions || []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Laga bilaabo · From">
            <input type="date" className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minWidth: 150 }} />
          </Field>
          <Field label="Ilaa · To">
            <input type="date" className="field-input" value={to} onChange={(e) => setTo(e.target.value)} style={{ minWidth: 150 }} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
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
          <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>
            {rowCount} saf · rows{data?.truncated ? ' (500 ugu horreeya · latest 500)' : ''}
          </div>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {!loaded && <div className="text-muted">Loading…</div>}

      {loaded && !rowCount && (
        <div className="card" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <History size={30} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Wax dhaqdhaqaaq ah lama helin · No activity for these filters</div>
        </div>
      )}

      {loaded && !!rowCount && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', opacity: busy ? 0.55 : 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead>
                <tr style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
                  {['Taariikh · Date', 'Qofka · User', 'Module', 'Ficil · Action', 'Faahfaahin · Description'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '.03em', color: 'var(--muted-3)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: 'var(--muted-3)' }}>{fmtDateTime(row.date)}</td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>{row.user}</td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      <span className="pill" style={{ background: 'var(--panel)', fontSize: 11, fontWeight: 700 }}>{row.module}</span>
                    </td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontWeight: 800, color: ACTION_TONE[row.action] || 'var(--text)' }}>{row.action}</td>
                    <td style={{ padding: '10px 16px' }}>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
