import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

const GATEWAYS = [
  { key: 'evc', label: 'EVC Plus', bg: '#E7F6EE', fg: '#12A150', short: 'EVC' },
  { key: 'zaad', label: 'ZAAD', bg: '#EEF3FF', fg: '#2563EB', short: 'ZAAD' },
  { key: 'edahab', label: 'eDahab', bg: '#F3E8FF', fg: '#8B5CF6', short: 'eDA' },
];

export default function Billing() {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [modalProvider, setModalProvider] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/restaurants').then((r) => {
      setRestaurants(r.data);
      if (r.data.length) setRestaurantId(r.data[0].id);
    }).catch((e) => setError(apiErrorMessage(e)));
  }, []);

  function loadAccounts() {
    if (!restaurantId) return;
    setLoadingAccounts(true);
    api.get(`/admin/restaurants/${restaurantId}/payment-accounts`)
      .then((r) => setAccounts(r.data))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoadingAccounts(false));
  }

  useEffect(loadAccounts, [restaurantId]);

  async function disconnect(accountId) {
    if (!window.confirm('Ma hubtaa inaad ka saarto lacag-bixintan? · Disconnect this payment account?')) return;
    await api.delete(`/admin/restaurants/${restaurantId}/payment-accounts/${accountId}`);
    loadAccounts();
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title">Lacagta · Billing</h1>
        <p className="page-sub">Qorshayaal iyo lacag-bixin · Plans &amp; payment collection.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 15 }}>Free</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>$0<span style={{ fontSize: 13, color: 'var(--muted-2)', fontWeight: 600 }}>/bil</span></div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.7 }}>1 maqaayad · 20 products<br />QR ordering<br />Basic reports</div>
        </div>
        <div className="card card-pad" style={{ border: '2px solid var(--accent)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -11, left: 22, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 99 }}>POPULAR</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Basic</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>$19<span style={{ fontSize: 13, color: 'var(--muted-2)', fontWeight: 600 }}>/bil</span></div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.7 }}>3 maqaayado · unlimited<br />Live orders + sound<br />Sales filtering</div>
        </div>
        <div className="card card-pad">
          <div style={{ fontWeight: 800, fontSize: 15 }}>Pro</div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>$49<span style={{ fontSize: 13, color: 'var(--muted-2)', fontWeight: 600 }}>/bil</span></div>
          <div style={{ fontSize: 13, color: 'var(--muted-1)', lineHeight: 1.7 }}>Unlimited venues<br />Broadcast notifications<br />Priority support</div>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(180deg,#F8FAFC,#fff)', border: '1px dashed #C7D2E0', borderRadius: 16, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Lacag-bixin toos ah · Payment collection</span>
          <select className="field-input" style={{ maxWidth: 260 }} value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <p style={{ margin: '0 0 18px', color: 'var(--muted-1)', fontSize: 14, maxWidth: 620 }}>
          Isku xir API-ga bixinta (WaafiPay) si macaamiishu ay si toos ah ugu bixiyaan marka ay dalbadaan. Connect mobile-money so customers pay automatically at checkout.
        </p>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {GATEWAYS.map((g) => {
            const account = accounts.find((a) => a.provider === g.key);
            return (
              <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: g.bg, color: g.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: '0 0 auto' }}>{g.short}</div>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{account?.label || g.label} {account?.isPrimary && <span style={{ color: '#E8A317' }}>★</span>}</div>
                  {account ? (
                    <div style={{ fontSize: 12, color: 'var(--muted-3)' }} className="mono">
                      {account.apiKeyMasked} · {account.currency} · {account.status === 'active' ? 'Connected' : 'Disabled'}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>Not connected</div>
                  )}
                </div>
                {account ? (
                  <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                    <button className="btn-outline" onClick={() => setModalProvider({ key: g.key, label: g.label, existing: account })}>Edit</button>
                    <button className="btn-danger-outline" onClick={() => disconnect(account.id)}>Disconnect</button>
                  </div>
                ) : (
                  <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={() => setModalProvider({ key: g.key, label: g.label, existing: null })} disabled={!restaurantId}>
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {loadingAccounts && <div className="text-muted" style={{ marginTop: 14 }}>Loading…</div>}
      </div>

      {modalProvider && (
        <PaymentAccountModal
          restaurantId={restaurantId}
          provider={modalProvider.key}
          providerLabel={modalProvider.label}
          existing={modalProvider.existing}
          onClose={() => setModalProvider(null)}
          onSaved={() => { setModalProvider(null); loadAccounts(); }}
        />
      )}
    </div>
  );
}

function PaymentAccountModal({ restaurantId, provider, providerLabel, existing, onClose, onSaved }) {
  const [form, setForm] = useState({
    label: existing?.label || providerLabel,
    baseUrl: existing?.baseUrl || 'https://api.waafipay.net',
    merchantUid: existing?.merchantUid || '',
    apiUserId: '',
    apiKey: '',
    currency: existing?.currency || 'USD',
    isPrimary: existing?.isPrimary || false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (existing) {
        await api.patch(`/admin/restaurants/${restaurantId}/payment-accounts/${existing.id}`, form);
      } else {
        if (!form.apiUserId || !form.apiKey) { setError('apiUserId and apiKey are required'); setBusy(false); return; }
        await api.post(`/admin/restaurants/${restaurantId}/payment-accounts`, { ...form, provider });
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save payment account'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={460}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>{existing ? 'Edit' : 'Connect'} · {providerLabel}</div>
        <label className="field-label">Label</label>
        <input className="field-input" style={{ marginBottom: 14 }} value={form.label} onChange={set('label')} />
        <label className="field-label">WaafiPay base URL</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={form.baseUrl} onChange={set('baseUrl')} />
        <label className="field-label">Merchant UID</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={form.merchantUid} onChange={set('merchantUid')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">API User ID</label>
            <input
              className="field-input" style={{ marginBottom: 14 }} value={form.apiUserId} onChange={set('apiUserId')}
              placeholder={existing ? 'Leave blank to keep current' : ''}
            />
          </div>
          <div>
            <label className="field-label">API Key</label>
            <input
              className="field-input" style={{ marginBottom: 14 }} type="text" value={form.apiKey} onChange={set('apiKey')}
              placeholder={existing ? 'Leave blank to keep current' : ''}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
          <div>
            <label className="field-label">Currency</label>
            <select className="field-input" style={{ marginBottom: 14 }} value={form.currency} onChange={set('currency')}>
              <option value="USD">USD</option>
              <option value="SLSH">SLSH</option>
              <option value="DJF">DJF</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
            Primary
          </label>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Keydi · Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
