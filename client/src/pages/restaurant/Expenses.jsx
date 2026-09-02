import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Receipt, ArrowRight, Plus, Trash2, Wallet, X } from 'lucide-react';
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

export default function Expenses() {
  const { addToast, confirm } = useOutletContext();
  const [methods, setMethods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({ today: 0, month: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [categoryId, setCategoryId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  function load() {
    setLoading(true);
    api.get('/restaurant/expenses?limit=50')
      .then(({ data }) => {
        setMethods(data.methods); setCategories(data.categories);
        setExpenses(data.expenses); setTotals(data.totals);
      })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const activeMethods = useMemo(() => methods.filter((m) => m.status === 'active'), [methods]);
  const method = methods.find((m) => m.id === methodId) || null;
  const amountNum = Math.round((Number(amount) || 0) * 100) / 100;
  const overdraw = !!method && amountNum > 0 && amountNum > (method.balance || 0);
  const canSubmit = categoryId && method && amountNum > 0 && !overdraw;

  async function addCategory() {
    const name = newCat.trim();
    if (!name || addingCat) return;
    setAddingCat(true);
    try {
      const { data } = await api.post('/restaurant/expense-categories', { name });
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(data.id);
      setNewCat('');
      addToast({ title: 'Qaybta waa la daray · Category added', body: data.name, tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setAddingCat(false);
    }
  }

  async function removeCategory(c) {
    const ok = await confirm({
      title: `Tirtir "${c.name}" · Delete this category?`,
      tone: 'danger', confirmLabel: 'Tirtir · Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/restaurant/expense-categories/${c.id}`);
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      if (categoryId === c.id) setCategoryId('');
      addToast({ title: 'Qaybta waa la tirtiray · Category deleted', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!categoryId) { setFormError('Dooro qaybta · Choose a category'); return; }
    if (!method) { setFormError('Dooro habka lacag-bixinta · Choose a payment method'); return; }
    if (!(amountNum > 0)) { setFormError('Qadarka waa inuu ka weyn yahay 0 · Amount must be greater than 0'); return; }
    if (overdraw) { setFormError(`Balance ku filan ma jiro ${method.name} · Not enough balance in ${method.name}`); return; }

    setBusy(true); setFormError('');
    try {
      const { data } = await api.post('/restaurant/expenses', {
        categoryId, methodId, amount: amountNum, note: note.trim(),
      });
      setMethods((prev) => prev.map((m) => (m.id in data.balance ? { ...m, balance: data.balance[m.id] } : m)));
      setExpenses((prev) => [data.expense, ...prev]);
      setTotals((prev) => ({ today: prev.today + data.expense.amount, month: prev.month + data.expense.amount }));
      setAmount(''); setNote('');
      addToast({
        title: 'Kharashka waa la diiwaan geliyay · Expense recorded',
        body: `${money(data.expense.amount)} · ${data.expense.categoryName} — ${data.expense.methodName}`,
        tone: 'success',
      });
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Failed to record expense'));
    } finally {
      setBusy(false);
    }
  }

  async function removeExpense(x) {
    const ok = await confirm({
      title: `Tirtir kharashka · Delete this expense?`,
      body: `${money(x.amount)} — ${x.methodName} dib ayaa loogu celin doonaa · will be returned to ${x.methodName}.`,
      tone: 'danger', confirmLabel: 'Tirtir · Delete',
    });
    if (!ok) return;
    try {
      const { data } = await api.delete(`/restaurant/expenses/${x.id}`);
      setExpenses((prev) => prev.filter((e) => e.id !== x.id));
      setTotals((prev) => ({ today: prev.today - x.amount, month: prev.month - x.amount }));
      if (data.balance) setMethods((prev) => prev.map((m) => (m.id in data.balance ? { ...m, balance: data.balance[m.id] } : m)));
      addToast({ title: 'Kharashka waa la tirtiray · Expense deleted', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Kharashaadka · Expenses</h1>
        <p className="page-sub">
          Lacag baxda ka jar hab lacag-bixin — tusaale $1 "Delivery" oo EVC laga bixiyay ·
          Record money going out and deduct it from a wallet — e.g. a $1 "Delivery" paid from EVC.
        </p>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {loading && <div className="text-muted">Loading…</div>}

      {!loading && !activeMethods.length && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Wallet size={34} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Weli hab lacag-bixin firfircoon ma jiro · No active wallet yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>
            Aad "Xisaabaadka" oo abuur EVC, eDahab, Cash · Go to "Payment Methods" and create EVC, eDahab, Cash first.
          </div>
        </div>
      )}

      {!loading && !!activeMethods.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 20, alignItems: 'start' }}>
          {/* ---- Expense form ---- */}
          <form onSubmit={submit} className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, marginBottom: 18 }}>
              <Receipt size={16} strokeWidth={2.25} color="var(--accent)" />
              Kharash cusub · New expense
            </div>

            <label className="field-label">Qaybta · Category</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select className="field-input" style={{ flex: 1 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Dooro · Select —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="field-input" style={{ flex: 1 }} maxLength={40}
                placeholder="Qayb cusub abuur · Create a category (e.g. Delivery, Rent)"
                value={newCat} onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
              />
              <button type="button" onClick={addCategory} className="btn-outline" disabled={addingCat || !newCat.trim()} style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                <Plus size={14} strokeWidth={2.5} /> Ku dar
              </button>
            </div>

            <label className="field-label">Habka lacag-bixinta · Payment method</label>
            <select className="field-input" style={{ marginBottom: 16 }} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              <option value="">— Dooro · Select —</option>
              {activeMethods.map((m) => <option key={m.id} value={m.id}>{m.name} · {money(m.balance)}</option>)}
            </select>

            <label className="field-label">Qadarka · Amount ($)</label>
            <input
              className="field-input" type="number" min="0" step="0.01" inputMode="decimal"
              placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
              style={{ marginBottom: 4, fontWeight: 800, fontSize: 18 }}
            />
            {method && (
              <div style={{ fontSize: 12, color: overdraw ? 'var(--danger)' : 'var(--muted-2)', marginBottom: 12 }}>
                {overdraw
                  ? `Balance ku filan ma jiro — ${method.name} wuxuu hayaa ${money(method.balance)}`
                  : `La heli karo · Available ${money(method.balance)}`}
              </div>
            )}

            <label className="field-label">Faallo · Note (ikhtiyaari · optional)</label>
            <input
              className="field-input" style={{ marginBottom: 14 }} maxLength={200}
              placeholder="Faahfaahin · Details" value={note} onChange={(e) => setNote(e.target.value)}
            />

            {(method && amountNum > 0 && !overdraw) && (
              <div style={{
                border: '1px solid var(--border-soft)', borderRadius: 12, padding: 14, marginBottom: 14,
                background: 'var(--panel)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13,
              }}>
                <span style={{ fontWeight: 700 }}>{method.name}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-3)' }}>
                  {money(method.balance)}
                  <ArrowRight size={12} strokeWidth={2.5} />
                  <b style={{ color: 'var(--danger)' }}>{money(method.balance - amountNum)}</b>
                </span>
              </div>
            )}

            {formError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{formError}</div>}

            <button type="submit" className="btn btn-primary" disabled={busy || !canSubmit} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Receipt size={15} strokeWidth={2.5} />
              {busy ? 'Waa la diiwaan gelinayaa…' : `Diiwaan geli · Record${amountNum > 0 ? ' ' + money(amountNum) : ''}`}
            </button>
          </form>

          {/* ---- Side panel ---- */}
          <div style={{ display: 'grid', gap: 20 }}>
            <div className="card card-pad">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Wadarta kharashka · Spent</div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Maanta · Today</div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{money(totals.today)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Bishaan · This month</div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{money(totals.month)}</div>
                </div>
              </div>
            </div>

            <div className="card card-pad">
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Xisaabaadka · Wallets</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {methods.map((m) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)',
                    opacity: m.status === 'active' ? 1 : 0.5,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {m.name}
                      {m.status !== 'active' && <span style={{ color: 'var(--danger)', fontSize: 11, marginLeft: 6 }}>⏸</span>}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{money(m.balance)}</div>
                  </div>
                ))}
              </div>
            </div>

            {!!categories.length && (
              <div className="card card-pad">
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Qaybaha · Categories</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {categories.map((c) => (
                    <span key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                      color: 'var(--muted-5)', background: 'var(--panel)', border: '1px solid var(--border-soft)',
                      padding: '4px 6px 4px 10px', borderRadius: 8,
                    }}>
                      {c.name}
                      <button
                        type="button" onClick={() => removeCategory(c)} title="Tirtir · Delete"
                        style={{ border: 'none', background: 'none', color: 'var(--muted-3)', cursor: 'pointer', display: 'flex', padding: 2 }}
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !!expenses.length && (
        <>
          <div style={{ fontWeight: 800, fontSize: 15, margin: '28px 0 10px' }}>Kharashaadkii ugu dambeeyay · Recent expenses</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1.1fr .8fr 40px', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
              <div>Qayb · Category</div><div>Qadar · Amount</div><div>Hab · Method</div><div>Qofka · By</div><div style={{ textAlign: 'right' }}>Goorma</div><div />
            </div>
            {expenses.map((x) => (
              <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1.1fr .8fr 40px', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{x.categoryName}</div>
                  {x.note && <div style={{ color: 'var(--muted-3)', fontSize: 12 }}>{x.note}</div>}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--danger)' }}>− {money(x.amount)}</div>
                <div>{x.methodName}</div>
                <div style={{ color: 'var(--muted-5)' }}>{x.staffName}</div>
                <div style={{ textAlign: 'right', color: 'var(--muted-3)', fontSize: 12 }}>{timeAgo(x.createdAt)}</div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button" onClick={() => removeExpense(x)} title="Tirtir · Delete"
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={12} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
