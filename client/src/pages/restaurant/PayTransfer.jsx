import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Wallet, Repeat } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';

function money(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function timeAgo(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Hadda · now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return new Date(date).toLocaleDateString();
}

export default function PayTransfer() {
  const { addToast } = useOutletContext();
  const [methods, setMethods] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function load() {
    setLoading(true);
    api.get('/restaurant/payment-transfers?limit=50')
      .then(({ data }) => { setMethods(data.methods); setTransfers(data.transfers); })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const activeMethods = useMemo(() => methods.filter((m) => m.status === 'active'), [methods]);
  const from = methods.find((m) => m.id === fromId) || null;
  const to = methods.find((m) => m.id === toId) || null;
  const amountNum = Math.round((Number(amount) || 0) * 100) / 100;

  const canSubmit = from && to && from.id !== to.id && amountNum > 0 && amountNum <= (from.balance || 0);
  const overdraw = !!from && amountNum > 0 && amountNum > (from.balance || 0);

  function swap() {
    setFromId(toId);
    setToId(fromId);
  }

  async function submit(e) {
    e.preventDefault();
    if (!from || !to) { setFormError('Dooro labada hab · Choose both wallets'); return; }
    if (from.id === to.id) { setFormError('Isku hab lama wareejin karo · Pick two different wallets'); return; }
    if (!(amountNum > 0)) { setFormError('Qadarka waa inuu ka weyn yahay 0 · Amount must be greater than 0'); return; }
    if (overdraw) { setFormError(`Balance ku filan ma jiro ${from.name} · Not enough balance in ${from.name}`); return; }

    setBusy(true); setFormError('');
    try {
      const { data } = await api.post('/restaurant/payment-transfers', {
        fromMethodId: from.id, toMethodId: to.id, amount: amountNum, note: note.trim(),
      });
      setMethods((prev) => prev.map((m) => (
        m.id in data.balances ? { ...m, balance: data.balances[m.id] } : m
      )));
      setTransfers((prev) => [data.transfer, ...prev]);
      setAmount(''); setNote('');
      addToast({
        title: 'Wareejinta waa la sameeyay · Transfer complete',
        body: `${money(data.transfer.amount)} · ${data.transfer.fromMethodName} → ${data.transfer.toMethodName}`,
        tone: 'success',
      });
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Failed to transfer'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Wareejin Lacag · Transfer Payment</h1>
        <p className="page-sub">
          Balance ka wareeji hab lacag-bixin oo mid kale — tusaale $50 EVC ku jira u wareeji eDahab ·
          Move a balance from one wallet to another — e.g. send $50 from EVC to eDahab.
        </p>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {loading && <div className="text-muted">Loading…</div>}

      {!loading && activeMethods.length < 2 && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Wallet size={34} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            Ugu yaraan laba hab oo firfircoon ayaa loo baahan yahay · Need at least two active wallets
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>
            Aad "Xisaabaadka" oo abuur EVC iyo eDahab · Go to "Payment Methods" and create EVC and eDahab first.
          </div>
        </div>
      )}

      {!loading && activeMethods.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 360px)', gap: 20, alignItems: 'start' }}>
          {/* ---- Transfer form ---- */}
          <form onSubmit={submit} className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, marginBottom: 18 }}>
              <ArrowLeftRight size={16} strokeWidth={2.25} color="var(--accent)" />
              Wareejin cusub · New transfer
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <label className="field-label">Ka · From</label>
                <select className="field-input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                  <option value="">— Dooro · Select —</option>
                  {activeMethods.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id === toId}>
                      {m.name} · {money(m.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button" onClick={swap} title="Is-weydaarso · Swap"
                style={{
                  width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--muted-4)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 3,
                }}
              >
                <Repeat size={14} strokeWidth={2.25} />
              </button>

              <div>
                <label className="field-label">Ku · To</label>
                <select className="field-input" value={toId} onChange={(e) => setToId(e.target.value)}>
                  <option value="">— Dooro · Select —</option>
                  {activeMethods.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id === fromId}>
                      {m.name} · {money(m.balance)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="field-label" style={{ marginTop: 16 }}>Qadarka · Amount ($)</label>
            <input
              className="field-input" type="number" min="0" step="0.01" inputMode="decimal"
              placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ marginBottom: 4, fontWeight: 800, fontSize: 18 }}
            />
            {from && (
              <div style={{ fontSize: 12, color: overdraw ? 'var(--danger)' : 'var(--muted-2)', marginBottom: 12 }}>
                {overdraw
                  ? `Balance ku filan ma jiro — ${from.name} wuxuu hayaa ${money(from.balance)}`
                  : `La heli karo · Available ${money(from.balance)}`}
                {' '}
                {!overdraw && (
                  <button
                    type="button" onClick={() => setAmount(String(from.balance))}
                    style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 12 }}
                  >
                    · Dhammaan · Max
                  </button>
                )}
              </div>
            )}

            <label className="field-label">Faallo · Note (ikhtiyaari · optional)</label>
            <input
              className="field-input" style={{ marginBottom: 14 }} maxLength={200}
              placeholder="Sababta wareejinta · Reason for the transfer"
              value={note} onChange={(e) => setNote(e.target.value)}
            />

            {(from && to && amountNum > 0 && from.id !== to.id) && (
              <div style={{
                border: '1px solid var(--border-soft)', borderRadius: 12, padding: 14, marginBottom: 14,
                background: 'var(--panel)', display: 'grid', gap: 10,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
                  Ka dib wareejinta · After transfer
                </div>
                <PreviewRow name={from.name} before={from.balance} after={from.balance - amountNum} tone="down" />
                <PreviewRow name={to.name} before={to.balance} after={to.balance + amountNum} tone="up" />
              </div>
            )}

            {formError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{formError}</div>}

            <button type="submit" className="btn btn-primary" disabled={busy || !canSubmit} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ArrowRight size={15} strokeWidth={2.5} />
              {busy ? 'Waa la wareejinayaa…' : `Wareeji · Transfer${amountNum > 0 ? ' ' + money(amountNum) : ''}`}
            </button>
          </form>

          {/* ---- Wallet balances ---- */}
          <div className="card card-pad">
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Xisaabaadka · Wallets</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {methods.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)',
                    opacity: m.status === 'active' ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {m.name}
                    {m.status !== 'active' && <span style={{ color: 'var(--danger)', fontSize: 11, marginLeft: 6 }}>⏸</span>}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{money(m.balance)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !!transfers.length && (
        <>
          <div style={{ fontWeight: 800, fontSize: 15, margin: '28px 0 10px' }}>Wareejinnadii ugu dambeeyay · Recent transfers</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
              <div>Wareejin · Transfer</div><div>Qadar · Amount</div><div>Qofka · By</div><div style={{ textAlign: 'right' }}>Goorma · When</div>
            </div>
            {transfers.map((t) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{t.fromMethodName}</span>
                  <ArrowRight size={13} strokeWidth={2.5} color="var(--muted-3)" />
                  <span style={{ fontWeight: 700 }}>{t.toMethodName}</span>
                  {t.note && <span style={{ color: 'var(--muted-3)', fontSize: 12 }}>· {t.note}</span>}
                </div>
                <div style={{ fontWeight: 800 }}>{money(t.amount)}</div>
                <div style={{ color: 'var(--muted-5)' }}>{t.staffName}</div>
                <div style={{ textAlign: 'right', color: 'var(--muted-3)', fontSize: 12 }}>{timeAgo(t.createdAt)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PreviewRow({ name, before, after, tone }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
      <span style={{ fontWeight: 700 }}>{name}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-3)' }}>
        {money(before)}
        <ArrowRight size={12} strokeWidth={2.5} />
        <b style={{ color: tone === 'down' ? 'var(--danger)' : 'var(--success)' }}>{money(after)}</b>
      </span>
    </div>
  );
}
