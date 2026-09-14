/**
 * Configuration Module
 * Contains all constants, enums, message templates, and state machine logic
 * 
 * Dependencies: None (imported by all other modules)
 */

const SCRIPT_VERSION = 'v217-DIAGNOSTIC-1'; // Added detailed payload logging for undefined action
const TARGET_SPREADSHEET_ID = ""; // Leave empty to use the Active Spreadsheet (Bound Script)

// --- ORDER STATUS ENUM ---
const OrderStatus = {
  PENDING: 'pending',
  BROADCASTED: 'broadcasted',
  ASSIGNED: 'assigned',
  ARRIVED: 'arrived', // NEW: Driver is waiting outside
  WAITING_APPROVAL: 'waiting_approval',
  PAID: 'paid',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CONFIRMED: 'assigned', // ALIAS: Mapped to assigned for stats compatibility
  ON_ROUTE: 'on_route' // ALIAS: Mapped to in_progress for stats compatibility
};

// --- DRIVER STATUS ENUM ---
const DriverStatus = {
  ACTIVE: 'active',
  PENDING: 'pending_approval',
  BLOCKED: 'blocked',
  DELETED: 'deleted' // Soft Delete
};

// --- BOT STATE ENUM ---
const BotState = {
  IDLE: 'IDLE',
  AWAITING_PICKUP: 'AWAITING_PICKUP',
  AWAITING_DESTINATION: 'AWAITING_DESTINATION',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION'
};

// --- BUSINESS CONSTANTS ---
const CONSTANTS = {
  // Business Logic
  COMMISSION_PCT: 15, // Default fallback if settings missing
  DEFAULT_RADIUS_KM: 5,
  MAX_NEARBY_DRIVERS: 20,
  BATCH_SIZE_NOTIFICATIONS: 10,
  
  // Timeouts (ms)
  LOCK_SHORT: 5000,
  LOCK_MEDIUM: 10000,
  LOCK_LONG: 30000,
  
  // Caching (seconds)
  CACHE_TTL_DASHBOARD: 120,
  CACHE_TTL_ORDERS: 60,
  CACHE_TTL_DRIVERS: 300,
  
  // Security & Limits
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_SEC: 900,
  ORDER_RATE_LIMIT_SEC: 5,
  FORCE_SYNC_LIMIT: 500,
  
  // External Integration
  TELEGRAM_TIMEOUT_SEC: 5,
  FIREBASE_RETRY_COUNT: 3,
  
  // Magic Strings
  ADMIN_PHONE_PLACEHOLDER: '0000000000'
};

