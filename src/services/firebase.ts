import { db } from '../firebase-config';
import { ref, onValue, off, set, update, get, DataSnapshot, query, limitToLast, orderByChild, startAt, endAt } from "firebase/database";
import { Order, Driver } from '../types';
import { toCamelCase } from '../api/api';

/**
 * Listen to a specific order updates in real-time
 * @param orderId ID of the order to listen to
 * @param callback Function to call with updated order data (or null if not exists)
 * @returns Unsubscribe function
 */
export const listenToOrder = (orderId: string, callback: (data: Order | null) => void) => {
    if (!orderId) return () => { };

    // [FIX] Sanitize ID – remove TAXI- prefix if present to match backend keys
    const cleanId = String(orderId).trim().toUpperCase().replace(/^TAXI-/, '');
    const orderRef = ref(db, `active_orders/${cleanId}`);

    // Listener
    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        // Convert to CamelCase
        if (val) {
            const normalized = toCamelCase(val);
            callback(normalized);
        } else {
            callback(null);
        }
    };

    onValue(orderRef, listener);

    // Unsubscribe function
    return () => off(orderRef, 'value', listener);
};

/**
 * Listen to the list of Active Orders (for Dashboard and Drivers)
 * [OPTIMIZATION] Using limitToLast to prevent fetching gigabytes of historical active data if backend fails to purge.
 */
export const listenToActiveOrders = (callback: (orders: Order[]) => void) => {
    const activeQuery = query(ref(db, 'active_orders'), limitToLast(200));

    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (!val) {
            // [FIX BUG-005] Clear the orders list when Firebase is empty.
            // Previously this silently returned, leaving stale orders on screen
            // after all active orders expired or were removed.
            callback([]);
            return;
        }
        // Convert object to array and Normalize Keys with robust filtering
        const orders = Object.values(val)
            .map(o => toCamelCase(o))
            .filter((o: any) => o && typeof o === 'object' && o.orderId) as Order[]; // [FIX] Filter out garbage/partial data
        callback(orders);
    };

    onValue(activeQuery, listener);
    return () => off(activeQuery, 'value', listener);
};

/**
 * Listen to Driver status (for Dashboard Map)
 */
export const listenToDrivers = (callback: (drivers: Driver[]) => void) => {
    const driversRef = ref(db, 'drivers');

    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (!val) {
            callback([]);
            return;
        }
        // Convert object to array and Normalize Keys
        const drivers = Object.values(val).map(d => toCamelCase(d)) as Driver[];
        callback(drivers);
    };

    onValue(driversRef, listener);
    return () => off(driversRef, 'value', listener);
};

/**
 * Fetch a single snapshot of an order
 */
export const getOrderSnapshot = async (orderId: string): Promise<Order | null> => {
    try {
        const cleanId = String(orderId).trim().toUpperCase().replace(/^TAXI-/, '');
        const snapshot = await get(ref(db, `active_orders/${cleanId}`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (e) {
        console.error("Firebase Read Error:", e);
        return null;
    }
};

/**
 * Direct update to Firebase (used for Driver Location throttling)
 */
export const updateDriverLocationDirect = async (driverId: string, lat: number, lng: number) => {
    if (!driverId) return;
    const updates: any = {};
    updates[`drivers/${driverId}/location`] = {
        lat,
        lng,
        updated_at: new Date().toISOString()
    };
    updates[`drivers/${driverId}/lat`] = lat;
    updates[`drivers/${driverId}/lng`] = lng;

    try {
        await update(ref(db), updates);
    } catch (e) {
        console.error("Loc Update Fail:", e);
    }
};
/**
 * Listen to System Health (Bridge Status)
 */
export const listenToSystemHealth = (callback: (status: { online: boolean, last_heartbeat?: string }) => void) => {
    const healthRef = ref(db, 'system/health');

    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (val) {
            callback(val);
        } else {
            callback({ online: false });
        }
    };

    onValue(healthRef, listener);
    return () => off(healthRef, 'value', listener);
};

/**
 * Listen to Driver Notifications
 */
export const listenToNotifications = (driverId: string, callback: (notifications: any[]) => void) => {
    if (!driverId) return () => { };
    const notifRef = ref(db, `notifications/${driverId}`);

    // Listen to changes (using onValue for simplicity)
    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (!val) {
            callback([]);
            return;
        }
        // Convert to array
        const list = Object.entries(val).map(([key, v]: [string, any]) => ({
            id: key,
            ...toCamelCase(v)
        })).sort((a: any, b: any) => b.createdAt - a.createdAt); // Newest first

        callback(list);
    };

    onValue(notifRef, listener);
    return () => off(notifRef, 'value', listener);
};

/**
 * Listen to Connection Status (.info/connected)
 */
export const listenToConnectionStatus = (callback: (connected: boolean) => void) => {
    const connectedRef = ref(db, '.info/connected');
    const listener = (snap: DataSnapshot) => {
        const connected = !!snap.val();
        callback(connected);
    };
    onValue(connectedRef, listener);
    return () => off(connectedRef, 'value', listener);
};

/**
 * Update Driver Location on the specific Order (for Customer Tracking)
 * AND on the drivers/ path (for Admin Dashboard Live Map)
 * [FIX] BUG #6/#7: Dual-write so both customer tracking and admin map get updates
 */
/**
 * Update Driver Online Status and Heartbeat
 * [GETT-Level Quality] Essential for background tracking visibility
 */
export const updateDriverStatus = async (driverId: string, isOnline: boolean, location?: { lat: number, lng: number }) => {
    if (!driverId) return;
    const updates: any = {};
    updates[`drivers/${driverId}/online`] = isOnline;
    updates[`drivers/${driverId}/last_heartbeat`] = Date.now();

    if (location) {
        updates[`drivers/${driverId}/location`] = {
            ...location,
            timestamp: Date.now()
        };
        updates[`drivers/${driverId}/lat`] = location.lat;
        updates[`drivers/${driverId}/lng`] = location.lng;
    }

    try {
        await update(ref(db), updates);
    } catch (e) {
        console.error("Heartbeat Fail:", e);
    }
};

export const updateOrderDriverLocation = async (orderId: string, location: { lat: number; lng: number; heading?: number }, driverId?: string) => {
    if (!orderId) return;
    try {
        // Remove TAXI- prefix if present
        const cleanId = String(orderId).toUpperCase().replace(/^TAXI-/, '');
        const locPayload = {
            ...location,
            timestamp: Date.now()
        };

        // 1. Write to active_orders/{id}/driver_location (Customer Tracking)
        const orderLocRef = ref(db, `active_orders/${cleanId}/driver_location`);
        await update(orderLocRef, locPayload);

        // 2. Also write to drivers/{driverId}/ (Admin Dashboard LiveMap)
        if (driverId) {
            const driverUpdates: any = {};
            driverUpdates[`drivers/${driverId}/location`] = locPayload;
            driverUpdates[`drivers/${driverId}/lat`] = location.lat;
            driverUpdates[`drivers/${driverId}/lng`] = location.lng;
            await update(ref(db), driverUpdates);
        }
    } catch (e) {
        console.error("Order Loc Update Fail:", e);
    }
};
/**
 * Listen to real-time message exchange logs for a specific order
 */
export const listenToOrderMessages = (orderId: string, callback: (messages: Record<string, any>) => void) => {
    if (!orderId) return () => { };
    const messagesRef = ref(db, `order_messages/${orderId}`);

    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        callback(val || {});
    };

    onValue(messagesRef, listener);
    return () => off(messagesRef, 'value', listener);
};
/**
 * Listen to all recent order message statuses
 */
