
export interface Order {
  orderId: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupExactAddress?: string;
  destinationExactAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  pickupDatetime: string;
  price: number | string;
  status: 'pending' | 'broadcasted' | 'assigned' | 'waiting_approval' | 'paid' | 'in_progress' | 'completed' | 'cancelled' | 'confirmed' | 'on_route';
  broadcastMsgId?: string;
  driverName?: string;
  driverId?: string;
  driverPhone?: string;
  driverCarPlate?: string;
  createdAt?: string;
  updatedAt?: string;
  pickupNotes?: string;
  destinationNotes?: string;
  paymentCompleted?: boolean | string;
  commission?: number;
  driverProfit?: number;
  passengers?: number | string;
  luggage?: number | string; // Boolean 'yes'/'no' or count
  flightNumber?: string;
  paymentMethod?: string; // 'cash', 'credit', 'bit'
  notificationChannels?: string; // stored as JSON string likely
  driver?: {
    name: string;
    phone: string;
    carModel?: string;
    carColor?: string;
    plateNumber?: string;
  };
  driverLocation?: {
    lat: number;
    lng: number;
    heading?: number;
    timestamp: number;
  };
}

export interface Driver {
  driverId: string;
  driverName: string;
  phone: string;
  telegramId: string;
  telegramUsername?: string;
  status: 'active' | 'pending_approval' | 'blocked' | 'deleted';
  serviceArea: string;
  licenseNumber: string;
  taxiPlateNumber: string;
  totalRides?: number;
  todayRides?: number;
  consentDate?: string;
  updatedAt?: string;
  averageRating?: number;
  totalRatings?: number;
  totalRevenue?: number;
  todayRevenue?: number;
  debt?: number;
  lat?: number;
  lng?: number;
  lastUpdate?: string;
  carType?: string;
  isOnline?: boolean;
  email?: string;
  givenName?: string;
  familyName?: string;
  profilePicture?: string;
  googleId?: string;
  emailVerified?: boolean;
  insuranceExpiry?: string;
  licenseExpiry?: string;
  carDocExpiry?: string;
  lastHeartbeat?: string | number;
}

export interface GoogleProfile {
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  sub: string;
  email_verified: boolean;
}

export interface Rating {
  ratingId: string;
  orderId: string;
  driverId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface DriverPortalData {
  driver: Driver;
  stats: {
    totalRides: number;
    totalEarnings: number;
    completionRate: number;
  };
  recentRides: Order[];
}

export interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  lastUpdate: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  completedCount: number;
  cancelledCount: number;
  revenueByStatus: {
    completed: number;
    cancelled: number;
    pending: number;
    broadcasted: number;
    assigned: number;
    waiting_approval: number;
    paid: number;
    in_progress: number;
    confirmed?: number;
  };
  ordersToday: number;
  ordersWeekly?: number;
  ordersMonthly?: number;
  revenueToday?: number;
  revenueWeekly?: number;
  revenueMonthly?: number;
  totalRevenueAllTime?: number;
  stationCommission: number;
  commissionToday?: number;
  commissionWeekly?: number;
  commissionMonthly?: number;
  commissionPct: number;
  paymentPhone?: string;
  paypalEmail?: string;
  dailyStats: { date: string, count: number, revenue: number, commission: number }[];
  averagePickupTime?: number; // New KPI
  activeDriversCount?: number;
  pendingCount?: number;
  activeCount?: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  error_code?: string;
  message?: string;
  takenBy?: string;
  platform?: string;
  registerUrl?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  isCompleted?: boolean;
}

export interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  destinationAddress: string;
  pickupExactAddress?: string;
  destinationExactAddress?: string;
  pickupDate: string;
  pickupTime: string;
  price: number;
  pickupNotes?: string;
  destinationNotes?: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  notificationChannels?: ('telegram' | 'whatsapp')[];
  passengers?: string;
  luggage?: string;
  flightNumber?: string;
  paymentMethod?: 'cash' | 'credit' | 'bit';
}

export interface DriverRegistrationPayload {
  driverName: string;
  phone: string;
  serviceArea: string;
  licenseNumber: string;
  taxiPlateNumber: string;
  telegramId: string;
  telegramUsername?: string;
  orderId?: string;
  hasConsented?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AcceptRidePayload {
  orderId: string;
  phone: string;
}

export interface CalculatePricePayload {
  pickupAddress: string;
  destinationAddress: string;
  pickupExactAddress?: string; // Street/Number (Hebrew)
  destinationExactAddress?: string; // Street/Number (Hebrew)
  pickupDate?: string;
  pickupTime?: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  passengers?: number | string;
  luggage?: number | boolean;
  flightNumber?: string;
  paymentMethod?: string;
  notificationChannels?: ('telegram' | 'whatsapp')[];
}

export interface PriceCalculationResult {
  distanceKm: number;
  duration: string;
  price: number;
  multiplier?: number;
  source?: string;
}

export interface NewsArticle {
  id: number;
  title: string;
  link: string;
  date: string;
  source: string;
  image: string;
}

export interface RideDetailsData {
  orderId: string;
  status: string;
  price: number | string;
  commission: number | string;
  pickupAddress: string;
  destinationAddress: string;
  pickupDatetime: string;
  customerName?: string;
  customerPhone?: string;
  pickupNotes?: string;
  destinationNotes?: string;
  pickupExactAddress?: string;
  destinationExactAddress?: string;
  paymentCompleted?: boolean | string;
  updatedAt?: string;
  serverTime?: number;
  paymentPhone?: string;
  paypalEmail?: string;
  distanceKm?: number;
  duration?: string;
  pickupLat?: number | string;
  pickupLng?: number | string;
  destinationLat?: number | string;
  destinationLng?: number | string;
  passengers?: number | string;
  luggage?: number | string;
  flightNumber?: string;
  notes?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverProfit?: number;
  fullPrice?: number;
  totalRides?: number;
  totalRevenue?: number;
  paymentReported?: boolean | string;
  paymentStatus?: string;
}

export type OrderStatusResponse = RideDetailsData;

export interface SystemSettings {
  STATION_NAME?: string;
  STATION_PHONE?: string;
  STATION_COMMISSION_PCT?: string | number;
  STATION_PAYMENT_PHONE?: string;
  STATION_PAYPAL_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  JWT_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  WHATSAPP_BRIDGE_URL?: string;
  BRIDGE_API_KEY?: string;
  GOOGLE_MAPS_API_KEY?: string;
  ENABLE_AUTO_BOT?: string | boolean;
  APP_URL?: string;
  [key: string]: any;
}
