import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

export default function Sms() {
  const { addToast, confirm } = useOutletContext();
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/restaurants').then((r) => {
      setRestaurants(r.data);
      if (r.data.length) setRestaurantId(r.data[0].id);
    }).catch((e) => setError(apiErrorMessage(e)));
  }, []);

  function loadAccount() {
    if (!restaurantId) return;
    setLoadingAccount(true);
    api.get(`/admin/restaurants/${restaurantId}/sms-account`)
      .then((r) => setAccount(r.data))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoadingAccount(false));
  }

  useEffect(loadAccount, [restaurantId]);

  async function disconnect() {
    const ok = await confirm({
      title: 'Ka saar SMS-kan · Disconnect SMS?',
      tone: 'danger', confirmLabel: 'Ka saar · Disconnect',
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/restaurants/${restaurantId}/sms-account`);
      loadAccount();
      addToast({ title: 'SMS waa laga saaray · SMS disconnected', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to disconnect', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">SMS</h1>
        <p className="page-sub">Isku xir Hormuud SMS API maqaayad kasta · Connect Hormuud SMS per restaurant.</p>
      </div>

      <div style={{ background: 'linear-gradient(180deg,#F8FAFC,#fff)', border: '1px dashed #C7D2E0', borderRadius: 16, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Hormuud SMS API</span>
          <select className="field-input" style={{ maxWidth: 260 }} value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <p style={{ margin: '0 0 18px', color: 'var(--muted-1)', fontSize: 14, maxWidth: 620 }}>
          Isku xir credentials-ka Hormuud SMS si maqaayadan uga diri karto fariimo lambarrada dalabyada. Connect Hormuud credentials so this restaurant can send SMS to their order phone numbers.
        </p>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', maxWidth: 460 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: '#EEF3FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: '0 0 auto' }}>SMS</div>
          <div style={{ minWidth: 140, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Hormuud</div>
            {loadingAccount ? (
              <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>Loading…</div>
            ) : account ? (
              <div style={{ fontSize: 12, color: 'var(--muted-3)' }} className="mono">
                {account.username} {account.senderId ? `· ${account.senderId}` : ''} · {account.status === 'active' ? 'Connected' : 'Disabled'}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>Not connected</div>
            )}
          </div>
          {account ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline" onClick={() => setModalOpen(true)}>Edit</button>
              <button className="btn-danger-outline" onClick={disconnect}>Disconnect</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setModalOpen(true)} disabled={!restaurantId}>Connect</button>
          )}
        </div>
      </div>

      {modalOpen && (
        <SmsAccountModal
          restaurantId={restaurantId}
          existing={account}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            const wasEditing = !!account;
            setModalOpen(false); loadAccount();
            addToast({
              title: wasEditing ? 'Isbeddelka waa la keydiyay · Changes saved' : 'SMS waa la xiray · SMS connected',
              tone: 'success',
            });
          }}
        />
      )}
    </div>
  );
}

function SmsAccountModal({ restaurantId, existing, onClose, onSaved }) {
  const [form, setForm] = useState({ username: '', password: '', senderId: existing?.senderId || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (existing) {
        await api.patch(`/admin/restaurants/${restaurantId}/sms-account`, form);
      } else {
        if (!form.username || !form.password) { setError('Username and password are required'); setBusy(false); return; }
        await api.post(`/admin/restaurants/${restaurantId}/sms-account`, form);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save SMS account'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={440}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>{existing ? 'Edit' : 'Connect'} · Hormuud SMS</div>
        <label className="field-label">Hormuud Username</label>
        <input
          className="field-input" style={{ marginBottom: 14 }} value={form.username} onChange={set('username')}
          placeholder={existing ? 'Leave blank to keep current' : ''}
        />
        <label className="field-label">Hormuud Password</label>
        <input
          className="field-input" style={{ marginBottom: 14 }} type="text" value={form.password} onChange={set('password')}
          placeholder={existing ? 'Leave blank to keep current' : ''}
        />
        <label className="field-label">Sender ID (optional)</label>
        <input className="field-input" style={{ marginBottom: 14 }} value={form.senderId} onChange={set('senderId')} placeholder="e.g. Miis" />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Keydi · Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
