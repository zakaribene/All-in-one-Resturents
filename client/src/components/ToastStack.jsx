export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <div className="toast-icon">🔔</div>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{t.title}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-4)' }}>{t.body}</div>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            style={{ border: 'none', background: 'transparent', color: 'var(--muted-3)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
