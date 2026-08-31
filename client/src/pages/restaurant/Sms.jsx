import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, Users, User, Plus, X, Download, Upload, FileSpreadsheet, CheckCircle2, PhoneCall, Search, Trash2, RotateCcw } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

const STATUS_META = {
  sent: { label: '✓ La diray · Sent', bg: 'var(--success-bg)', fg: 'var(--success)' },
  failed: { label: '✕ Fashilantay · Failed', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 10;

function parseCsvPhones(text) {
  const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean);
  const phones = [];
  lines.forEach((line, idx) => {
    const first = line.split(',')[0].replace(/^"|"$/g, '').trim();
    if (!first) return;
    if (idx === 0 && /phone|lambar|number/i.test(first)) return;
    const cleaned = first.replace(/[^\d+]/g, '');
    if (cleaned.replace(/\D/g, '').length >= 6) phones.push(cleaned);
  });
  return [...new Set(phones)];
}

export default function Sms() {
  const { addToast, confirm } = useOutletContext();
  const [status, setStatus] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [mode, setMode] = useState('all');
  const [selected, setSelected] = useState({});
  const [customPhones, setCustomPhones] = useState([]);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const fileInputRef = useRef(null);

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

  const historyTotalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const historyPageSafe = Math.min(historyPage, historyTotalPages);
  const historyPageStart = (historyPageSafe - 1) * PAGE_SIZE;
  const historyPageRows = logs.slice(historyPageStart, historyPageStart + PAGE_SIZE);

  const knownPhones = useMemo(() => new Set(recipients.map((r) => r.phone)), [recipients]);
  const allRecipients = useMemo(() => {
    const extra = customPhones.filter((p) => !knownPhones.has(p)).map((p) => ({ phone: p, manual: true }));
    return [...recipients, ...extra];
  }, [recipients, customPhones, knownPhones]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const selectedPhones = useMemo(() => Object.keys(selected).filter((p) => selected[p]), [selected]);

  const trimmedQuery = phoneQuery.trim();
  const filteredRecipients = useMemo(() => {
    if (!trimmedQuery) return allRecipients;
    return allRecipients.filter((r) => r.phone.includes(trimmedQuery));
  }, [allRecipients, trimmedQuery]);
  const canAddQuery = trimmedQuery.length > 0 && trimmedQuery.replace(/\D/g, '').length >= 6 && !filteredRecipients.length;

  function toggleRecipient(phone) {
    setSelected((s) => ({ ...s, [phone]: !s[phone] }));
  }

  function addManualPhone() {
    const p = trimmedQuery;
    if (!p || p.replace(/\D/g, '').length < 6) { setError('Fadlan geli lambar sax ah · Enter a valid phone number'); return; }
    setError('');
    if (!knownPhones.has(p)) setCustomPhones((cur) => (cur.includes(p) ? cur : [...cur, p]));
    setSelected((s) => ({ ...s, [p]: true }));
    setPhoneQuery('');
  }

  function removeManualPhone(phone) {
    setCustomPhones((cur) => cur.filter((p) => p !== phone));
    setSelected((s) => { const n = { ...s }; delete n[phone]; return n; });
  }

  function exportTemplate() {
    const source = mode === 'selected' && selectedPhones.length ? selectedPhones : allRecipients.map((r) => r.phone);
    const rows = [['phone'], ...(source.length ? source.map((p) => [p]) : [['']])];
    downloadCsv('sms-lambarada.csv', rows);
  }

  function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const phones = parseCsvPhones(String(ev.target.result || ''));
      if (!phones.length) { setError('Faylka ma laha lambaro sax ah · No valid phone numbers found in the file'); return; }
      setError('');
      setImportPreview(phones);
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!importPreview) return;
    setCustomPhones((cur) => [...new Set([...cur, ...importPreview.filter((p) => !knownPhones.has(p))])]);
    setSelected((s) => {
      const next = { ...s };
      importPreview.forEach((p) => { next[p] = true; });
      return next;
    });
    setMode('selected');
    addToast?.({ title: `${importPreview.length} lambar waa lagu daray · numbers added`, tone: 'success' });
    setImportPreview(null);
  }

  function resend(log) {
    setMessage(log.message);
    setMode('selected');
    if (!knownPhones.has(log.phone)) setCustomPhones((cur) => (cur.includes(log.phone) ? cur : [...cur, log.phone]));
    setSelected((s) => ({ ...s, [log.phone]: true }));
    setError('');
    addToast?.({ title: 'Fariintii waa la soo celiyay · Message loaded — review recipients and send', tone: 'info' });
  }

  async function deleteLog(id) {
    const ok = await confirm({ title: 'Tirtir diiwaankan SMS-ka · Delete this SMS record?', tone: 'danger', confirmLabel: 'Tirtir · Delete' });
    if (!ok) return;
    try {
      await api.delete(`/restaurant/sms/logs/${id}`);
      setLogs((cur) => cur.filter((l) => l.id !== id));
    } catch (err) {
      addToast?.({ title: 'Way fashilantay · Failed to delete', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  async function send() {
    setError('');
    if (!message.trim()) { setError('Fadlan qor fariinta · Message is required'); return; }
    if (mode === 'selected' && !selectedCount) { setError('Dooro ugu yaraan hal lambar · Select at least one recipient'); return; }
    setBusy(true);
    try {
      const phones = mode === 'selected' ? selectedPhones : undefined;
      const { data } = await api.post('/restaurant/sms/send', { mode, phones, message: message.trim() });
      const allFailed = data.failed > 0 && data.sent === 0;
      const someFailed = data.failed > 0 && data.sent > 0;
      const firstError = data.results?.find((r) => !r.ok)?.error;
      const title = allFailed
        ? 'SMS-ka lama dirin · SMS failed to send'
        : someFailed
          ? 'SMS-ka qeyb ahaan ayaa la diray · Partially sent'
          : 'SMS-ka waa la diray · SMS sent';
      const counts = `${data.sent} guuleystay${data.failed ? ` · ${data.failed} fashilantay` : ''} (${data.total} total)`;
      addToast({
        title,
        body: firstError ? `${counts} — ${firstError}` : counts,
        tone: data.failed ? 'error' : 'success',
      });
      setMessage(''); setSelected({}); setHistoryPage(1); loadLogs();
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

  const previewSample = selectedPhones.slice(0, 3);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, alignItems: 'start' }}>
      <div>
        <div style={{ marginBottom: 22 }}>
          <h1 className="page-title" style={{ fontSize: 24 }}>SMS</h1>
          <p className="page-sub">U dir fariimo macaamiisha dalabyada leh · Send SMS to your order customers.</p>
        </div>

        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Taariikhda · History</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.1fr 1.2fr 0.9fr 0.9fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
            <div>Phone</div><div>Message</div><div>Status</div><div>Time</div><div style={{ textAlign: 'right' }}>Action</div>
          </div>
          {historyPageRows.map((l) => {
            const s = STATUS_META[l.status];
            return (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.1fr 1.2fr 0.9fr 0.9fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
                <div className="mono">{l.phone}</div>
                <div style={{ color: 'var(--muted-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.message}>{l.message}</div>
                <div>
                  <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 8 }}>{s.label}</span>
                  {l.error && <div style={{ fontSize: 10, color: 'var(--muted-3)', marginTop: 3 }}>{l.error}</div>}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted-3)' }}>{formatDateTime(l.createdAt)}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="button" title="Dib u dir · Resend" onClick={() => resend(l)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer' }}>
                    <RotateCcw size={13} strokeWidth={2.25} />
                  </button>
                  <button type="button" title="Tirtir · Delete" onClick={() => deleteLog(l.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--danger)', cursor: 'pointer' }}>
                    <Trash2 size={13} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            );
          })}
          {!logs.length && <div className="text-muted" style={{ padding: 30, textAlign: 'center' }}>Weli SMS lama dirin · No SMS sent yet.</div>}
        </div>

        {!!logs.length && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, fontSize: 13, color: 'var(--muted-2)' }}>
            <span>{`${historyPageStart + 1}–${Math.min(historyPageStart + PAGE_SIZE, logs.length)} of ${logs.length}`}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline btn-sm" disabled={historyPageSafe <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>‹</button>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>{historyPageSafe}</span>
              <button className="btn-outline btn-sm" disabled={historyPageSafe >= historyTotalPages} onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}>›</button>
            </div>
          </div>
        )}
      </div>

      <div
        className="card"
        style={{
          position: 'sticky', top: 18, padding: 0, overflow: 'hidden',
          boxShadow: '0 12px 32px -18px rgba(16,26,43,.18)',
        }}
      >
        <div style={{
          padding: '18px 20px', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface))',
          borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent)', color: '#fff', flexShrink: 0,
          }}>
            <Send size={17} strokeWidth={2.25} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Dir fariin cusub · Send new SMS</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Hormuud SMS · {status.senderId || 'active'}</div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <label className="field-label">Cidda loo diraayo · Recipients</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button type="button" className={'chip' + (mode === 'all' ? ' active' : '')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setMode('all')}>
              <Users size={13} strokeWidth={2.25} /> Dhammaan · All ({recipients.length})
            </button>
            <button type="button" className={'chip' + (mode === 'selected' ? ' active' : '')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setMode('selected')}>
              <User size={13} strokeWidth={2.25} /> Individual {selectedCount > 0 ? `(${selectedCount})` : ''}
            </button>
          </div>

          {mode === 'selected' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={14} strokeWidth={2.25} color="var(--muted-3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  className="field-input" style={{ width: '100%', paddingLeft: 34 }}
                  placeholder="Raadi ama ku dar lambar · Search or add a number"
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canAddQuery) { e.preventDefault(); addManualPhone(); } }}
                />
              </div>

              {canAddQuery && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }} onClick={addManualPhone}>
                  <Plus size={14} strokeWidth={2.5} /> "{trimmedQuery}" lama helin — ku dar · Not found — add it
                </button>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button type="button" className="btn-outline" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={exportTemplate}>
                  <Download size={13} strokeWidth={2.25} /> Excel soo deji · Export
                </button>
                <button type="button" className="btn-outline" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} strokeWidth={2.25} /> Excel soo geli · Import
                </button>
                <input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }} onChange={onImportFile} />
              </div>

              {trimmedQuery && (
                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border-soft)', borderRadius: 10 }}>
                  {filteredRecipients.map((r) => (
                    <label key={r.phone} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      borderBottom: '1px solid var(--border-soft)', fontSize: 13, cursor: 'pointer',
                      background: selected[r.phone] ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'transparent',
                    }}>
                      <input type="checkbox" checked={!!selected[r.phone]} onChange={() => toggleRecipient(r.phone)} />
                      <PhoneCall size={12} strokeWidth={2.25} color="var(--muted-3)" />
                      <span className="mono" style={{ flex: 1 }}>{r.phone}</span>
                      {r.manual ? (
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '2px 7px', borderRadius: 6 }}>Gacanta · Manual</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>#{r.lastOrderNumber} · {r.orders}x</span>
                      )}
                      {r.manual && (
                        <button type="button" onClick={(e) => { e.preventDefault(); removeManualPhone(r.phone); }} style={{ display: 'flex', color: 'var(--muted-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                          <X size={13} strokeWidth={2.25} />
                        </button>
                      )}
                    </label>
                  ))}
                  {!filteredRecipients.length && (
                    <div className="text-muted" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>
                      Lambar la mid ah lama helin · No matching number
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="field-label">Fariinta · Message</label>
          <textarea
            className="field-input" style={{ marginBottom: 10, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Qor fariinta halkan…"
          />

          {mode === 'selected' && selectedCount > 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 10 }}>
              Waxaad u dirayaa {selectedCount} qof: <span className="mono">{previewSample.join(', ')}</span>{selectedCount > previewSample.length ? `, +${selectedCount - previewSample.length}` : ''}
            </div>
          )}

          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%', padding: 13, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={send} disabled={busy}>
            <Send size={14} strokeWidth={2.25} /> {busy ? 'Diraya…' : 'Dir SMS · Send SMS'}
          </button>
        </div>
      </div>

      {importPreview && (
        <Modal onClose={() => setImportPreview(null)} width={420}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--accent) 14%, var(--surface))', color: 'var(--accent)', flexShrink: 0,
            }}>
              <FileSpreadsheet size={18} strokeWidth={2.25} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Preview · {importPreview.length} lambar la helay</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Hubi lambarada ka hor inta aadan xaqiijin · Review before confirming</div>
            </div>
          </div>
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border-soft)', borderRadius: 10, marginBottom: 18 }}>
            {importPreview.map((p) => (
              <div key={p} className="mono" style={{ padding: '9px 12px', fontSize: 13, borderBottom: '1px solid var(--border-soft)' }}>{p}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-outline" onClick={() => setImportPreview(null)}>
              Jooji · Cancel
            </button>
            <button
              type="button" className="btn" style={{ background: 'var(--accent)', color: '#fff', padding: '11px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={confirmImport}
            >
              <CheckCircle2 size={15} strokeWidth={2.25} /> Xaqiiji · Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
