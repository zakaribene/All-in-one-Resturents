import { useEffect } from 'react';

export default function Sidebar({ header, eyebrow, navItems, activeId, onSelect, footer, open = false, onClose }) {
  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close the drawer on Escape.
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function select(id) {
    onSelect(id);
    onClose?.();
  }

  return (
    <>
      <div
        className={'sidebar-backdrop' + (open ? ' is-open' : '')}
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <aside className={'sidebar' + (open ? ' is-open' : '')}>
        {header}
        {eyebrow && <div className="sidebar-eyebrow">{eyebrow}</div>}
        {navItems.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              className={'nav-item' + (activeId === n.id ? ' active' : '')}
              onClick={() => select(n.id)}
            >
              <span className="ic"><Icon size={16} strokeWidth={2.25} /></span>
              <span className="lines">
                <span>{n.en}</span>
                <small>{n.so}</small>
              </span>
            </button>
          );
        })}
        {footer && <div style={{ marginTop: 'auto' }}>{footer}</div>}
      </aside>
    </>
  );
}