// --- MESSAGE TEMPLATES ---
const MessageTemplates = {
  NEW_RIDE_GROUP: (id, from, to, price, time, link, notes) => {
    // Privacy: 'from' and 'to' are now City/Region only (structural fix)
    return `🚖 *נסיעה חדשה זמינה! - ${id}*\n\n📍 *מאיפה:* ${from}\n🏁 *לאן:* ${to}\n\n💰 *מחיר:* ${price} ₪\n🕒 *זמן:* ${time}\n${notes ? `\n📝 *הערות:* ${notes}\n` : ''}\n👇 *לחץ כאן לקבלת הנסיעה והכתובת המלאה:*\n${link}`;
  },
    
  NEW_RIDE_PRIVATE: (id, from, to, price, time) => 
    `🚖 *נסיעה חדשה זמינה! - ${id}*\n\n📍 *מאיפה:* ${from}\n🏁 *לאן:* ${to}\n\n💰 *מחיר:* ${price} ₪\n🕒 *זמן:* ${time}\n\n(פרטים מלאים לאחר קבלה)`,
    
  RIDE_TAKEN: (id, driverName) => 
    `❌ *הזמנה ${id} נתפסה!*\nנלקחה על ידי הנהג: ${driverName}\n\nתודה!`,
    
  RIDE_APPROVED: (id, customerName, customerPhone, from, to, price, commission, time, exactPickup, exactDest) => {
    const p = Utils.normalizePhone(customerPhone);
    return `✅ *נסיעה מאושרת! (${id})*\n\n👤 *שם הלקוח:* ${customerName}\n📞 *טלפון:* [${p}](tel:${p})\n\n📍 *איסוף:* ${from}\n${exactPickup}\n\n🏁 *יעד:* ${to}\n${exactDest}\n\n💰 *מחיר:* ${price} ₪\n💳 *עמלה לתשלום:* ${commission} ₪\n🕒 *זמן:* ${time}\n\n⚠️ *חשוב:* יש לשלם את העמלה לפני סיום הנסיעה.\n\nסע בזהירות!`;
  },
    
  CUSTOMER_CONFIRMATION: (id, driverName, driverPhone, eta, from, to, price) => {
    const p = Utils.normalizePhone(driverPhone);
    return `✨ *הנסיעה שלך בדרך!* ✨\n\n` +
           `נהג אישר את הזמנתך (נסיעה ${id})\n\n` +
           `👤 *נהג:* ${driverName}\n` +
           `📞 *טלפון:* [${p}](tel:${p})\n\n` +
           `🚗 הנהג יגיע אליך בעוד כ-${eta} דקות.\n\n` +
           `📍 *איסוף:* ${from}\n` +
           `🏁 *יעד:* ${to}\n` +
           `💰 *מחיר סופי:* ${price} ₪\n\n` +
           `תודה שבחרת בנו! 🚕`;
  },

  RIDE_COMPLETED_THANKS: (id, price, commission) =>
    `🎉 *הנסיעה הושלמה בהצלחה! (הזמנה ${id})*\n\n✅ התשלום אושר והנסיעה נסגרה.\n💰 מחיר: ${price} ₪\n💳 עמלה ששולמה: ${commission} ₪\n\nתודה רבה לך! נתראה בנסיעה הבאה.`,

  PAYMENT_RECEIPT: (id, driverName, rideDate, price, commission, companyName) =>
    `🧾 *קבלה / אישור תשלום - ${companyName}*\n\n` +
    `📅 *תאריך:* ${rideDate}\n` +
    `🔢 *מספר הזמנה:* ${id}\n` +
    `👤 *שם הנהג:* ${driverName}\n\n` +
    `----------------------------\n` +
    `💰 *סכום נסיעה:* ${price} ₪\n` +
    `💳 *דמי טיפול / עמלה:* ${commission} ₪ (שולם)\n` +
    `----------------------------\n\n` +
    `✅ *התשלום אושר במערכת.*\nתודה שבחרתם ${companyName}!`,

  RIDE_APPROVED_MASKED: (id, customerName, pickup, dest, price, commission, time, exactPickup, exactDest) =>
    `🔒 *נסיעה שמורה עבורך! (${id})*\n\n` +
    `📍 *איסוף:* ${pickup}\n` +
    (exactPickup ? `${exactPickup}\n` : '') +
    `🏁 *יעד:* ${dest}\n` +
    (exactDest ? `${exactDest}\n` : '') +
    `\n💰 *מחיר:* ${price} ₪\n` +
    `💳 *עמלה:* ${commission} ₪\n` +
    `🕒 *זמן:* ${time}\n\n` +
    `הפרטים המלאים (טלפון לקוח) זמינים עבורך באפליקציה.`,

  CUSTOMER_DETAILS_REVEALED: (id, customerName, customerPhone, from, to, exactPickup, exactDest, price, notes, time, pickupNotes, destNotes) => {
    const p = Utils.normalizePhone(customerPhone);
    const pickupFull = exactPickup ? `${from}, ${exactPickup}` : from;
    const destFull = exactDest ? `${to}, ${exactDest}` : to;
    
    return `🔓 *פרטי נסיעה מלאים - הזמנה ${id}*\n\n` +
           `👤 *לקוח:* ${customerName}\n` +
           `📞 *טלפון:* [${p}](tel:${p})\n\n` +
           `📍 *איסוף:* ${pickupFull}\n` +
           (pickupNotes ? `📝 *הערות איסוף:* ${pickupNotes}\n` : '') +
           `\n🏁 *יעד:* ${destFull}\n` +
           (destNotes ? `📝 *הערות יעד:* ${destNotes}\n` : '') +
           `\n💰 *מחיר:* ${price} ₪\n` +
           `🕒 *זמן:* ${time}\n\n` +
           `⚠️ *נסיעה טובה ובטוחה!*`;
  },

  DRIVER_ARRIVED: (id, driverName, driverPhone, plateNumber, carModel, carColor, customerName) => {
    const p = Utils.normalizePhone(driverPhone);
    const greeting = customerName ? `שלום ${customerName}! ` : '';
    return `🚖 *${greeting}הנהג הגיע לנקודת האיסוף! (${id})*\n\n` +
           `👤 *נהג:* ${driverName}\n` +
           `📞 *טלפון:* [${p}](tel:${p})\n` +
           `🚗 *רכב:* ${carModel} ${carColor} (${plateNumber})\n\n` +
           `🕐 *הנהג ממתין לך בנקודת האיסוף.*\n` +
           `אנא צא/י בהקדם. תודה!`;
  },

  // --- RETENTION MESSAGES ---
  RETENTION_END_RIDE: (customerName, price) => 
    `היי ${customerName}! תודה שנסעת איתנו היום 🚕\n\n` +
    `ראית שהמחיר לא השתנה? ${price} ₪ זה מה ששילמת.\n\n` +
    `💡 *טיפ:* שמור אותנו בטלפון בשם *'מונית מחיר קבוע'*\n` +
    `בפעם הבאה - אותו שירות, אותה שקיפות.\n\n` +
    `רוצה להזמין שוב? פשוט כתוב *'הזמנה'* 👇`,

  RETENTION_AIRPORT_7DAYS: (customerName) =>
    `שלום ${customerName}! 🛬\n\n` +
    `לפני שבוע הסענו אותך לשדה התעופה.\n` +
    `זוכר שהמחיר לא השתנה גם עם הפקק שהיה?\n\n` +
    `חוזר מהטיסה בקרוב?\n` +
    `נשמח להסיע אותך גם בחזרה 🚕\n\n` +
    `לתיאום: פשוט כתוב מתי אתה נחת ואנחנו נדאג לשאר.`,

  RETENTION_VIP_3RD_RIDE: (customerName) =>
    `🎉 *${customerName}, אתה כבר לקוח VIP אצלנו!*\n\n` +
    `זו הנסיעה ה-3 שלך איתנו - תודה על האמון!\n\n` +
    `מעכשיו אתה מקבל:\n` +
    `✅ עדיפות בהזמנות\n` +
    `✅ הנהגים הכי מדורגים שלנו\n` +
    `✅ תמיכה ייעודית\n\n` +
    `שמור את המספר - אנחנו כאן בשבילך.`,

  RETENTION_INACTIVE_30DAYS: (customerName) =>
    `היי ${customerName} 👋\n\n` +
    `לא ראינו אותך כבר חודש - הכל בסדר?\n\n` +
    `בזמן האחרון שיפרנו:\n` +
    `🚀 זמן תגובה מהיר יותר\n` +
    `💰 מחירים עוד יותר תחרותיים\n\n` +
    `הנסיעה הבאה עלינו? שווה 10% הנחה 🎁\n` +
    `פשוט כתוב *'הזמנה'*`
};

