import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '../../lib/api';

export default function QrTab() {
  const { me } = useOutletContext();
  const [tables, setTables] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newTableName, setNewTableName] = useState('');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);

  function load() {
    api.get('/restaurant/tables').then((r) => {
      setTables(r.data);
      setSelectedId((prev) => prev || r.data.find((t) => t.type === 'table')?.id || r.data[0]?.id);
    });
  }
  useEffect(load, []);

  async function addTable(e) {
    e.preventDefault();
    const label = newTableName.trim();
    if (!label) return;
    setBusy(true);
    try {
      const { data } = await api.post('/restaurant/tables', { label });
      setTables((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data]));
      setSelectedId(data.id);
      setNewTableName('');
    } finally { setBusy(false); }
  }

  const realTables = tables.filter((t) => t.type === 'table');
  const specials = tables.filter((t) => t.type !== 'table');
  const selected = tables.find((t) => t.id === selectedId);
  const orderUrl = selected ? `${window.location.origin}/order/${selected.code}` : '';

  function download() {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `miis-qr-${selected.label}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>QR Codes · Miisaska</h1>
        <p className="page-sub">QR kursi/miis kasta · A code per table. Scan without a table still works (takeaway).</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-3)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 2 }}>Miisaska · Tables</div>
          {realTables.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10,
                border: '1px solid ' + (selectedId === t.id ? 'var(--accent)' : 'var(--border)'),
                background: selectedId === t.id ? 'color-mix(in srgb, var(--accent) 8%, #fff)' : '#fff',
                cursor: 'pointer', fontWeight: 700, fontSize: 14, color: selectedId === t.id ? 'var(--accent)' : 'var(--text)',
                fontFamily: 'inherit', width: '100%', textAlign: 'left',
              }}
            >
              <span>Miis {t.label}</span>
              <span className="mono" style={{ fontSize: 12, opacity: .7 }}>▦</span>
            </button>
          ))}
          <form onSubmit={addTable} style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <input
              className="field-input" style={{ padding: '10px 12px', fontSize: 13 }}
              placeholder="Miis cusub, ts. D01" value={newTableName} onChange={(e) => setNewTableName(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>+ Ku dar</button>
          </form>

          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-3)', letterSpacing: '.04em', textTransform: 'uppercase', margin: '12px 0 -2px' }}>Kale · Other</div>
          {specials.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10,
                border: '1px solid ' + (selectedId === t.id ? 'var(--accent)' : 'var(--border)'),
                background: selectedId === t.id ? 'color-mix(in srgb, var(--accent) 8%, #fff)' : '#fff',
                cursor: 'pointer', fontWeight: 700, fontSize: 14, color: selectedId === t.id ? 'var(--accent)' : 'var(--text)',
                fontFamily: 'inherit', width: '100%', textAlign: 'left',
              }}
            >
              <span>{t.type === 'online' ? '🌐' : '🛒'} {t.label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted-3)', fontWeight: 600, textAlign: 'right' }}>
                {t.type === 'online' ? 'Dadka online ka dalbada' : "Miis la'aan"}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{me?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-1)', marginBottom: 20 }}>
              {selected.type === 'online' ? 'Online ordering · Dadka online' : selected.type === 'takeaway' ? "Takeaway · Miis la'aan" : `Miis ${selected.label} · Table ${selected.label}`}
            </div>
            <div ref={canvasRef} style={{ border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 12px 30px -18px rgba(16,26,43,.3)', padding: 16, background: '#fff' }}>
              <QRCodeCanvas value={orderUrl} size={168} bgColor="#ffffff" fgColor="#0E1A2B" level="M" />
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--muted-3)', margin: '16px 0 20px' }}>{orderUrl.replace(/^https?:\/\//, '')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={download}>⤓ Download PNG</button>
              <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
