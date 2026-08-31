import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Power, UserPlus } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';
import { NAV_PAGES } from '../../lib/navPages';

export default function Staff() {
  const { addToast, confirm } = useOutletContext();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editStaff, setEditStaff] = useState(null);

  function load() {
    setLoading(true);
    api.get('/restaurant/staff').then((r) => setStaff(r.data)).catch((e) => setError(apiErrorMessage(e))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggle(s) {
    try {
      const { data } = await api.patch(`/restaurant/staff/${s.id}/toggle`);
      setStaff((prev) => prev.map((x) => (x.id === s.id ? data : x)));
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to update', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  async function remove(s) {
    const ok = await confirm({ title: `Tirtir "${s.name}" · Delete this staff account?`, tone: 'danger', confirmLabel: 'Tirtir · Delete' });
    if (!ok) return;
    try {
      await api.delete(`/restaurant/staff/${s.id}`);
      setStaff((prev) => prev.filter((x) => x.id !== s.id));
      addToast({ title: 'Shaqaalaha waa la tirtiray · Staff account deleted', tone: 'success' });
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed to delete', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24 }}>Shaqaalaha · Staff</h1>
          <p className="page-sub">Abuur akoonno shaqaale oo xadid boggaga ay arki karaan · Create staff accounts and limit which pages they can see.</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowAdd(true)}>
          <UserPlus size={15} strokeWidth={2.25} /> Shaqaale cusub · Add staff
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
      {loading && <div className="text-muted">Loading…</div>}

      {!loading && !staff.length && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🧑‍🍳</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Weli shaqaale ma jiraan · No staff accounts yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginBottom: 18 }}>
            Tusaale: abuur akoon "Waiter" oo kaliya ogolow POS · Example: create a "Waiter" account and only allow POS.
          </div>
          <button className="btn btn-primary" style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowAdd(true)}>
            <UserPlus size={15} strokeWidth={2.25} /> Shaqaale cusub · Add staff
          </button>
        </div>
      )}

      {!loading && !!staff.length && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 2.2fr .8fr 1fr', gap: 12, padding: '13px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: 'var(--muted-3)', textTransform: 'uppercase' }}>
            <div>Name</div><div>Role</div><div>Permissions</div><div>Status</div><div style={{ textAlign: 'right' }}>Action</div>
          </div>
          {staff.map((s) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 2.2fr .8fr 1fr', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', alignItems: 'center', fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted-3)' }}>@{s.username}</div>
              </div>
              <div style={{ color: 'var(--muted-5)' }}>{s.role}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {s.permissions.length
                  ? NAV_PAGES.filter((p) => s.permissions.includes(p.id)).map((p) => (
                    <span key={p.id} style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '3px 8px', borderRadius: 6 }}>
                      {p.en}
                    </span>
                  ))
                  : <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>No pages · Wax bogag ah lama siin</span>}
              </div>
              <div>
                <span style={{
                  background: s.status === 'active' ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: s.status === 'active' ? 'var(--success)' : 'var(--danger)',
                  fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 8,
                }}>
                  {s.status === 'active' ? '✓ Active' : '⏸ Suspended'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button title="Wax ka beddel · Edit" onClick={() => setEditStaff(s)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={13} strokeWidth={2.25} />
                </button>
                <button title={s.status === 'active' ? 'Suspend' : 'Activate'} onClick={() => toggle(s)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--warning-fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Power size={13} strokeWidth={2.25} />
                </button>
                <button title="Tirtir · Delete" onClick={() => remove(s)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={13} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <StaffModal
          title="Shaqaale cusub · Add staff"
          submitLabel="Ku dar · Add"
          onClose={() => setShowAdd(false)}
          onSubmit={(form) => api.post('/restaurant/staff', form)}
          onDone={(s) => {
            setStaff((prev) => [s, ...prev]); setShowAdd(false);
            addToast({ title: 'Shaqaalaha waa la daray · Staff account created', body: s.name, tone: 'success' });
          }}
        />
      )}
      {editStaff && (
        <StaffModal
          title="Wax ka beddel shaqaale · Edit staff"
          submitLabel="Keydi · Save"
          initial={{ name: editStaff.name, username: editStaff.username, role: editStaff.role, permissions: editStaff.permissions }}
          isEdit
          onClose={() => setEditStaff(null)}
          onSubmit={(form) => api.patch(`/restaurant/staff/${editStaff.id}`, form)}
          onDone={(s) => {
            setStaff((prev) => prev.map((x) => (x.id === s.id ? s : x))); setEditStaff(null);
            addToast({ title: 'Isbeddelka waa la keydiyay · Changes saved', body: s.name, tone: 'success' });
          }}
        />
      )}
    </div>
  );
}

function StaffModal({ title, submitLabel, initial, isEdit, onClose, onSubmit, onDone }) {
  const [name, setName] = useState(initial?.name || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initial?.role || 'Waiter');
  const [permissions, setPermissions] = useState(initial?.permissions || []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function togglePage(id) {
    setPermissions((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function submit(e) {
    e.preventDefault();
    if (!isEdit && (!password || password.length < 6)) { setError('Furaha sirta waa in uu ka badan yahay 6 xaraf · Password must be at least 6 characters'); return; }
    setBusy(true); setError('');
    try {
      const form = { name, username, role, permissions };
      if (password) form.password = password;
      const { data } = await onSubmit(form);
      onDone(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save staff account'));
    } finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} width={440}>
      <form onSubmit={submit}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>{title}</div>

        <label className="field-label">Magaca · Name</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={name} onChange={(e) => setName(e.target.value)} />

        <label className="field-label">Doorka · Role (label only, e.g. Waiter)</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={role} onChange={(e) => setRole(e.target.value)} />

        <label className="field-label">Isticmaale · Username</label>
        <input className="field-input" style={{ marginBottom: 14 }} required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />

        <label className="field-label">Furaha sirta · Password {isEdit && '(ka tag banaan si aan loo beddelin · leave blank to keep unchanged)'}</label>
        <input className="field-input" style={{ marginBottom: 14 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />

        <label className="field-label">Boggaga uu geli karo · Pages this staff account can access</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, border: '1px solid var(--border-soft)', borderRadius: 10, padding: 12 }}>
          {NAV_PAGES.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={permissions.includes(p.id)} onChange={() => togglePage(p.id)} />
              <p.icon size={13} strokeWidth={2.25} color="var(--muted-3)" />
              {p.en}
            </label>
          ))}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
