import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

function initials(name) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('');
}

export default function Restaurants() {
  const { addToast, confirm } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/admin/restaurants').then((r) => setList(r.data)).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggle(r) {
    const suspending = r.status === 'active';
    if (suspending) {
      const ok = await confirm({
        title: `Xir "${r.name}" · Suspend this restaurant?`,
        message: 'Iyagu ma awoodi doonaan inay dalabyo aqbalaan ilaa aad dib u furto · They will not be able to take orders until you reactivate.',
        tone: 'danger', confirmLabel: 'Xir · Suspend',
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/admin/restaurants/${r.id}/toggle`);
      load();
      addToast({ title: suspending ? 'Waa la xiray · Restaurant suspended' : 'Waa la furay · Restaurant activated', body: r.name, tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Action failed', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  async function openView(id) {
    const { data } = await api.get(`/admin/restaurants/${id}`);
    setViewing(data);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Maqaayadaha · Restaurants</h1>
          <p className="page-sub">Diiwaan geli, fiiri, xir · Register, inspect, suspend.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>+</span> Diiwaan geli maqaayad · Add restaurant
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr .8fr .9fr 1fr 1.4fr', gap: 12, padding: '14px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
          <div>Restaurant</div><div>Owner</div><div>Plan</div><div>Orders</div><div>Status</div><div style={{ textAlign: 'right' }}>Actions</div>
        </div>
        {loading && <div style={{ padding: 20 }} className="text-muted">Loading…</div>}
        {!loading && list.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.4fr .8fr .9fr 1fr 1.4fr', gap: 12, padding: '15px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `hsl(${r.hue} 65% 95%)`, color: `hsl(${r.hue} 55% 42%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flex: '0 0 auto' }}>{initials(r.name)}</div>
              <div style={{ lineHeight: 1.25, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{r.city}</div>
              </div>
            </div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, color: 'var(--muted-5)' }}>{r.owner || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-3)' }} className="mono">@{r.username}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-4)' }}>{r.plan}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }} className="mono">{r.orders.toLocaleString()}</div>
            <div>
              <span className="pill" style={{ background: r.status === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)', color: r.status === 'active' ? 'var(--success)' : 'var(--danger)' }}>
                {r.status === 'active' ? 'Active' : 'Suspended'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-outline" onClick={() => openView(r.id)}>View</button>
              <button
                className={r.status === 'active' ? 'btn-danger-outline' : 'btn-outline'}
                style={r.status !== 'active' ? { color: 'var(--accent)' } : undefined}
                onClick={() => toggle(r)}
              >
                {r.status === 'active' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
        {!loading && list.length === 0 && <div style={{ padding: 24 }} className="text-muted">No restaurants yet.</div>}
      </div>

      {showAdd && (
        <AddRestaurantModal
          onClose={() => setShowAdd(false)}
          onCreated={(name) => {
            setShowAdd(false); load();
            addToast({ title: 'Maqaayadda waa la diiwaan geliyay · Restaurant created', body: name, tone: 'success' });
          }}
        />
      )}
      {viewing && <ViewRestaurantModal restaurant={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AddRestaurantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', city: '', ownerName: '', username: '', password: '', plan: 'Free' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/admin/restaurants', form);
      onCreated(form.name);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to create restaurant'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={460}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>Diiwaan geli maqaayad · Add restaurant</div>
        <label className="field-label">Magaca maqaayada · Restaurant name</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={form.name} onChange={set('name')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">Magaalada · City</label>
            <input className="field-input" style={{ marginBottom: 14 }} value={form.city} onChange={set('city')} />
          </div>
          <div>
            <label className="field-label">Mulkiilaha · Owner</label>
            <input className="field-input" style={{ marginBottom: 14 }} value={form.ownerName} onChange={set('ownerName')} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">Isticmaale · Username</label>
            <input className="field-input" style={{ marginBottom: 14 }} required value={form.username} onChange={set('username')} />
          </div>
          <div>
            <label className="field-label">Furaha sirta · Password</label>
            <input className="field-input" style={{ marginBottom: 14 }} required type="text" value={form.password} onChange={set('password')} />
          </div>
        </div>
        <label className="field-label">Qorshaha · Plan</label>
        <select className="field-input" style={{ marginBottom: 18 }} value={form.plan} onChange={set('plan')}>
          <option value="Free">Free</option>
          <option value="Basic">Basic</option>
          <option value="Pro">Pro</option>
        </select>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Diiwaan geli · Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ViewRestaurantModal({ restaurant, onClose }) {
  const r = restaurant;
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitReset(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setBusy(true);
    try {
      await api.patch(`/admin/restaurants/${r.id}/password`, { newPassword });
      setSuccess('Furaha waa la beddelay · Password updated.');
      setNewPassword('');
      setResetting(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to reset password'));
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} width={420}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: `hsl(${r.hue} 65% 95%)`, color: `hsl(${r.hue} 55% 42%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{initials(r.name)}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{r.city} · {r.plan}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-2)', fontWeight: 700 }}>Orders</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{r.orders}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-2)', fontWeight: 700 }}>Revenue</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{r.revenue}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted-4)', lineHeight: 1.9 }}>
        <div><b>Owner:</b> {r.owner || '—'}</div>
        <div><b>Username:</b> {r.username}</div>
        <div><b>Status:</b> {r.status}</div>
        <div><b>Joined:</b> {new Date(r.createdAt).toLocaleDateString()}</div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 16, paddingTop: 14 }}>
        {!resetting && (
          <button className="btn-outline" style={{ width: '100%' }} onClick={() => { setResetting(true); setSuccess(''); }}>
            🔑 Beddel furaha sirta · Reset password
          </button>
        )}
        {resetting && (
          <form onSubmit={submitReset}>
            <label className="field-label">Furaha cusub · New password</label>
            <input
              className="field-input" style={{ marginBottom: 12 }} type="text" required minLength={6}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ugu yaraan 6 xaraf · At least 6 characters"
            />
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={() => { setResetting(false); setError(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>{busy ? 'Saving…' : 'Keydi · Save'}</button>
            </div>
          </form>
        )}
        {success && <div style={{ color: 'var(--success)', fontSize: 13, marginTop: 10 }}>{success}</div>}
      </div>

      <div style={{ marginTop: 18, textAlign: 'right' }}>
        <button className="btn-outline" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