// --- SCHEMA DEFINITIONS ---
const Schema = {
  Sheets: {
    ORDERS: 'Orders',
    DRIVERS: 'Drivers',
    CUSTOMERS: 'Customers',
    SETTINGS: 'Settings',
    LOGS: 'Logs',
    NOTIFICATIONS: 'Notifications',
    RATINGS: 'Ratings',
    RETENTION_LOGS: 'RetentionLogs',
    MARKETING_DATA: 'MarketingData',
    FACEBOOK_DATA: 'FacebookData',
    GOOGLE_ADS_RAW: 'GoogleAdsRaw',
    CITY_DEMAND: 'CityDemand'
  },
  Columns: {
    Orders: [
        'order_id', 'customer_name', 'customer_phone', 'pickup_address', 'destination_address',
        'pickup_datetime', 'price', 'status', 'driver_id', 'driver_name', 'driver_phone',
        'created_at', 'updated_at', 'assigned_at', 'arrived_at',
        'pickup_notes', 'destination_notes',
        'pickup_exact_address', 'destination_exact_address',
        'commission', 'driver_profit', 'payment_completed', 'idempotency_key',
        'pickup_lat', 'pickup_lng', 'destination_lat', 'destination_lng', 'broadcast_msg_id', 'whatsapp_msg_id',
        'notes', 'distance_km', 'duration',
        'passengers', 'luggage', 'flight_number', 'payment_method', 'notification_channels', 'source'
    ],
    Drivers: [
        'driver_id', 'driver_name', 'phone', 'telegram_id', 'status',
        'service_area', 'license_number', 'taxi_plate_number',
        'car_model', 'car_color',
        'total_rides', 'total_revenue', 'consent_date', 'telegram_username', 'updated_at',
        'average_rating', 'total_ratings', 'session_secret', 'lat', 'lng',
        'email', 'given_name', 'family_name', 'profile_picture', 'google_id', 'email_verified',
        'insurance_expiry', 'license_expiry', 'car_doc_expiry'
    ],
    Customers: [
        'customer_phone', 'customer_name', 'total_rides', 'total_spent', 'last_ride_date', 'created_at', 'notes',
        'email', 'given_name', 'family_name', 'profile_picture', 'google_id', 'email_verified', 'session_secret'
    ],
    Settings: ['key', 'value'],
    Logs: ['timestamp', 'level', 'action', 'data'],
    Ratings: ['rating_id', 'order_id', 'driver_id', 'rating', 'comment', 'created_at'],
    Notifications: ['timestamp','requestId','bridgeMessageId','method','jid','targetGroupJid','driverId','orderId','text','status','rawResponse'],
    RetentionLogs: ['timestamp', 'customer_phone', 'trigger_type', 'message_sent', 'order_id', 'status'],
    MarketingData: ['date', 'campaign_name', 'clicks', 'cost', 'conversions'],
    FacebookData: ['date', 'campaign_name', 'spend', 'clicks', 'reach', 'impressions', 'actions'],
    GoogleAdsRaw: ['date', 'campaign_name', 'clicks', 'cost', 'conversions'],
    CityDemand: ['city', 'total_orders', 'active_drivers', 'demand_score', 'last_updated']
  }
};

