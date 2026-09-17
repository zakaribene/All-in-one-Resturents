import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Headset, Search, Settings, ShieldAlert, Store, ExternalLink } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useOutsideClick } from '../../lib/useOutsideClick';
import ChatThread from '../../components/ChatThread';

const STATUS_META = {
  active: { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success)' },
  grace: { label: 'Grace', bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
  expired: { label: 'Expired', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function timeAgo(d) {
  if (!d) return '';
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return mins + 'm';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h';
  return Math.round(hrs / 24) + 'd';
}

function Avatar({ name, hue, logoUrl, size = 42 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32, flex: '0 0 auto', overflow: 'hidden',
      background: `hsl(${hue ?? 212} 65% 93%)`, color: `hsl(${hue ?? 212} 55% 40%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.36,
    }}>
      {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
    </div>
  );
}

export default function SupportInbox() {
  const { addToast, setSupportUnread } = useOutletContext();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null); // { restaurant, messages } for the open conversation
  const [threadLoading, setThreadLoading] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  function loadConversations() {
    api.get('/admin/support/conversations')
      .then((r) => setConversations(r.data))
      .catch((e) => setError(apiErrorMessage(e)));
  }
  useEffect(loadConversations, []);

  function openConversation(id) {
    setSelectedId(id);
    setThread(null);
    setThreadLoading(true);
    api.get(`/admin/support/conversations/${id}/messages`)
      .then((r) => {
        setThread(r.data);
        // That store's unread messages are now marked read server-side — zero it
        // locally (list row + the shared sidebar badge in AdminLayout) to match.
        setConversations((prev) => prev?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)) || prev);
        setSupportUnread?.((n) => {
          const row = conversations?.find((c) => c.id === id);
          return Math.max(0, n - (row?.unreadCount || 0));
        });
      })
      .catch((e) => addToast({ title: 'Lama soo gelin karin · Failed to load', body: apiErrorMessage(e), tone: 'error' }))
      .finally(() => setThreadLoading(false));
  }

  // Live updates: a new message bumps the matching row to the top and, if that thread
  // is the one currently open, appends it straight into the pane and (fire-and-forget)
  // re-marks the thread read so the count doesn't drift stale in the DB.
  useEffect(() => {
    const socket = getSocket();
    function onMessage({ restaurantId, restaurantName, message }) {
      setConversations((prev) => {
        if (!prev) return prev;
        const isOpen = selectedIdRef.current === restaurantId;
        const existing = prev.find((c) => c.id === restaurantId);
        const bump = {
          lastMessage: message.text || (message.imageUrl ? '📷 Photo' : ''),
          lastMessageAt: message.createdAt, lastSender: message.sender,
          unreadCount: message.sender === 'restaurant' && !isOpen ? (existing?.unreadCount || 0) + 1 : (existing?.unreadCount || 0),
        };
        if (!existing) {
          loadConversations(); // a store we don't have cached yet (rare) — just resync
          return prev;
        }
        return prev.map((c) => (c.id === restaurantId ? { ...c, ...bump } : c)).sort((a, b) => {
          if (!!b.unreadCount !== !!a.unreadCount) return (b.unreadCount ? 1 : 0) - (a.unreadCount ? 1 : 0);
          return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
        });
      });
      if (selectedIdRef.current === restaurantId) {
        // The server echoes every message (including this admin's own sends) back
        // over the socket — a message we just appended ourselves via the POST
        // response in handleSend arrives here a second time, so dedupe by id.
        setThread((prev) => (
          prev && !prev.messages.some((m) => m.id === message.id) ? { ...prev, messages: [...prev.messages, message] } : prev
        ));
        if (message.sender === 'restaurant') api.get(`/admin/support/conversations/${restaurantId}/messages`).catch(() => {});
      } else if (message.sender === 'restaurant') {
        setSupportUnread?.((n) => n + 1);
        addToast({ title: restaurantName, body: message.text || '📷 Photo' });
      }
    }
    socket.on('support:message', onMessage);
    return () => socket.off('support:message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(text, imageFile) {
    if (!selectedId) return;
    const fd = new FormData();
    if (text) fd.append('text', text);
    if (imageFile) fd.append('image', imageFile);
    try {
      const { data } = await api.post(`/admin/support/conversations/${selectedId}/messages`, fd);
      // Guarded the same way as the socket handler above — the two race, whichever lands second is a no-op.
      setThread((prev) => (
        prev && !prev.messages.some((m) => m.id === data.id) ? { ...prev, messages: [...prev.messages, data] } : prev
      ));
      setConversations((prev) => prev?.map((c) => (
        c.id === selectedId ? { ...c, lastMessage: data.text || (data.imageUrl ? '📷 Photo' : ''), lastMessageAt: data.createdAt, lastSender: 'admin' } : c
      )));
    } catch (err) {
      addToast({ title: 'Fariinta lama dirin · Message failed', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  const filtered = useMemo(() => {
    if (!conversations) return [];
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.name.toLowerCase().includes(q) || (c.owner || '').toLowerCase().includes(q));
  }, [conversations, search]);

  const selectedRow = conversations?.find((c) => c.id === selectedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 18, flex: '0 0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Sanduuqa Taageerada · Support Inbox</h1>
          <p className="page-sub">Wada-sheekaysi maqaayadaha shidan Support-ka · Chat with every store that has Support enabled.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn-outline" onClick={() => setRetentionOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={14} strokeWidth={2.25} /> Retention
          </button>
          {retentionOpen && <RetentionPanel onClose={() => setRetentionOpen(false)} addToast={addToast} />}
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{
        flex: 1, minHeight: 0, height: 'calc(100vh - 230px)', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr minmax(240px, 280px)',
      }}>
        {/* ---- Conversation list ---- */}
        <div style={{ borderRight: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--border-soft)', flex: '0 0 auto' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} strokeWidth={2.25} color="var(--muted-3)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="field-input" style={{ paddingLeft: 32 }} placeholder="Raadi maqaayad… · Search stores…"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {!conversations && <div className="text-muted" style={{ padding: 16, fontSize: 13 }}>Loading…</div>}
            {conversations && !filtered.length && (
              <div style={{ padding: '30px 16px', textAlign: 'center' }}>
                <Headset size={26} strokeWidth={1.6} color="var(--muted-3)" style={{ marginBottom: 8 }} />
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {conversations.length ? 'Wax lama helin · No matches' : 'Weli ma jirto maqaayad Support u shidan · No store has Support enabled yet'}
                </div>
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id} onClick={() => openConversation(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '12px 14px',
                  border: 'none', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer', fontFamily: 'inherit',
                  background: selectedId === c.id ? 'var(--panel)' : 'transparent',
                }}
              >
                <Avatar name={c.name} hue={c.hue} logoUrl={c.logoUrl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--muted-3)', flex: '0 0 auto' }}>{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 12, color: 'var(--muted-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: c.unreadCount ? 700 : 400,
                    }}>
                      {c.lastSender === 'admin' && <span style={{ color: 'var(--muted-3)' }}>You: </span>}
                      {c.lastMessage || 'Weli wax fariin ah lama dirin · No messages yet'}
                    </span>
                    {c.unreadCount > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: 'var(--danger)', color: '#fff',
                        fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
                      }}>
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Open thread ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!selectedId && (
            <div style={{ margin: 'auto', textAlign: 'center', padding: 30, color: 'var(--muted-2)' }}>
              <Headset size={30} strokeWidth={1.6} color="var(--muted-3)" />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--muted-4)', marginTop: 10 }}>Dooro maqaayad · Select a conversation</div>
            </div>
          )}
          {selectedId && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--border-soft)', flex: '0 0 auto' }}>
                <Avatar name={selectedRow?.name} hue={selectedRow?.hue} logoUrl={selectedRow?.logoUrl} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedRow?.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-3)' }}>{selectedRow?.owner || '—'}</div>
                </div>
              </div>
              {threadLoading && <div className="text-muted" style={{ padding: 20 }}>Loading…</div>}
              {thread && !threadLoading && (
                <ChatThread
                  messages={thread.messages}
                  selfSender="admin"
                  onSend={handleSend}
                  placeholder="Qor jawaab… · Type a reply…"
                  emptyIcon={<Headset size={28} strokeWidth={1.6} color="var(--muted-3)" />}
                  emptyTitle="Weli fariin ma jirto · No messages yet"
                  emptyBody="Bilow wada-hadal — u dir fariinta ugu horreysa · Start the conversation by sending the first message."
                />
              )}
            </>
          )}
        </div>

        {/* ---- Store details ---- */}
        <div style={{ borderLeft: '1px solid var(--border-soft)', padding: 18, overflowY: 'auto' }}>
          {!thread && <div className="text-muted" style={{ fontSize: 13 }}>—</div>}
          {thread && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <Avatar name={thread.restaurant.name} hue={thread.restaurant.hue} logoUrl={thread.restaurant.logoUrl} size={56} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{thread.restaurant.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{thread.restaurant.owner || '—'}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <span className="pill" style={{ background: STATUS_META[thread.restaurant.subscriptionStatus]?.bg, color: STATUS_META[thread.restaurant.subscriptionStatus]?.fg, fontWeight: 800 }}>
                  {STATUS_META[thread.restaurant.subscriptionStatus]?.label || thread.restaurant.subscriptionStatus}
                </span>
                {thread.restaurant.status === 'suspended' && (
                  <span className="pill" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShieldAlert size={11} strokeWidth={2.5} /> Suspended
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12.5, color: 'var(--muted-4)', lineHeight: 2, marginBottom: 18 }}>
                <div><b>Username:</b> @{thread.restaurant.username}</div>
                <div><b>City:</b> {thread.restaurant.city || '—'}</div>
                <div><b>Plan:</b> {thread.restaurant.plan}</div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  className="btn-outline" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => navigate('/admin/subscriptions', { state: { restaurantId: thread.restaurant.id } })}
                >
                  <ExternalLink size={13} strokeWidth={2.25} /> Subscription
                </button>
                <button
                  className="btn-outline" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => navigate('/admin/restaurants')}
                >
                  <Store size={13} strokeWidth={2.25} /> View store
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RetentionPanel({ onClose, addToast }) {
  const panelRef = useRef(null);
  useOutsideClick(panelRef, onClose);
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/admin/settings/support-retention')
      .then((r) => { setEnabled(r.data.enabled); setDays(r.data.days); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const { data } = await api.patch('/admin/settings/support-retention', { enabled, days: Number(days) || 30 });
      setEnabled(data.enabled); setDays(data.days);
      addToast({ title: 'Retention policy waa la keydiyay · Saved', tone: 'success' });
      onClose();
    } catch (err) {
      addToast({ title: 'Way fashilantay · Failed', body: apiErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={panelRef} className="dropdown-panel" style={{ width: 300, padding: 18, right: 0 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>Message retention</div>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted-2)' }}>
        Fariimaha Support-ka · Applies to every store's Support conversation.
      </p>
      {!loading && (
        <>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 12.5 }}>
              <span style={{ fontWeight: 700 }}>Auto-delete old messages</span>
              <div style={{ color: 'var(--muted-2)', marginTop: 2 }}>Off by default · Damban ayay tahay</div>
            </span>
          </label>
          <label className="field-label">Retention (days)</label>
          <input className="field-input" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} style={{ marginBottom: 14 }} />
          {enabled && (
            <div style={{ fontSize: 11.5, color: 'var(--warning-fg, #B45309)', marginBottom: 14 }}>
              🗑 Fariimaha ka da'an {Number(days) || 0} maalmood si joogto ah ayaa loo tirtiri doonaa.
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    </div>
  );
}
