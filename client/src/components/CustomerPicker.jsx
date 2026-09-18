import { useEffect, useRef, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api';
import { useOutsideClick } from '../lib/useOutsideClick';

const money = (n) => '$' + Number(n || 0).toFixed(2);

// Search-or-create widget for picking who an order gets charged to ("Deyn"). Selecting
// an existing customer hands back { id, name, phone, balance }; typing a name and
// confirming "Add new" hands back { isNew: true, name, phone } instead — callers send
// whichever shape straight through as customerId, or customerName/customerPhone.
export default function CustomerPicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const boxRef = useRef(null);
  useOutsideClick(boxRef, () => { setOpen(false); setCreating(false); }, open);

  useEffect(() => {
    if (!open || value) return;
    const t = setTimeout(() => {
      api.get('/restaurant/customers', { params: { q: query } }).then((r) => setResults(r.data)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, value]);

  if (value) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--panel)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {value.name}
            {value.isNew && <span style={{ color: 'var(--accent)', fontWeight: 700 }}> · cusub · new</span>}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>
            {value.phone || '—'}
            {!value.isNew && value.balance > 0 ? ` · Hore ayuu ku leeyahay ${money(value.balance)} · already owes ${money(value.balance)}` : ''}
          </div>
        </div>
        <button
          type="button" onClick={() => onChange(null)} title="Beddel · Change"
          style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: '0 0 auto' }}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-3)' }} />
        <input
          className="field-input" style={{ paddingLeft: 32 }}
          placeholder="Raadi ama ku qor magaca macmiilka… · Search or type a name…"
          value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="dropdown-panel" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, width: 'auto', maxHeight: 280, overflowY: 'auto', zIndex: 40 }}>
          {results.map((c) => (
            <button
              key={c.id} type="button"
              onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border-soft)', background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{c.phone || '—'}</div>
              </div>
              {c.balance > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--danger)' }}>{money(c.balance)}</div>}
            </button>
          ))}
          {!results.length && <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--muted-3)' }}>Wax macmiil ah lama helin · No matches</div>}

          <div style={{ padding: 10, borderTop: '1px solid var(--border-soft)' }}>
            {!creating ? (
              <button
                type="button" onClick={() => setCreating(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 6px', border: 'none',
                  background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <UserPlus size={14} strokeWidth={2.25} /> Ku dar macmiil cusub · Add new customer
              </button>
            ) : (
              <div>
                <label className="field-label">Magaca · Name</label>
                <input className="field-input" style={{ marginBottom: 8 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tusaale · e.g. Cali" autoFocus />
                <label className="field-label">Lambarka · Phone (ikhtiyaari · optional)</label>
                <input className="field-input" style={{ marginBottom: 10 }} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="063 xxxxxxx" />
                <button
                  type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }}
                  disabled={!query.trim()}
                  onClick={() => {
                    onChange({ isNew: true, name: query.trim(), phone: newPhone.trim() });
                    setOpen(false); setCreating(false); setNewPhone('');
                  }}
                >
                  Xaqiiji · Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
