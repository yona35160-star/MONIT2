/**
 * Client-side performance helpers: location gates, throttles, and
 * safe cleanup for dynamically imported Firebase listeners.
 */

export const LOCATION_MIN_INTERVAL_MS = 8000;
export const LOCATION_MIN_DISTANCE_M = 35;
export const LOCATION_FORCE_DISTANCE_M = 80;
export const MAP_UI_MIN_INTERVAL_MS = 1500;
export const MAP_UI_MIN_DISTANCE_M = 12;

export type LatLng = { lat: number; lng: number };

export const haversineMeters = (a: LatLng, b: LatLng): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export type LocationGateOptions = {
    minIntervalMs?: number;
    minDistanceM?: number;
    forceDistanceM?: number;
};

/**
 * Skip GPS jitter / high-frequency pings. Always allows the first sample.
 * Significant moves (>= forceDistanceM) publish immediately.
 */
export const shouldPublishLocation = (
    prev: (LatLng & { t?: number }) | null | undefined,
    next: LatLng,
    opts: LocationGateOptions = {}
): boolean => {
    if (!next || !Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return false;
    if (!prev || !Number.isFinite(prev.lat) || !Number.isFinite(prev.lng)) return true;

    const minIntervalMs = opts.minIntervalMs ?? LOCATION_MIN_INTERVAL_MS;
    const minDistanceM = opts.minDistanceM ?? LOCATION_MIN_DISTANCE_M;
    const forceDistanceM = opts.forceDistanceM ?? LOCATION_FORCE_DISTANCE_M;
    const dist = haversineMeters(prev, next);
    if (dist >= forceDistanceM) return true;

    const elapsed = Date.now() - (prev.t ?? 0);
    if (dist < minDistanceM && elapsed < minIntervalMs) return false;
    if (elapsed < minIntervalMs && dist < forceDistanceM) return false;
    return true;
};

/** Leading + trailing throttle that always delivers the latest value. */
export const createLatestThrottler = <T>(fn: (value: T) => void, waitMs: number) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: T | undefined;
    let hasPending = false;

    const flushPending = () => {
        timer = null;
        if (!hasPending) return;
        const value = pending as T;
        hasPending = false;
        fn(value);
        timer = setTimeout(flushPending, waitMs);
    };

    return {
        push(value: T) {
            if (!timer) {
                fn(value);
                timer = setTimeout(flushPending, waitMs);
                return;
            }
            pending = value;
            hasPending = true;
        },
        flush() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            if (hasPending) {
                const value = pending as T;
                hasPending = false;
                fn(value);
            }
        }
    };
};

/**
 * Ensures a Firebase unsubscribe from a dynamic import still runs
 * if the component unmounts before the import resolves.
 */
export const createDeferredCleanup = () => {
    let cleaned = false;
    const fns: Array<() => void> = [];
    return {
        attach(unsubscribe: () => void) {
            if (cleaned) unsubscribe();
            else fns.push(unsubscribe);
        },
        flush() {
            cleaned = true;
            while (fns.length) {
                fns.pop()?.();
            }
        }
    };
};

const lastWriteByKey = new Map<string, { lat: number; lng: number; t: number }>();

/** Module-level gate for Firebase / GAS location writes. */
export const allowLocationWrite = (key: string, lat: number, lng: number, opts?: LocationGateOptions): boolean => {
    const prev = lastWriteByKey.get(key);
    if (!shouldPublishLocation(prev, { lat, lng }, opts)) return false;
    lastWriteByKey.set(key, { lat, lng, t: Date.now() });
    return true;
};
