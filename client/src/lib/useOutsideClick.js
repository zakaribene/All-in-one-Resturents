import { useEffect } from 'react';

export function useOutsideClick(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    function handlePointer(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    function handleKey(e) {
      if (e.key === 'Escape') onOutside();
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onOutside, active]);
}
