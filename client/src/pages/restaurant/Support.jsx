import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Headset, LifeBuoy } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import ChatThread from '../../components/ChatThread';

export default function Support() {
  const { addToast } = useOutletContext();
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/restaurant/support/messages')
      .then((r) => setMessages(r.data))
      .catch((e) => setError(apiErrorMessage(e)));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    // The server echoes every message (including this store's own sends) back over
    // the socket, so a message we just added ourselves via the POST response below
    // arrives here a second time — skip it by id instead of appending blindly.
    function onMessage({ message }) {
      setMessages((prev) => (prev && !prev.some((m) => m.id === message.id) ? [...prev, message] : prev));
    }
    socket.on('support:message', onMessage);
    return () => socket.off('support:message', onMessage);
  }, []);

  async function handleSend(text, imageFile) {
    const fd = new FormData();
    if (text) fd.append('text', text);
    if (imageFile) fd.append('image', imageFile);
    try {
      const { data } = await api.post('/restaurant/support/messages', fd);
      // Guarded the same way as the socket handler above — the two race, whichever
      // lands second is a no-op.
      setMessages((prev) => (prev && !prev.some((m) => m.id === data.id) ? [...prev, data] : prev));
    } catch (err) {
      addToast({ title: 'Fariinta lama dirin · Message failed', body: apiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 18, flex: '0 0 auto' }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>Taageero · Support</h1>
        <p className="page-sub">
          U dir fariin toos ah ee maamulka platform-ka · Message platform support directly and get help fast.
        </p>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', minHeight: 480, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', flex: '0 0 auto' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, background: 'color-mix(in srgb, var(--accent) 14%, var(--surface))',
            color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
          }}>
            <Headset size={18} strokeWidth={2.25} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Miis Support</div>
            <div style={{ fontSize: 11.5, color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--success)' }} /> Waa la jawaabi doonaa dhawaan · Typically replies quickly
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', padding: '12px 20px' }}>{error}</div>}
        {!messages && !error && <div className="text-muted" style={{ padding: '12px 20px' }}>Loading…</div>}

        {messages && (
          <ChatThread
            messages={messages}
            selfSender="restaurant"
            onSend={handleSend}
            placeholder="Qor fariintaada… · Type a message…"
            emptyIcon={<LifeBuoy size={30} strokeWidth={1.6} color="var(--muted-3)" />}
            emptyTitle="Weli fariin ma dirin · No messages yet"
            emptyBody="Haddii aad dhibaato la kulanto ama su'aal qabto, halkan naga soo dir · If you run into a problem or have a question, send it here and platform support will get back to you."
          />
        )}
      </div>
    </div>
  );
}
