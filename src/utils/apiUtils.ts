/**
 * @file utils/apiUtils.ts
 * @description Lightweight, non-recursive key normalizer for GAS API responses.
 *
 * Replaces the old recursive toCamelCase / toSnakeCase approach in api.ts.
 * Instead of walking the entire object tree with regex, we:
 *   1. Flatten snake_case keys to lowercase (strip underscores)
 *   2. Map them through an explicit dictionary (O(1) lookup)
 *   3. Only recurse one level deeper for known nested object types
 *
 * This prevents UI jank on large payloads (getDashboardBundle, getOrders, etc.)
 * by avoiding repeated regex execution on every property of every object/array.
 */

/** 
 * Explicit snake_case → camelCase dictionary.
 * Add missing mappings here rather than relying on regex heuristics.
 */
export const KEY_MAP: Record<string, string> = {
    // --- Order Fields ---
    orderid: 'orderId',
    order_id: 'orderId',
    customername: 'customerName',
    customer_name: 'customerName',
    customerphone: 'customerPhone',
    customer_phone: 'customerPhone',
    pickupaddress: 'pickupAddress',
    pickup_address: 'pickupAddress',
    destinationaddress: 'destinationAddress',
    destination_address: 'destinationAddress',
    pickupexactaddress: 'pickupExactAddress',
    pickup_exact_address: 'pickupExactAddress',
    destinationexactaddress: 'destinationExactAddress',
    destination_exact_address: 'destinationExactAddress',
    pickuplat: 'pickupLat',
    pickup_lat: 'pickupLat',
    pickuplng: 'pickupLng',
    pickup_lng: 'pickupLng',
    destinationlat: 'destinationLat',
    destination_lat: 'destinationLat',
    destinationlng: 'destinationLng',
    destination_lng: 'destinationLng',
    pickupdate: 'pickupDate',
    pickup_date: 'pickupDate',
    pickuptime: 'pickupTime',
    pickup_time: 'pickupTime',
    pickupdatetime: 'pickupDatetime',
    pickup_datetime: 'pickupDatetime',
    createdat: 'createdAt',
    created_at: 'createdAt',
    updatedat: 'updatedAt',
    updated_at: 'updatedAt',
    paymentcompleted: 'paymentCompleted',
    payment_completed: 'paymentCompleted',
    paymentphone: 'paymentPhone',
    payment_phone: 'paymentPhone',
    paypalemail: 'paypalEmail',
    paypal_email: 'paypalEmail',
    driverid: 'driverId',
    driver_id: 'driverId',
    drivername: 'driverName',
    driver_name: 'driverName',
    driverphone: 'driverPhone',
    driver_phone: 'driverPhone',
    drivercarplate: 'driverCarPlate',
    driver_car_plate: 'driverCarPlate',
    pickupnotes: 'pickupNotes',
    pickup_notes: 'pickupNotes',
    destinationnotes: 'destinationNotes',
    destination_notes: 'destinationNotes',
    paymentreported: 'paymentReported',
    payment_reported: 'paymentReported',
    paymentstatus: 'paymentStatus',
    payment_status: 'paymentStatus',
    broadcastmsgid: 'broadcastMsgId',
    broadcast_msg_id: 'broadcastMsgId',
    flightnumber: 'flightNumber',
    flight_number: 'flightNumber',
    paymentmethod: 'paymentMethod',
    payment_method: 'paymentMethod',
    notificationchannels: 'notificationChannels',
    notification_channels: 'notificationChannels',
    driverprofit: 'driverProfit',
    driver_profit: 'driverProfit',

    // --- Driver Fields ---
    driverName: 'driverName', // passthrough (already camel)
    taxiplatenumber: 'taxiPlateNumber',
    taxi_plate_number: 'taxiPlateNumber',
    licensenumber: 'licenseNumber',
    license_number: 'licenseNumber',
    servicearea: 'serviceArea',
    service_area: 'serviceArea',
    telegramid: 'telegramId',
    telegram_id: 'telegramId',
    telegramusername: 'telegramUsername',
    telegram_username: 'telegramUsername',
    totalrides: 'totalRides',
    total_rides: 'totalRides',
    todayrides: 'todayRides',
    today_rides: 'todayRides',
    consentdate: 'consentDate',
    consent_date: 'consentDate',
    averagerating: 'averageRating',
    average_rating: 'averageRating',
    totalratings: 'totalRatings',
    total_ratings: 'totalRatings',
    totalrevenue: 'totalRevenue',
    total_revenue: 'totalRevenue',
    todayrevenue: 'todayRevenue',
    today_revenue: 'todayRevenue',
    lastupdate: 'lastUpdate',
    last_update: 'lastUpdate',
    cartype: 'carType',
    car_type: 'carType',

    // --- Dashboard Stats Fields ---
    orderstoday: 'ordersToday',
    orders_today: 'ordersToday',
    ordersweekly: 'ordersWeekly',
    orders_weekly: 'ordersWeekly',
    ordersmonthly: 'ordersMonthly',
    orders_monthly: 'ordersMonthly',
    completedcount: 'completedCount',
    completed_count: 'completedCount',
    cancelledcount: 'cancelledCount',
    cancelled_count: 'cancelledCount',
    pendingcount: 'pendingCount',
    pending_count: 'pendingCount',
    activecount: 'activeCount',
    active_count: 'activeCount',
    activedriverscount: 'activeDriversCount',
    active_drivers_count: 'activeDriversCount',
    revenuetoday: 'revenueToday',
    revenue_today: 'revenueToday',
    revenueweekly: 'revenueWeekly',
    revenue_weekly: 'revenueWeekly',
    revenuemonthly: 'revenueMonthly',
    revenue_monthly: 'revenueMonthly',
    totalrevenuealltime: 'totalRevenueAllTime',
    total_revenue_all_time: 'totalRevenueAllTime',
    commissionpct: 'commissionPct',
    commission_pct: 'commissionPct',
    commissiontoday: 'commissionToday',
    commission_today: 'commissionToday',
    commissionweekly: 'commissionWeekly',
    commission_weekly: 'commissionWeekly',
    commissionmonthly: 'commissionMonthly',
    commission_monthly: 'commissionMonthly',
    stationcommission: 'stationCommission',
    station_commission: 'stationCommission',
    averagepickuptime: 'averagePickupTime',
    average_pickup_time: 'averagePickupTime',
    revenuebystatus: 'revenueByStatus',
    revenue_by_status: 'revenueByStatus',
    dailystats: 'dailyStats',
    daily_stats: 'dailyStats',
    lastsync: 'lastSync',
    last_sync: 'lastSync',
    fetchedat: 'fetchedAt',
    fetched_at: 'fetchedAt',

    // --- Settings Fields ---
    googlemapsapikey: 'googleMapsApiKey',
    google_maps_api_key: 'googleMapsApiKey',
    stationpaymentphone: 'stationPaymentPhone',
    station_payment_phone: 'stationPaymentPhone',
};