// --- ACTION NAMES ---
const Actions = {
  // --- Orders ---
  CREATE_ORDER: 'createOrder',
  ACCEPT_RIDE: 'acceptRideByPhone',
  GET_ORDER_DETAILS: 'getOrderDetails',
  GET_PAYMENT_INFO: 'getPaymentInfo',
  GET_ORDERS: 'getOrders',
  UPDATE_ORDER: 'updateOrder',
  GET_ORDER_STATUS: 'getOrderStatus',
  CALCULATE_PRICE: 'calculatePrice',
  COMPLETE_ORDER: 'completeOrder',
  MARK_PAYMENT_COMPLETED: 'markPaymentCompleted',
  ACCEPT_BY_TELEGRAM: 'acceptByTelegramWebApp',
  UNASSIGN_DRIVER: 'unassignDriver',
  RESEND_ORDER: 'resendOrderDetails',
  CHECK_PAYMENT_TIMEOUTS: 'checkPaymentTimeouts',

  // --- Drivers ---
  GET_DRIVERS: 'getDrivers',
  GET_DRIVER: 'getDriver',
  REGISTER_DRIVER: 'registerDriverAndAssignOrder',
  REGISTER_DRIVER_SELF: 'registerDriverSelf',
  CREATE_DRIVER: 'createDriver',
  LOGIN_DRIVER: 'loginDriver',
  GET_DRIVER_PORTAL_DATA: 'getDriverPortalData',
  UPDATE_DRIVER_LOCATION: 'updateDriverLocation',
  DELETE_DRIVER: 'deleteDriver',
  GENERATE_MONTHLY_REPORT: 'generateMonthlyReport',

  // --- Marketing ---
  PUBLISH_POST: 'publishPost',

  // --- Admin & System ---
  TEST_CONNECTION: 'testConnection',
  GET_SYSTEM_SETTINGS: 'getSystemSettings',
  SAVE_SETTINGS: 'saveSettings',
  LOGIN_ADMIN: 'loginAdmin',
  REFRESH_ADMIN_TOKEN: 'refreshAdminToken',
  GET_DASHBOARD_STATS: 'getDashboardStats',
  GET_MAP_DATA: 'getMapData',
  LOGOUT_ADMIN: 'logoutAdmin',
  GET_NOTIFICATIONS: 'getNotifications',
  REPLAY_NOTIFICATION: 'replayNotification',

  // --- Bridge & Webhooks ---
  SET_TELEGRAM_WEBHOOK: 'setTelegramWebhook',
  DELETE_TELEGRAM_WEBHOOK: 'deleteTelegramWebhook',
  TEST_WHATSAPP: 'testWhatsApp',
  GET_SYSTEM_HEALTH: 'getSystemHealth',
  CHECK_BRIDGE_HEARTBEAT: 'checkBridgeHeartbeat',
  OPEN_BRIDGE_FOLDER: 'openBridgeFolder',
  PICK_BRIDGE_FOLDER: 'pickBridgeFolder',

  // --- API Aliases (Frontend Compatibility) ---
  DRIVER_LOGIN: 'driverLogin',
  DRIVER_UPDATE_LOC: 'updateLocation',
  DRIVER_UPDATE_LOC_FE: 'updateDriverLocation', 
  DRIVER_ACCEPT: 'acceptOrder',
  DRIVER_ACCEPT_FE: 'acceptRideByPhone',
  DRIVER_COMPLETE: 'completeOrder',
  GET_NEWS: 'getNews',
  GET_TAXI_NEWS: 'getTaxiNews',
  ADMIN_LOGIN: 'adminLogin',
  CHECK_AUTH: 'checkAuth',
  GET_DAILY_REPORT: 'getDailyReport',
  MARK_PAYMENT: 'markPayment',
  LINK_TELEGRAM: 'linkTelegram',
  SUBMIT_RATING: 'submitRating',
  STANDARDIZE_HEADERS: 'standardizeHeaders',
  REPAIR_PHONES: 'repairPhoneNumbers',
  RESEND_ORDER_DETAILS: 'resendOrderDetails',
  UPDATE_DRIVER_PROFILE: 'updateDriverProfile',
  SEARCH_ADDRESS: 'searchAddress',
  CANCEL_ORDER: 'cancelOrder',
  ASSIGN_DRIVER: 'assignDriver',
  GET_SYSTEM_DIAGNOSTICS: 'getSystemDiagnostics',

  // --- Analytics & Fleet Management ---
  GET_REVENUE_STATS: 'getRevenueStats',
  GET_DEMAND_HEATMAP: 'getDemandHeatmap',
  GET_DRIVER_LEADERBOARD: 'getDriverLeaderboard',
  CHECK_DOCUMENT_EXPIRY: 'checkDocumentExpiry',
  GENERATE_COMMISSION_REPORT: 'generateCommissionReport'
};

