import { Bell, CheckCircle2, XCircle } from 'lucide-react';

const TONE = {
  success: { Icon: CheckCircle2, bg: 'var(--success-bg)', fg: 'var(--success)' },
  error: { Icon: XCircle, bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  info: { Icon: Bell, bg: 'color-mix(in srgb, var(--accent) 12%, var(--surface))', fg: 'var(--accent)' },
};

export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => {
        const tone = TONE[t.tone] || TONE.info;
        const Icon = tone.Icon;
        return (
          <div className="toast" key={t.id}>
            <div className="toast-icon" style={{ background: tone.bg, color: tone.fg }}><Icon size={18} strokeWidth={2.25} /></div>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{t.title}</div>
              {t.body && <div style={{ fontSize: 13, color: 'var(--muted-4)' }}>{t.body}</div>}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              style={{ border: 'none', background: 'transparent', color: 'var(--muted-3)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 2 }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