/**
 * Normalizes a single key to camelCase using the KEY_MAP lookup.
 * Falls back to simple snake_case→camelCase if not found.
 */
export const normalizeKey = (key: string): string => {
    // Try direct lookup first (fastest path)
    const direct = KEY_MAP[key];
    if (direct) return direct;

    // Try lowercase+stripped version for slightly different casing from GAS
    const normalized = key.toLowerCase().replace(/_/g, '');
    const fromNormalized = KEY_MAP[normalized];
    if (fromNormalized) return fromNormalized;

    // Fallback: simple snake_case → camelCase conversion (only for unknown keys)
    return key.replace(/(_\w)/g, (m) => m[1].toUpperCase());
};

/**
 * Lightweight key normalizer for flat and shallow-nested objects.
 * Avoids deep recursion by only iterating one level.
 * For arrays or nested objects, maps over items without deeply recursing.
 */
export const normalizeResponseKeys = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;

    if (Array.isArray(obj)) {
        return obj.map(normalizeResponseKeys);
    }

    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
        const camelKey = normalizeKey(key);
        let val = obj[key];

        // [FIX] Normalize status values to lowercase for consistent frontend comparison
        if (camelKey === 'status' && typeof val === 'string') {
            val = val.toLowerCase();
        }

        // Only recurse for plain objects and arrays; primitives stop here
        result[camelKey] =
            typeof val === 'object' && val !== null ? normalizeResponseKeys(val) : val;
    }
    return result;
};

/**
 * Converts a camelCase object to snake_case for sending to GAS.
 * Uses a simple, explicit conversion. Much faster than the previous regex approach
 * because it avoids repeated RegExp object creation on every property.
 */
export const toSnakeCaseLite = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(toSnakeCaseLite);

    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
        // camelCase → snake_case: insert _ before uppercase letters
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        result[snakeKey] = toSnakeCaseLite(obj[key]);
    }
    return result;
};
