import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Receipt, Heart, KeyRound } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

export default function Settings() {
  const { me, setMe, addToast } = useOutletContext();
  const [items, setItems] = useState(() => (me?.receiptPaymentNumbers?.length ? me.receiptPaymentNumbers : [{ label: '', number: '' }]));
  const [thankYouMessage, setThankYouMessage] = useState(me?.receiptThankYouMessage || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function changePassword(e) {
    e.preventDefault();
    setPwError(''); setPwSuccess(''); setPwSaving(true);
    try {
      await api.patch('/restaurant/settings/password', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword('');
      setPwSuccess('Furaha waa la beddelay · Password updated.');
      addToast({ title: 'Furaha waa la beddelay · Password updated', tone: 'success' });
    } catch (err) {
      setPwError(apiErrorMessage(err, 'Failed to update password'));
    } finally {
      setPwSaving(false);
    }
  }

  function updateItem(i, field, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function addRow() { setItems((prev) => [...prev, { label: '', number: '' }]); }
  function removeRow(i) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    setSaving(true); setError('');
    try {
      const clean = items.map((it) => ({ label: it.label.trim(), number: it.number.trim() })).filter((it) => it.label && it.number);
      const { data } = await api.patch('/restaurant/settings/receipt', { items: clean, thankYouMessage: thankYouMessage.trim() });
      setItems(data.receiptPaymentNumbers.length ? data.receiptPaymentNumbers : [{ label: '', number: '' }]);
      setThankYouMessage(data.receiptThankYouMessage || '');
      setMe((prev) => ({ ...prev, receiptPaymentNumbers: data.receiptPaymentNumbers, receiptThankYouMessage: data.receiptThankYouMessage }));
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
          Waxay ka muuqan doonaan kor rasiitka, hoosta magaca maqaayadda · Shown near the top of every printed receipt, right under your name. Tusaale · Example: EVC → 64848, eDahab → 77484, Premier Wallet → 38457484
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

        <button className="btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22 }} onClick={addRow}>
          <Plus size={14} strokeWidth={2.25} /> Ku dar saf · Add row
        </button>

        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 18, marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Heart size={16} strokeWidth={2.25} /> Fariinta xarunta · Closing message
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 12 }}>
            Waxay ka muuqan doontaa hoosta ugu dambeysa rasiitka · Shown at the very bottom of every printed receipt. Tusaale · Example: "Mahadsanid, soo noqosho wanaagsan!"
          </div>
          <textarea
            className="field-input" style={{ minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
            maxLength={200} placeholder="Mahadsanid, soo noqosho wanaagsan!"
            value={thankYouMessage} onChange={(e) => setThankYouMessage(e.target.value)}
          />
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Keydinaya…' : 'Keydi · Save'}</button>
      </div>

      <div className="card card-pad" style={{ maxWidth: 560, marginTop: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={16} strokeWidth={2.25} /> Beddel furaha sirta · Change password
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 16 }}>
          Furahaan waxaad ku soo gashaa dashboard-kan · Used to sign in to this dashboard.
        </div>

        <form onSubmit={changePassword} style={{ maxWidth: 340 }}>
          <label className="field-label">Furaha hadda · Current password</label>
          <input
            className="field-input" style={{ marginBottom: 14 }} type="password" required
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label className="field-label">Furaha cusub · New password</label>
          <input
            className="field-input" style={{ marginBottom: 14 }} type="password" required minLength={6}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Ugu yaraan 6 xaraf · At least 6 characters"
          />
          {pwError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{pwError}</div>}
          {pwSuccess && <div style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12 }}>{pwSuccess}</div>}
          <button type="submit" className="btn btn-primary" disabled={pwSaving}>{pwSaving ? 'Keydinaya…' : 'Beddel · Change password'}</button>
        </form>
      </div>
    </div>
  );
}