// --- STATE MACHINE ---
const StateMachine = {
  /**
   * Allowed transitions for each order status.
   */
   transitions: {
    [OrderStatus.PENDING]:          [OrderStatus.BROADCASTED, OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
    [OrderStatus.BROADCASTED]:      [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
    // [FIX] ASSIGNED can now go to ARRIVED (driver arrives at pickup) OR WAITING_APPROVAL (driver marks payment)
    [OrderStatus.ASSIGNED]:         [OrderStatus.ARRIVED, OrderStatus.WAITING_APPROVAL, OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    // [FIX] ARRIVED → IN_PROGRESS when driver starts the ride (was missing: ARRIVED was previously unreachable)
    [OrderStatus.ARRIVED]:          [OrderStatus.IN_PROGRESS, OrderStatus.WAITING_APPROVAL, OrderStatus.CANCELLED],
    [OrderStatus.WAITING_APPROVAL]: [OrderStatus.PAID, OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
    [OrderStatus.PAID]:             [OrderStatus.IN_PROGRESS, OrderStatus.ARRIVED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.IN_PROGRESS]:      [OrderStatus.COMPLETED, OrderStatus.WAITING_APPROVAL, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]:        [], // Terminal state
    [OrderStatus.CANCELLED]:        [OrderStatus.PENDING, OrderStatus.BROADCASTED]
  },

  /**
   * Validates if a status transition is allowed.
   * @param {string} current - Current status
   * @param {string} next - Target status
   * @returns {boolean}
   */
  canTransition: (current, next) => {
    const normCurrent = (current || '').toString().toLowerCase().trim();
    const normNext = (next || '').toString().toLowerCase().trim();
    if (normCurrent === normNext) return true;
    const allowed = StateMachine.transitions[normCurrent] || [];
    return allowed.includes(normNext);
  }
};

// --- RATE LIMITER ---
const RateLimiter = {
  /**
   * Checks if a request exceeds rate limits using Google Apps Script CacheService.
   * @param {string} key - Unique key for the rate limit (e.g. IP or Phone)
   * @param {number} limit - Max requests allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {boolean} True if within limits, false if throttled
   */
  check: (key, limit, windowSeconds) => {
    const cache = CacheService.getScriptCache();
    const cacheKey = `rate_limit_${key}`;
    const count = parseInt(cache.get(cacheKey) || '0');
    
    if (count >= limit) {
      return false;
    }
    
    cache.put(cacheKey, String(count + 1), windowSeconds);
    Utils.log("DEBUG", "RateLimiter: incremented", { key, count: count + 1, limit });
    return true;
  }
};

    // --- DEFAULT SETTINGS ---
const DEFAULT_SETTINGS = [
  {key: 'COMPANY_NAME', value: 'תחנת מוניות', label: 'שם החברה'},
  {key: 'STATION_COMMISSION_PCT', value: '8', label: 'אחוז עמלה'},
  {key: 'ADMIN_EMAIL', value: '', label: 'אימייל מנהל'},
  {key: 'ADMIN_PASSWORD', value: '[HIDDEN]', label: 'סיסמת מנהל'},
  {key: 'SERVER_SPOT', value: '', label: 'נתיב השרת המקומי'},
  {key: 'TARGET_GROUP_JID', value: '', label: 'מזהה קבוצת WhatsApp'},
  {key: 'TELEGRAM_BOT_TOKEN', value: '[HIDDEN]', label: 'טוקן בוט טלגרם'},
  {key: 'TELEGRAM_CHAT_ID', value: '', label: 'מזהה קבוצת טלגרם'},
  {key: 'TELEGRAM_WEBHOOK_SECRET', value: 'myWebhook_s3cr3t_2026', label: 'סוד Webhook'},
  {key: 'TELEGRAM_WEBHOOK_TOKEN', value: '', label: 'טוקן Webhook לטלגרם (נדרש לאימות)'},
  {key: 'WHATSAPP_BRIDGE_URL', value: '', label: 'כתובת שרת WhatsApp מקומי (מתעדכן אוטומטית)'},
  {key: 'WHATSAPP_RENDER_URL', value: '', label: 'כתובת Render WhatsApp Bridge (ענן)'},
  {key: 'WHATSAPP_FALLBACK_URL', value: '', label: 'כתובת גיבוי נוספת (למשל Ngrok או tunnel משני)'},
  {key: 'BRIDGE_MODE', value: 'AUTO', label: 'מצב גשר (LOCAL/RENDER/AUTO - ב-AUTO משתמש מקומי קודם ונסה Render בפאילובר)'},
  {key: 'BRIDGE_API_KEY', value: '[SECURELY_STORED_IN_PROPS]', label: 'מפתח API Bridge'},
  {key: 'WHATSAPP_BRIDGE_URL_UPDATED_AT', value: '', label: 'זמן עדכון אחרון של כתובת הגשר'},
  {key: 'WHATSAPP_BRIDGE_URL_UPDATED_BY', value: '', label: 'מחשב/שרת שעדכן את הגשר'},
  {key: 'WHATSAPP_BRIDGE_TUNNEL_TYPE', value: 'cloudflared', label: 'סוג Tunnel (ngrok/cloudflared)'},
  {key: 'GH_API_KEY', value: '[HIDDEN]', label: 'מפתח GraphHopper'},
  {key: 'GOOGLE_MAPS_API_KEY', value: '[HIDDEN]', label: 'מפתח Google Maps API (JavaScript/Places)'},
  {key: 'BASE_PRICE', value: '35', label: 'מחיר בסיס'},
  {key: 'PRICE_PER_KM', value: '4', label: 'מחיר לק"מ'},
  {key: 'STATION_PAYMENT_PHONE', value: '', label: 'טלפון לתשלום (Bit/PayBox)'},
  {key: 'STATION_PAYPAL_EMAIL', value: '', label: 'PayPal Email'},
  {key: 'BRIDGE_HEARTBEAT_INTERVAL_MINUTES', value: '15', label: 'תדירות בדיקת חיבור (דקות)'},
  {key: 'ENABLE_WHATSAPP', value: 'TRUE', label: 'הפעל WhatsApp'},
  {key: 'ENABLE_TELEGRAM', value: 'TRUE', label: 'הפעל Telegram'},
  {key: 'ENABLE_AUTO_BOT', value: 'FALSE', label: 'בוט הזמנות אוטומטי (Telegram)'},
  {key: 'DEFAULT_RADIUS_KM', value: '5', label: 'רדיוס חיפוש נהגים (ק"מ)'},
  {key: 'LAST_ORDER_ID', value: '1050', label: 'מספר הזמנה אחרון'},
  {key: 'MAINTENANCE_MODE', value: 'FALSE', label: 'מצב תחזוקה'},
  {key: 'TIMEZONE', value: 'Asia/Jerusalem', label: 'אזור זמן'},
  {key: 'WHATSAPP_BOT_NUMBER', value: '', label: 'מספר טלפון בוט (ברירת מחדל)'},
  {key: 'WHATSAPP_BOT_NUMBER_PASSENGER', value: '', label: 'מספר בוט נוסעים'},
  {key: 'WHATSAPP_BOT_NUMBER_DRIVER', value: '', label: 'מספר בוט נהגים'},
  {key: 'WHATSAPP_BOT_NUMBER_ADMIN', value: '', label: 'מספר בוט ניהול'},
  {key: 'SCRIPTS_URL', value: '', label: 'כתובת Google Apps Script Web App'},
  {key: 'APP_URL', value: 'http://localhost:5273/passenger.html', label: 'כתובת האפליקציה (נוסעים)'},
  {key: 'DRIVER_APP_URL', value: 'http://localhost:5274/driver.html', label: 'כתובת אפליקציית נהגים'},
  {key: 'ADMIN_APP_URL', value: 'http://localhost:5275/admin.html', label: 'כתובת מערכת ניהול'},
  {key: 'JWT_SECRET', value: '[HIDDEN]', label: 'מפתח JWT פנימי'},
  {key: 'PEAK_MORNING_START', value: '07:00', label: 'תחילת תעריף שיא בוקר'},
  {key: 'PEAK_MORNING_END', value: '09:30', label: 'סיום תעריף שיא בוקר'},
  {key: 'PEAK_MORNING_MULTIPLIER', value: '1', label: 'מכפיל בוקר'},
  {key: 'PEAK_EVENING_START', value: '16:00', label: 'תחילת תעריף שיא ערב'},
  {key: 'PEAK_EVENING_END', value: '19:00', label: 'סיום תעריף שיא ערב'},
  {key: 'PEAK_EVENING_MULTIPLIER', value: '1.3', label: 'מכפיל ערב'},
  {key: 'PEAK_NIGHT_START', value: '22:00', label: 'תחילת תעריף שיא לילה'},
  {key: 'PEAK_NIGHT_END', value: '05:00', label: 'סיום תעריף שיא לילה'},
  {key: 'PEAK_NIGHT_MULTIPLIER', value: '1.5', label: 'מכפיל לילה'},
  {key: 'FIREBASE_PROJECT_ID', value: '', label: 'Firebase Project ID'},
  {key: 'FIREBASE_DB_URL', value: '', label: 'Firebase Database URL'},
  {key: 'LOGIN_MAX_ATTEMPTS', value: '20', label: 'מקסימום נסיונות התחברות'},
  {key: 'LOGIN_LOCKOUT_MINUTES', value: '0', label: 'זמן חסימה לאחר כשלון (דקות)'},
  {key: 'FIREBASE_AUTH_SECRET', value: '[HIDDEN]', label: 'Firebase Auth Secret'},
  
  // --- MARKETING BUDGETS (Monthly) ---
  {key: 'MARKETING_BUDGET_GOOGLE', value: '2000', label: 'תקציב גוגל חודשי (₪)'},
  {key: 'MARKETING_BUDGET_FACEBOOK', value: '1000', label: 'תקציב פייסבוק חודשי (₪)'},
  {key: 'MARKETING_BUDGET_INSTAGRAM', value: '500', label: 'תקציב אינסטגרם חודשי (₪)'},
  
  // --- MARKETING INTEGRATION ---
  {key: 'FACEBOOK_ADS_ACCOUNT_ID', value: '', label: 'מזהה חשבון פייסבוק אדס (act_xxx)'},
  {key: 'FACEBOOK_ADS_ACCESS_TOKEN', value: '[HIDDEN]', label: 'טוקן גישה פייסבוק (Graph API)'},
  {key: 'GOOGLE_ADS_EXTERNAL_SHEET_URL', value: 'https://docs.google.com/spreadsheets/d/110OhMVadb0Z30zyA-iqnAu9MHOoifzzjYWzmJv-KET0/edit', label: 'קישור לגיליון נתוני גוגל אדס חיצוני'},
  
  // --- PUBLISHING INTEGRATION ---
  {key: 'PUBLISH_TELEGRAM_BOT_TOKEN', value: '', label: 'טוקן בוט טלגרם לפרסום'},
  {key: 'PUBLISH_TELEGRAM_CHANNEL_ID', value: '', label: 'מזהה ערוץ טלגרם לפרסום'},
  {key: 'PUBLISH_FACEBOOK_PAGE_ID', value: '', label: 'מזהה דף פייסבוק לפרסום'},
  {key: 'PUBLISH_FACEBOOK_PAGE_TOKEN', value: '', label: 'טוקן דף פייסבוק לפרסום'},
  {key: 'PUBLISH_BLOGGER_BLOG_ID', value: '', label: 'מזהה בלוג בבלוגר לפרסום'},
  {key: 'PUBLISH_GBUSINESS_LOCATION_NAME', value: '', label: 'מזהה מיקום בגוגל ביזנס לפרסום'},
  {key: 'ALERT_EMAIL', value: '', label: 'אימייל להתראות מערכת (גיבוי)'}
];
