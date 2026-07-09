export default function Modal({ onClose, children, width = 440 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(14,26,43,.45)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: width, maxHeight: '86vh', overflow: 'auto', padding: 26, boxShadow: '0 30px 70px -30px rgba(16,26,43,.5)' }}
      >
        {children}
      </div>
    </div>
  );
}
