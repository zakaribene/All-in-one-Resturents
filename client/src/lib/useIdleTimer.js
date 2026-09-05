import { useEffect, useRef } from 'react';

// Fires `onIdle` after `timeoutMs` with no user activity. Activity is tracked
// with a cheap timestamp + a short poll, so constant mousemove/scroll doesn't
// churn a timer. Pass `enabled: false` to pause tracking (e.g. before `me` loads).
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

export function useIdleTimer(timeoutMs, onIdle, enabled = true) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return undefined;

    let last = Date.now();
    let fired = false;
    const mark = () => { last = Date.now(); fired = false; };

    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, mark, { passive: true });

    const poll = setInterval(() => {
      if (fired) return;
      if (Date.now() - last >= timeoutMs) {
        fired = true;
        onIdleRef.current();
      }
    }, 5000);

    return () => {
      clearInterval(poll);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, mark);
    };
  }, [timeoutMs, enabled]);
}