export const listenToAllOrderMessages = (callback: (messages: Record<string, any>) => void) => {
    // [FIX IMP-007] Added limitToLast(50) to prevent reading unbounded data.
    // As orders accumulate, this node would grow to MBs without this limit.
    const messagesRef = query(ref(db, 'order_messages'), limitToLast(50));

    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        callback(val || {});
    };

    onValue(messagesRef, listener);
    return () => off(messagesRef, 'value', listener);
};

/**
 * Listen to global system statistics (Revenue, Counts)
 */
export const listenToStats = (callback: (stats: any) => void) => {
    const statsRef = ref(db, 'system/stats');
    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (val) callback(val);
    };
    onValue(statsRef, listener);
    return () => off(statsRef, 'value', listener);
};

/**
 * Listen to system settings (public ones)
 */
export const listenToSettings = (callback: (settings: any) => void) => {
    const settingsRef = ref(db, 'settings');
    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (val) callback(val);
    };
    onValue(settingsRef, listener);
    return () => off(settingsRef, 'value', listener);
};

/**
 * Listen to pending/broadcasted rides for driver queue
 */
export const listenToPendingRides = (callback: (rides: any[]) => void) => {
    const ordersRef = query(ref(db, 'active_orders'), limitToLast(80));
    
    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (val) {
            const rides = Object.values(val).filter((r: any) => {
                const s = String(r.status || '').toLowerCase();
                return s === 'pending' || s === 'broadcasted';
            });
            callback(rides);
        } else {
            callback([]);
        }
    };
    
    onValue(ordersRef, listener);
    return () => off(ordersRef, 'value', listener);
};

/**
 * Listen to the current active ride for a specific driver
 * Used for auto-redirecting to the ride management view
 */
export const listenToActiveRideForDriver = (driverPhone: string, callback: (order: Order | null) => void) => {
    if (!driverPhone) return () => { };
    
    // We listen to all active orders and filter locally for simplicity and speed
    // as the active_orders list is small (limit 200)
    const activeQuery = query(ref(db, 'active_orders'), limitToLast(100));
    
    const listener = (snapshot: DataSnapshot) => {
        const val = snapshot.val();
        if (!val) {
            callback(null);
            return;
        }
        
        const orders = Object.values(val) as any[];
        const activeRide = orders.find(o => 
            String(o.driverPhone || '').trim() === String(driverPhone).trim() && 
            ['assigned', 'confirmed', 'on_route', 'arrived', 'in_progress', 'waiting_approval'].includes(o.status)
        );
        
        callback(activeRide ? toCamelCase(activeRide) : null);
    };
    
    onValue(activeQuery, listener);
    return () => off(activeQuery, 'value', listener);
};
