import { useEffect } from "react";

const DEFAULT_IDLE_LOCK_MS = 5 * 60 * 1000;

export function useIdleLock(
  enabled: boolean,
  onIdle: () => void,
  durationMs = DEFAULT_IDLE_LOCK_MS,
): void {
  useEffect(() => {
    if (!enabled) return;

    let timer = window.setTimeout(onIdle, durationMs);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, durationMs);
    };
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    for (const eventName of events) {
      window.addEventListener(eventName, reset, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const eventName of events) {
        window.removeEventListener(eventName, reset);
      }
    };
  }, [durationMs, enabled, onIdle]);
}
