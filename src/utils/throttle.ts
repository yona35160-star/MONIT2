/** Leading+trailing throttle for high-frequency callbacks (GPS, scroll, etc.). */
export function throttle<T extends (...args: any[]) => void>(fn: T, waitMs: number): T & { cancel: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = (args: Parameters<T>) => {
    last = Date.now();
    fn(...args);
  };

  const wrapped = ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);
    lastArgs = args;
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      invoke(args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs) invoke(lastArgs);
      }, remaining);
    }
  }) as T & { cancel: () => void };

  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return wrapped;
}
