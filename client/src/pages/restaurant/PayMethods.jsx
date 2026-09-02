import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Power, Plus, Wallet } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

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

export default function PayMethods() {
  const { addToast, confirm } = useOutletContext();
  const [methods, setMethods] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editMethod, setEditMethod] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/restaurant/payment-methods'),
      api.get('/restaurant/payment-methods/collections?limit=50'),
    ])
      .then(([m, c]) => { setMethods(m.data); setCollections(c.data); })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggle(m) {
    try {
      const { data } = await api.patch(`/restaurant/payment-methods/${m.id}`, {
        status: m.status === 'active' ? 'disabled' : 'active',
      });
      setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...data } : x)));
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to update', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  async function remove(m) {
    const ok = await confirm({
      title: `Tirtir "${m.name}" · Delete this method?`,
      body: 'Diiwaanka hore waa la hayaa · Past collection history is kept.',
      tone: 'danger', confirmLabel: 'Tirtir · Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/restaurant/payment-methods/${m.id}`);
      setMethods((prev) => prev.filter((x) => x.id !== m.id));
      addToast({ title: 'Waa la tirtiray · Method deleted', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to delete', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  const totalBalance = methods.reduce((a, m) => a + (m.balance || 0), 0);
  const totalToday = methods.reduce((a, m) => a + (m.todayTotal || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24 }}>Xisaabaadka · Payment Methods</h1>
          <p className="page-sub">
            Habab lacag-bixin oo aad adigu abuurato — balance-koodu wuxuu kordhaa dalab kasta oo POS manual ah ·
            Wallets you define — each balance grows with every manual POS order.
          </p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowAdd(true)}>
          <Plus size={15} strokeWidth={2.25} /> Hab cusub · Add method
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {loading && <div className="text-muted">Loading…</div>}

      {!loading && !methods.length && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Wallet size={34} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Weli hab lacag-bixin ma jiro · No payment methods yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginBottom: 18 }}>
            Tusaale: abuur "EVC", "eDahab", "Cash" · Example: create "EVC", "eDahab", "Cash".
          </div>
          <button className="btn btn-primary" style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowAdd(true)}>
            <Plus size={15} strokeWidth={2.25} /> Hab cusub · Add method
          </button>
        </div>
      )}

      {!loading && !!methods.length && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 26 }}>
            {methods.map((m) => (
              <div key={m.id} className="card card-pad" style={{ opacity: m.status === 'active' ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{m.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button title="Wax ka beddel · Edit" onClick={() => setEditMethod(m)} style={iconBtn()}>
                      <Pencil size={13} strokeWidth={2.25} />
                    </button>
                    <button title={m.status === 'active' ? 'Xir · Disable' : 'Fur · Enable'} onClick={() => toggle(m)} style={iconBtn('var(--warning-fg)')}>
                      <Power size={13} strokeWidth={2.25} />
                    </button>
                    <button title="Tirtir · Delete" onClick={() => remove(m)} style={iconBtn('var(--danger)', 'var(--danger-bg)', 'var(--danger-border)')}>
                      <Trash2 size={13} strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 26, marginTop: 10 }}>{money(m.balance)}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 4 }}>
                  Maanta · Today {money(m.todayTotal)} · {m.count} dalab
                </div>
                {m.status !== 'active' && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger)', marginTop: 8 }}>⏸ La xiray · Disabled</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 24, marginBottom: 26, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted-2)' }}>
            <span>Wadarta guud · Total balance <b style={{ color: 'var(--text)' }}>{money(totalBalance)}</b></span>
            <span>Maanta guud · Collected today <b style={{ color: 'var(--text)' }}>{money(totalToday)}</b></span>
          </div>

          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Dhaqdhaqaaqii ugu dambeeyay · Recent collections</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr 1.4fr 1.2fr .9fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
              <div>Order</div><div>Amount</div><div>Method</div><div>Staff</div><div style={{ textAlign: 'right' }}>When</div>
            </div>
            {!collections.length && <div className="text-muted" style={{ padding: 24, textAlign: 'center' }}>Weli waxba lama qaban · Nothing collected yet.</div>}
            {collections.map((c) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '.8fr 1fr 1.4fr 1.2fr .9fr', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
                <div className="mono" style={{ fontWeight: 800 }}>#{c.orderNumber}</div>
                <div style={{ fontWeight: 800 }}>{money(c.amount)}</div>
                <div>{c.methodName}</div>
                <div style={{ color: 'var(--muted-5)' }}>{c.staffName}</div>
                <div style={{ textAlign: 'right', color: 'var(--muted-3)', fontSize: 12 }}>{timeAgo(c.createdAt)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {showAdd && (
        <MethodModal
          title="Hab cusub · Add method"
          submitLabel="Ku dar · Add"
          onClose={() => setShowAdd(false)}
          onSubmit={(form) => api.post('/restaurant/payment-methods', form)}
          onDone={(m) => {
            setMethods((prev) => [...prev, m]); setShowAdd(false);
            addToast({ title: 'Waa la daray · Method added', body: m.name, tone: 'success' });
          }}
        />
      )}
      {editMethod && (
        <MethodModal
          title="Wax ka beddel · Edit method"
          submitLabel="Keydi · Save"
          initial={{ name: editMethod.name }}
          onClose={() => setEditMethod(null)}
          onSubmit={(form) => api.patch(`/restaurant/payment-methods/${editMethod.id}`, form)}
          onDone={(m) => {
            setMethods((prev) => prev.map((x) => (x.id === editMethod.id ? { ...x, ...m } : x)));
            setEditMethod(null);
            addToast({ title: 'Isbeddelka waa la keydiyay · Changes saved', body: m.name, tone: 'success' });
          }}
        />
      )}
    </div>
  );
}

function iconBtn(color = 'var(--muted-4)', bg = 'var(--surface)', border = 'var(--border)') {
  return {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${border}`, background: bg, color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

function MethodModal({ title, submitLabel, initial, onClose, onSubmit, onDone }) {
  const [name, setName] = useState(initial?.name || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Magaca waa lagama maarmaan · Name is required'); return; }
    setBusy(true); setError('');
    try {
      const { data } = await onSubmit({ name: name.trim() });
      onDone(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save'));
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} width={400}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>{title}</div>
        <label className="field-label">Magaca · Name (e.g. EVC, eDahab, Cash)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
