import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Receipt } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

export default function Settings() {
  const { me, setMe, addToast } = useOutletContext();
  const [items, setItems] = useState(() => (me?.receiptPaymentNumbers?.length ? me.receiptPaymentNumbers : [{ label: '', number: '' }]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateItem(i, field, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function addRow() { setItems((prev) => [...prev, { label: '', number: '' }]); }
  function removeRow(i) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    setSaving(true); setError('');
    try {
      const clean = items.map((it) => ({ label: it.label.trim(), number: it.number.trim() })).filter((it) => it.label && it.number);
      const { data } = await api.patch('/restaurant/settings/receipt-payment-numbers', { items: clean });
      setItems(data.receiptPaymentNumbers.length ? data.receiptPaymentNumbers : [{ label: '', number: '' }]);
      setMe((prev) => ({ ...prev, receiptPaymentNumbers: data.receiptPaymentNumbers }));
      addToast({ title: 'Waa la keydiyay · Settings saved', tone: 'success' });
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Dejinta · Settings</h1>
        <p className="page-sub">
          Dejinta rasiitka · Customize what appears on printed receipts.
        </p>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={16} strokeWidth={2.25} /> Lambarrada rasiitka · Receipt payment numbers
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 16 }}>
          Waxay ka muuqan doonaan hoosta rasiitka oo dhan · Shown at the bottom of every printed receipt. Tusaale · Example: EVC → 64848, eDahab → 77484, Premier Wallet → 38457484
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="field-input" style={{ flex: 1 }} placeholder="Magaca · e.g. EVC" value={it.label} onChange={(e) => updateItem(i, 'label', e.target.value)} />
              <input className="field-input" style={{ flex: 1 }} placeholder="Lambarka · e.g. 64848" value={it.number} onChange={(e) => updateItem(i, 'number', e.target.value)} />
              <button
                title="Tirtir · Remove" onClick={() => removeRow(i)}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              ><Trash2 size={14} strokeWidth={2.25} /></button>
            </div>
          ))}
        </div>

        <button className="btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }} onClick={addRow}>
          <Plus size={14} strokeWidth={2.25} /> Ku dar saf · Add row
        </button>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Keydinaya…' : 'Keydi · Save'}</button>
      </div>
    </div>
  );
}
