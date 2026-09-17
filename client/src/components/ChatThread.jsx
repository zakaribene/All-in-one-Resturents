import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

function timeLabel(d) {
  return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Maanta · Today';
  if (sameDay(date, yesterday)) return 'Shalay · Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// Shared message-list + composer, used by both the store's single-thread Support page
// and the admin Support Inbox's open-conversation pane. `selfSender` picks which side
// of `message.sender` renders as "mine" (right, accent bubble) vs the other party
// (left, panel bubble) — the only thing that differs between the two callers.
export default function ChatThread({ messages, selfSender, onSend, disabled, disabledHint, placeholder, emptyIcon, emptyTitle, emptyBody }) {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview('');
  }

  async function send() {
    const cleanText = text.trim();
    if (!cleanText && !imageFile) return;
    setSending(true);
    try {
      await onSend(cleanText, imageFile);
      setText('');
      clearImage();
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  let lastDay = null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!messages.length && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '30px 20px', color: 'var(--muted-2)' }}>
            {emptyIcon}
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--muted-4)', marginTop: 8 }}>{emptyTitle}</div>
            {emptyBody && <div style={{ fontSize: 12.5, marginTop: 4, maxWidth: 280 }}>{emptyBody}</div>}
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender === selfSender;
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const prev = messages[i - 1];
          const grouped = !showDay && prev && prev.sender === m.sender && (new Date(m.createdAt) - new Date(prev.createdAt)) < 3 * 60 * 1000;
          return (
            <div key={m.id}>
              {showDay && (
                <div style={{ textAlign: 'center', margin: '14px 0 10px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--muted-3)', background: 'var(--panel)',
                    padding: '4px 12px', borderRadius: 99,
                  }}>
                    {day}
                  </span>
                </div>
              )}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start',
                marginTop: grouped ? 2 : 12,
              }}>
                {!grouped && !mine && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted-3)', margin: '0 4px 3px' }}>{m.senderName}</div>
                )}
                <div style={{
                  maxWidth: '72%', padding: m.imageUrl && !m.text ? 4 : '9px 13px', borderRadius: 14,
                  borderTopRightRadius: mine && !grouped ? 4 : 14, borderTopLeftRadius: !mine && !grouped ? 4 : 14,
                  background: mine ? 'var(--accent)' : 'var(--panel)', color: mine ? '#fff' : 'var(--text)',
                }}>
                  {m.imageUrl && (
                    <a href={m.imageUrl} target="_blank" rel="noreferrer">
                      <img src={m.imageUrl} alt="" style={{ display: 'block', maxWidth: 260, maxHeight: 260, borderRadius: 10, objectFit: 'cover' }} />
                    </a>
                  )}
                  {m.text && <div style={{ fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', padding: m.imageUrl ? '7px 5px 2px' : 0 }}>{m.text}</div>}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--muted-3)', margin: '3px 4px 0' }}>{timeLabel(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border-soft)', padding: '12px 16px', flex: '0 0 auto' }}>
        {disabled ? (
          <div style={{ fontSize: 12.5, color: 'var(--muted-3)', textAlign: 'center', padding: '8px 0' }}>{disabledHint}</div>
        ) : (
          <>
            {imagePreview && (
              <div style={{ display: 'inline-flex', position: 'relative', marginBottom: 10 }}>
                <img src={imagePreview} alt="" style={{ height: 64, width: 64, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                <button
                  onClick={clearImage} title="Ka saar · Remove"
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 99, border: '2px solid var(--surface)',
                    background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  <X size={11} strokeWidth={3} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
              <button
                type="button" onClick={() => fileInputRef.current?.click()} title="Ku lifaaq sawir · Attach image"
                className="btn-outline" style={{ width: 40, height: 40, padding: 0, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Paperclip size={16} strokeWidth={2.25} />
              </button>
              <textarea
                value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
                placeholder={placeholder} rows={1}
                className="field-input" style={{ flex: 1, resize: 'none', maxHeight: 100, fontFamily: 'inherit' }}
              />
              <button
                type="button" onClick={send} disabled={sending || (!text.trim() && !imageFile)}
                className="btn btn-primary" style={{ width: 40, height: 40, padding: 0, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Send size={16} strokeWidth={2.25} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
