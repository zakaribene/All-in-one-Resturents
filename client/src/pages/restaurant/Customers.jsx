import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, HandCoins, Phone, Receipt, Wallet } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

const money = (n) => '$' + Number(n || 0).toFixed(2);

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return new Date(date).toLocaleDateString();
}

function CustomerDetailModal({ customerId, onClose, addToast, onSettled }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState(null);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/restaurant/customers/${customerId}`).then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e)));
  }
  useEffect(load, [customerId]);
  useEffect(() => {
    api.get('/restaurant/pos/payment-options').then((r) => {
      const m = r.data.manualMethods || [];
      setMethods(m);
      setMethodId((prev) => prev || m[0]?.id || null);
    });
  }, []);

  const balance = data?.customer.balance || 0;
  const amountNum = Math.round((Number(amount) || 0) * 100) / 100;
  const canSettle = amountNum > 0 && amountNum <= balance + 0.001 && methodId;

  async function settle() {
    if (!canSettle || busy) return;
    setBusy(true);
    try {
      const { data: res } = await api.post(`/restaurant/customers/${customerId}/payments`, { amount: amountNum, methodId, note: note.trim() });
      addToast({ title: 'Lacagta waa la diiwaan geliyay · Payment recorded', body: `${money(amountNum)} · ${res.payment.methodName}`, tone: 'success' });
      setAmount(''); setNote('');
      onSettled?.(res.customer);
      load();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={520}>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
      {!data && !error && <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>Loading…</div>}
      {data && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{data.customer.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{money(balance)}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Phone size={12} strokeWidth={2.25} /> {data.customer.phone || '—'}
          </div>

          {balance > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 18, background: 'var(--panel)' }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}>Dajiso lacagta · Settle payment</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="number" min="0" step="0.01" max={balance} className="field-input" style={{ flex: 1 }}
                  placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
                />
                <button className="btn-outline btn-sm" onClick={() => setAmount(String(balance))} title="Dhammaan · Full amount">Dhammaan</button>
              </div>
              {methods === null && <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>Loading wallets…</div>}
              {!!methods?.length && (
                <>
                  <label className="field-label">Halka lacagtu ku dhacday · Received into</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    {methods.map((m) => (
                      <button key={m.id} type="button" className={'chip' + (methodId === m.id ? ' active' : '')} onClick={() => setMethodId(m.id)}>{m.name}</button>
                    ))}
                  </div>
                </>
              )}
              {methods !== null && !methods.length && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>
                  Weli hab lacag-bixin ma jiro · No wallet yet — create one on the Payment Methods page first.
                </div>
              )}
              <input
                className="field-input" style={{ marginBottom: 10 }} placeholder="Faallo (ikhtiyaari) · Note (optional)"
                value={note} onChange={(e) => setNote(e.target.value)}
              />
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={!canSettle || busy} onClick={settle}>
                {busy ? 'Diiwaan gelinaya…' : `Xaqiiji ${amountNum > 0 ? money(amountNum) : ''} · Confirm`}
              </button>
            </div>
          )}

          <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>Dalabyada deynta · Debt orders</div>
          <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 16 }}>
            {!data.orders.length && <div className="text-muted" style={{ fontSize: 12.5 }}>Wax dalab ah lama helin · No debt orders.</div>}
            {data.orders.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-soft)', fontSize: 12.5 }}>
                <span>#{o.number} · {timeAgo(o.createdAt)}</span>
                <span style={{ fontWeight: 700 }}>{money(o.total)}</span>
              </div>
            ))}
          </div>

          <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>Taariikhda lacag-bixinta · Payment history</div>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            {!data.payments.length && <div className="text-muted" style={{ fontSize: 12.5 }}>Weli wax lacag ah lama bixin · No payments yet.</div>}
            {data.payments.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-soft)', fontSize: 12.5 }}>
                <span>{p.methodName} · {p.staffName} · {timeAgo(p.createdAt)}</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>+{money(p.amount)}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, textAlign: 'right' }}>
            <button className="btn-outline" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Customers() {
  const { addToast } = useOutletContext();
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  function load() {
    api.get('/restaurant/customers').then((r) => setCustomers(r.data)).catch((e) => setError(apiErrorMessage(e)));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q));
  }, [customers, query]);

  const totalOwed = useMemo(() => (customers || []).reduce((a, c) => a + c.balance, 0), [customers]);
  const debtorCount = useMemo(() => (customers || []).filter((c) => c.balance > 0).length, [customers]);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Macaamiisha · Customers</h1>
        <p className="page-sub">Macaamiisha deynta leh iyo dajinta lacagtooda · Customers with store credit ("Deyn") and settling what they owe.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, marginBottom: 8 }}>Wadarta la leeyahay · Total owed</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{money(totalOwed)}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 700, marginBottom: 8 }}>Macaamiisha deynta leh · Customers owing</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{debtorCount}</div>
        </div>
      </div>

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
        <Search size={14} strokeWidth={2.25} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-3)' }} />
        <input className="field-input" style={{ paddingLeft: 32 }} placeholder="Raadi macmiil… · Search customers…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {!customers && !error && <div className="text-muted">Loading…</div>}

      {customers && !filtered.length && (
        <div className="card" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <HandCoins size={30} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Weli macmiil deyn ah ma jiro · No customers yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4 }}>
            Waxaa lagu daraa marka POS lagu doorto "Deyn" · Added from the POS page's "Deyn" option.
          </div>
        </div>
      )}

      {customers && !!filtered.length && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 40px', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
            <div>Macmiil · Customer</div><div>Lambar · Phone</div><div style={{ textAlign: 'right' }}>Wadarta · Balance</div><div />
          </div>
          {filtered.map((c) => (
            <button
              key={c.id} onClick={() => setSelectedId(c.id)}
              style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 40px', gap: 12, padding: '13px 20px',
                borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13, width: '100%', textAlign: 'left',
                border: 'none', borderBottomWidth: '1px', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div className="mono" style={{ color: 'var(--muted-3)' }}>{c.phone || '—'}</div>
              <div style={{ textAlign: 'right', fontWeight: 800, color: c.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{money(c.balance)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--muted-3)' }}>
                {c.balance > 0 ? <Receipt size={14} strokeWidth={2.25} /> : <Wallet size={14} strokeWidth={2.25} />}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <CustomerDetailModal
          customerId={selectedId} addToast={addToast}
          onClose={() => setSelectedId(null)}
          onSettled={(updated) => setCustomers((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)))}
        />
      )}
    </div>
  );
}
