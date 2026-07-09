export default function Sidebar({ header, eyebrow, navItems, activeId, onSelect, footer }) {
  return (
    <aside className="sidebar">
      {header}
      {eyebrow && <div className="sidebar-eyebrow">{eyebrow}</div>}
      {navItems.map((n) => (
        <button
          key={n.id}
          className={'nav-item' + (activeId === n.id ? ' active' : '')}
          onClick={() => onSelect(n.id)}
        >
          <span className="ic">{n.ic}</span>
          <span className="lines">
            <span>{n.en}</span>
            <small>{n.so}</small>
          </span>
        </button>
      ))}
      {footer && <div style={{ marginTop: 'auto' }}>{footer}</div>}
    </aside>
  );
}
