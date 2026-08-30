import { useCallback, useRef, useState } from 'react';
import { Trash2, TriangleAlert } from 'lucide-react';
import Modal from './Modal';

export function useConfirm() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setState(typeof opts === 'string' ? { message: opts } : opts);
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  function settle(result) {
    setState(null);
    resolver.current?.(result);
    resolver.current = null;
  }

  const confirmNode = state ? (
    <Modal onClose={() => settle(false)} width={380}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 12, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            background: state.tone === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)',
            color: state.tone === 'danger' ? 'var(--danger)' : 'var(--warning-fg)',
          }}
        >
          {state.tone === 'danger' ? <Trash2 size={19} strokeWidth={2.25} /> : <TriangleAlert size={19} strokeWidth={2.25} />}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{state.title || 'Ma hubtaa? · Are you sure?'}</div>
          {state.message && <div style={{ fontSize: 13.5, color: 'var(--muted-1)', lineHeight: 1.5 }}>{state.message}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-outline" onClick={() => settle(false)}>
          {state.cancelLabel || 'Cancel · Jooji'}
        </button>
        <button
          type="button"
          className="btn"
          style={{
            background: state.tone === 'danger' ? 'var(--danger)' : 'var(--accent)', color: '#fff',
            padding: '11px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14,
          }}
          onClick={() => settle(true)}
        >
          {state.confirmLabel || 'Xaqiiji · Confirm'}
        </button>
      </div>
    </Modal>
  ) : null;

  return { confirm, confirmNode };
}
