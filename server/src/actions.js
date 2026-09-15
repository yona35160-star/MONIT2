import crypto from 'node:crypto';
import {
  ok,
  fail,
  get,
  parsePrice,
  normalizePhone,
  compareIds,
  stripDoc,
  haversineKm,
  activeOrderStatuses,
  nowIso,
  startOfDay,
} from './util.js';
import { collections, nextOrderId, verifyPassword } from './db.js';
import {
  issueAdminToken,
  verifyAdminToken,
  randomSecret,
  issueDriverToken,
  issuePassengerToken,
  parseDriverToken,
  parsePassengerToken,
} from './auth.js';

const findOrder = async (id) => {
  if (!id) return null;
  const { orders } = collections();
  const exact = await orders.findOne({ orderId: String(id) });
  if (exact) return exact;
  const all = await orders.find({}).project({ orderId: 1 }).toArray();
  const hit = all.find((o) => compareIds(o.orderId, id));
  if (!hit) return null;
  return orders.findOne({ orderId: hit.orderId });
};

const findDriver = async ({ driverId, phone }) => {
  const { drivers } = collections();
  if (driverId) {
    const d = await drivers.findOne({ driverId: String(driverId) });
    if (d) return d;
  }
  if (phone) {
    const p = normalizePhone(phone);
    const list = await drivers.find({}).toArray();
    return list.find((d) => normalizePhone(d.phone) === p) || null;
  }
  return null;
};

const settingsMap = async () => {
  const { settings } = collections();
  const rows = await settings.find({}).toArray();
  const map = {};
  for (const r of rows) map[r.key || r._id] = r.value;
  return map;
};

const publicSettings = async () => {
  const map = await settingsMap();
  delete map.ADMIN_PASSWORD;
  delete map.JWT_SECRET;
  delete map.ADMIN_SALT;
  return map;
};

const isAdmin = (token) => verifyAdminToken(token);

const isDriver = async (token) => {
  const parsed = parseDriverToken(token);
  if (!parsed) return null;
  const driver = await findDriver({ driverId: parsed.driverId });
  if (!driver || driver.sessionSecret !== parsed.secret) return null;
  if (driver.status === 'deleted' || driver.status === 'blocked') return null;
  return driver;
};

const isPassenger = async (token) => {
  const parsed = parsePassengerToken(token);
  if (!parsed) return null;
  const { customers } = collections();
  const phone = normalizePhone(parsed.phone);
  const customer = await customers.findOne({ phone });
  if (!customer || customer.sessionSecret !== parsed.secret) return null;
  return customer;
};

const orderAuth = async (order, token, phone) => {
  if (isAdmin(token)) return true;
  const driver = await isDriver(token);
  if (driver && compareIds(driver.driverId, order.driverId)) return true;
  const input = normalizePhone(phone);
  if (input && normalizePhone(order.driverPhone) === input) return true;
  return false;
};

const computeStats = async () => {
  const { orders, drivers } = collections();
  const all = await orders.find({}).toArray();
  const fleet = await drivers.find({ status: { $ne: 'deleted' } }).toArray();
  const commPct = parseFloat((await settingsMap())['STATION_COMMISSION_PCT'] || 15) || 15;
  const today = startOfDay();
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  const month = new Date(today);
  month.setDate(1);

  const revenueByStatus = {
    completed: 0,
    cancelled: 0,
    pending: 0,
    broadcasted: 0,
    assigned: 0,
    waiting_approval: 0,
    paid: 0,
    in_progress: 0,
    confirmed: 0,
  };

  let totalRevenue = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let ordersToday = 0;
  let revenueToday = 0;
  let ordersWeekly = 0;
  let revenueWeekly = 0;
  let ordersMonthly = 0;
  let revenueMonthly = 0;
  let pendingCount = 0;
  let activeCount = 0;

  const dayBuckets = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayBuckets[key] = { date: key, count: 0, revenue: 0, commission: 0 };
  }

  for (const o of all) {
    const status = String(o.status || 'pending').toLowerCase();
    const price = parsePrice(o.price);
    if (revenueByStatus[status] !== undefined) revenueByStatus[status] += price;
    const created = new Date(o.createdAt || o.pickupDatetime || 0);
    if (status === 'completed' || status === 'paid') {
      completedCount++;
      totalRevenue += price;
    }
    if (status === 'cancelled') cancelledCount++;
    if (status === 'pending' || status === 'broadcasted') pendingCount++;
    if (activeOrderStatuses.has(status)) activeCount++;
    if (created >= today) {
      ordersToday++;
      if (status === 'completed' || status === 'paid') revenueToday += price;
    }
    if (created >= week) {
      ordersWeekly++;
      if (status === 'completed' || status === 'paid') revenueWeekly += price;
    }
    if (created >= month) {
      ordersMonthly++;
      if (status === 'completed' || status === 'paid') revenueMonthly += price;
    }
    const dayKey = created.toISOString().slice(0, 10);
    if (dayBuckets[dayKey]) {
      dayBuckets[dayKey].count++;
      if (status === 'completed' || status === 'paid') {
        dayBuckets[dayKey].revenue += price;
        dayBuckets[dayKey].commission += price * (commPct / 100);
      }
    }
  }

  const stationCommission = totalRevenue * (commPct / 100);
  return {
    totalRevenue,
    totalOrders: all.length,
    completedCount,
    cancelledCount,
    revenueByStatus,
    ordersToday,
    ordersWeekly,
    ordersMonthly,
    revenueToday,
    revenueWeekly,
    revenueMonthly,
    totalRevenueAllTime: totalRevenue,
    stationCommission,
    commissionToday: revenueToday * (commPct / 100),
    commissionWeekly: revenueWeekly * (commPct / 100),
    commissionMonthly: revenueMonthly * (commPct / 100),
    commissionPct: commPct,
    paymentPhone: (await settingsMap())['STATION_PAYMENT_PHONE'] || '',
    paypalEmail: (await settingsMap())['STATION_PAYPAL_EMAIL'] || '',
    dailyStats: Object.values(dayBuckets),
    activeDriversCount: fleet.filter((d) => d.isOnline || d.status === 'active').length,
    pendingCount,
    activeCount,
  };
};

const filterOrders = (list, status) => {
  if (!status) return list;
  const raw = String(status).toLowerCase();
  if (raw === 'active') return list.filter((o) => activeOrderStatuses.has(String(o.status || '').toLowerCase()));
  const wanted = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (!wanted.length) return list;
  return list.filter((o) => wanted.includes(String(o.status || '').toLowerCase()));
};

const loginDriverByPhone = async (phone) => {
  const driver = await findDriver({ phone });
  if (!driver || driver.status === 'deleted') return fail('Driver not found');
  if (driver.status !== 'active') return fail('חשבון הנהג חסום או ממתין לאישור');
  const sessionSecret = randomSecret();
  await collections().drivers.updateOne(
    { driverId: driver.driverId },
    { $set: { sessionSecret, updatedAt: nowIso() } }
  );
  return ok({ token: issueDriverToken(driver.driverId, sessionSecret), driverId: driver.driverId });
};

export function createActions() {
  return {
    testConnection: async () =>
      ok({ message: 'Connected to TAXIPRO Mongo API', version: 'mongo-1.0' }),

    loginAdmin: async (p) => {
      const email = String(get(p, 'email') || '').trim().toLowerCase();
      const password = String(get(p, 'password') || '').trim();
      if (!password) return fail('סיסמה לא סופקה');
      const { users } = collections();
      const admin = email
        ? await users.findOne({ email })
        : await users.findOne({ role: 'admin' });
      const envEmail = (process.env.ADMIN_EMAIL || 'admin@taxi.co.il').toLowerCase();
      const envPass = process.env.ADMIN_PASSWORD || '123456';
      const emailOk = !email || email === (admin?.email || envEmail);
      const passOk = admin ? verifyPassword(password, admin.passwordHash) : password === envPass;
      if (!emailOk || !passOk) return fail('אימות שגוי');
      const token = issueAdminToken();
      return ok({ token, expires_in: 3600 * 12, expiresIn: 3600 * 12 });
    },

    adminLogin: async (p, s, t) => createActions().loginAdmin(p, s, t),

    logoutAdmin: async () => ok({ message: 'Logged out' }),

    checkAuth: async (p, _s, t) => {
      const token = t || get(p, 'token');
      if (!token) return fail('Token missing');
      if (isAdmin(token)) return ok({ type: 'admin', valid: true });
      if (await isDriver(token)) return ok({ type: 'driver', valid: true });
      if (await isPassenger(token)) return ok({ type: 'passenger', valid: true });
      return { ok: false, error: 'Invalid Token', valid: false };
    },

    refreshAdminToken: async (p, _s, t) => {
      if (isAdmin(t)) {
        const token = issueAdminToken();
        return ok({ token, expires_in: 3600 * 12 });
      }
      if (get(p, 'password')) return createActions().loginAdmin(p);
      return fail('Unauthorized');
    },

    loginDriver: async (p) => loginDriverByPhone(get(p, 'phone', 'phoneNumber')),
    driverLogin: async (p) => loginDriverByPhone(get(p, 'phone', 'phoneNumber')),

    requestOTP: async (p) => {
      const phone = normalizePhone(get(p, 'phone'));
      const type = get(p, 'type') || 'passenger';
      if (!phone) return fail('Missing phone number');
      if (type === 'driver') {
        const driver = await findDriver({ phone });
        if (!driver) return fail('נהג לא נמצא. אנא הירשם תחילה.');
        if (driver.status !== 'active') return fail('חשבון הנהג חסום או ממתין לאישור');
      }
      const otp = process.env.DEV_OTP || String(Math.floor(100000 + Math.random() * 900000));
      await collections().otps.deleteMany({ phone });
      await collections().otps.insertOne({
        phone,
        otp,
        type,
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      const data = { sent: true };
      if (process.env.DEV_OTP) data.devHint = 'use DEV_OTP from server/.env';
      return ok(data, { message: 'OTP sent' });
    },

    verifyOTP: async (p) => {
      const phone = normalizePhone(get(p, 'phone'));
      const provided = String(get(p, 'otp') || '').trim();
      const type = get(p, 'type') || 'passenger';
      if (!phone || !provided) return fail('Missing phone or OTP');
      const row = await collections().otps.findOne({ phone });
      const envOtp = process.env.DEV_OTP || '';
      const match = (row && row.otp === provided) || (envOtp && provided === envOtp);
      if (!match) return fail(row ? 'קוד אימות שגוי' : 'הקוד פג תוקף, אנא בקש קוד חדש');
      await collections().otps.deleteMany({ phone });
      if (type === 'driver') return loginDriverByPhone(phone);
      const { customers } = collections();
      const sessionSecret = randomSecret();
      await customers.updateOne(
        { phone },
        {
          $set: { phone, sessionSecret, updatedAt: nowIso(), customerName: get(p, 'name') || '' },
          $setOnInsert: { createdAt: nowIso() },
        },
        { upsert: true }
      );
      return ok({ phone, token: issuePassengerToken(phone, sessionSecret) });
    },

    loginWithGoogle: async (p) => {
      const type = get(p, 'type') || 'passenger';
      const profile = get(p, 'profile') || {};
      if (!profile.sub && !profile.email) return fail('Missing Google Profile');
      if (type === 'driver') {
        const { drivers } = collections();
        let driver =
          (profile.sub && (await drivers.findOne({ googleId: profile.sub }))) ||
          (profile.email && (await drivers.findOne({ email: String(profile.email).toLowerCase() })));
        if (!driver) {
          return fail('Driver not found. Please register first.');
        }
        await drivers.updateOne(
          { driverId: driver.driverId },
          {
            $set: {
              googleId: profile.sub,
              email: profile.email,
              profilePicture: profile.picture,
              updatedAt: nowIso(),
            },
          }
        );
        return loginDriverByPhone(driver.phone);
      }
      const phone = normalizePhone(get(p, 'phone')) || `g${String(profile.sub || '').slice(-9)}`;
      const sessionSecret = randomSecret();
      await collections().customers.updateOne(
        { phone },
        {
          $set: {
            phone,
            email: profile.email,
            customerName: profile.name || '',
            googleId: profile.sub,
            sessionSecret,
            updatedAt: nowIso(),
          },
          $setOnInsert: { createdAt: nowIso() },
        },
        { upsert: true }
      );
      return ok({ phone, token: issuePassengerToken(phone, sessionSecret), profile });
    },

    createOrder: async (p) => {
      const pickupAddress = get(p, 'pickupAddress', 'pickup_address');
      const destinationAddress = get(p, 'destinationAddress', 'destination_address');
      let price = parsePrice(get(p, 'price'));
      if (!pickupAddress || !destinationAddress) {
        return fail('חסר מידע חיוני: pickup_address, destination_address');
      }
      if (price <= 0) {
        const calc = await createActions().calculatePrice(p);
        if (calc.ok && calc.data?.price) price = calc.data.price;
      }
      if (price <= 0) price = 80;
      const pickupDate = get(p, 'pickupDate', 'pickup_date') || '';
      const pickupTime = get(p, 'pickupTime', 'pickup_time') || '';
      const pickupDatetime =
        pickupDate && pickupTime ? `${pickupDate} ${pickupTime}` : nowIso();
      const customerPhone = normalizePhone(get(p, 'customerPhone', 'customer_phone'));
      const { orders } = collections();
      const recent = await orders
        .find({ customerPhone, pickupAddress, price })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      if (recent[0] && Date.now() - new Date(recent[0].createdAt).getTime() < 10 * 60 * 1000) {
        return fail('הזמנה כפולה: הזמנה זהה כבר התקבלה במערכת בדקות האחרונות.');
      }
      const orderId = await nextOrderId();
      const doc = {
        orderId,
        customerName: get(p, 'customerName', 'customer_name') || '',
        customerPhone,
        pickupAddress,
        destinationAddress,
        pickupExactAddress: get(p, 'pickupExactAddress', 'pickup_exact_address') || '',
        destinationExactAddress: get(p, 'destinationExactAddress', 'destination_exact_address') || '',
        pickupNotes: get(p, 'pickupNotes', 'pickup_notes') || '',
        destinationNotes: get(p, 'destinationNotes', 'destination_notes') || '',
        pickupDatetime,
        pickupDate,
        pickupTime,
        price,
        status: 'pending',
        paymentCompleted: false,
        paymentMethod: get(p, 'paymentMethod', 'payment_method') || 'cash',
        passengers: String(get(p, 'passengers') || '1'),
        luggage: String(get(p, 'luggage') || '0'),
        flightNumber: get(p, 'flightNumber', 'flight_number') || '',
        pickupLat: get(p, 'pickupLat', 'pickup_lat') || null,
        pickupLng: get(p, 'pickupLng', 'pickup_lng') || null,
        destinationLat: get(p, 'destinationLat', 'destLat', 'destination_lat') || null,
        destinationLng: get(p, 'destinationLng', 'destLng', 'destination_lng') || null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await orders.insertOne(doc);
      return ok({ orderId });
    },

    getOrders: async (p) => {
      const page = parseInt(get(p, 'page') || 1, 10) || 1;
      const pageSize = parseInt(get(p, 'pageSize', 'limit') || 20, 10) || 20;
      const { orders } = collections();
      let list = await orders.find({}).sort({ createdAt: -1 }).toArray();
      list = filterOrders(list, get(p, 'status'));
      const start = (page - 1) * pageSize;
      return ok({
        items: list.slice(start, start + pageSize).map(stripDoc),
        total: list.length,
        timestamp: nowIso(),
      });
    },

    getOrder: async (p) => {
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('הזמנה לא נמצאה');
      return ok(stripDoc(order));
    },

    getOrderStatus: async (p, s, t) => createActions().getOrder(p, s, t),

    getOrderDetails: async (p, _s, t) => {
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('Order not found');
      if (!(await orderAuth(order, t, get(p, 'phone')))) {
        return fail('Unauthorized - Access Denied');
      }
      const settings = await settingsMap();
      const commPct = parseFloat(settings.STATION_COMMISSION_PCT || 15) || 15;
      const commission = (parsePrice(order.price) * (commPct / 100)).toFixed(2);
      const isPaid = order.paymentCompleted === true || String(order.paymentCompleted).toLowerCase() === 'true';
      const driver = order.driverId ? await findDriver({ driverId: order.driverId }) : null;
      return ok({
        orderId: order.orderId,
        driverId: order.driverId,
        status: order.status,
        price: order.price,
        commission,
        pickupDatetime: order.pickupDatetime,
        pickupAddress: order.pickupAddress,
        destinationAddress: order.destinationAddress,
        paymentCompleted: isPaid,
        customerName: isPaid ? order.customerName : 'הושלם תשלום לחשיפה',
        customerPhone: isPaid ? order.customerPhone : null,
        pickupNotes: isPaid ? order.pickupNotes : null,
        destinationNotes: isPaid ? order.destinationNotes : null,
        pickupExactAddress: isPaid ? order.pickupExactAddress : null,
        destinationExactAddress: isPaid ? order.destinationExactAddress : null,
        updatedAt: order.updatedAt,
        serverTime: Date.now(),
        paymentPhone: settings.STATION_PAYMENT_PHONE || '',
        paypalEmail: settings.STATION_PAYPAL_EMAIL || '',
        distanceKm: order.distanceKm,
        duration: order.duration,
        pickupLat: order.pickupLat,
        pickupLng: order.pickupLng,
        destinationLat: order.destinationLat,
        destinationLng: order.destinationLng,
        passengers: order.passengers,
        luggage: order.luggage,
        flightNumber: order.flightNumber,
        paymentMethod: order.paymentMethod,
        driver: driver
          ? {
              name: driver.driverName,
              phone: driver.phone,
              carModel: driver.carType,
              plateNumber: driver.taxiPlateNumber,
            }
          : null,
      });
    },

    getOfferDetails: async (p) => {
      const phone = get(p, 'phone');
      if (!phone) return fail('Phone required for offer details');
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('Order not found');
      return ok({
        orderId: order.orderId,
        status: order.status,
        price: order.price,
        pickupAddress: order.pickupAddress,
        destinationAddress: order.destinationAddress,
        pickupDatetime: order.pickupDatetime,
      });
    },

    updateOrder: async (p, _s, t) => {
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('הזמנה לא נמצאה');
      if (!(await orderAuth(order, t, get(p, 'phone', 'driverPhone')))) {
        if (!isAdmin(t)) return fail('Unauthorized');
      }
      const updates = get(p, 'updates') || {};
      const flat = { ...updates };
      const allowed = [
        'status',
        'price',
        'pickupAddress',
        'destinationAddress',
        'pickupNotes',
        'destinationNotes',
        'paymentMethod',
        'driverId',
        'driverName',
        'driverPhone',
      ];
      const $set = { updatedAt: nowIso() };
      for (const k of allowed) {
        const v = get(flat, k, k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`));
        if (v !== undefined) $set[k] = k === 'status' ? String(v).toLowerCase() : v;
      }
      if (get(p, 'status')) $set.status = String(get(p, 'status')).toLowerCase();
      await collections().orders.updateOne({ orderId: order.orderId }, { $set });
      return ok({ orderId: order.orderId, ...$set });
    },

    cancelOrder: async (p, _s, t) => {
      p.updates = { status: 'cancelled' };
      return createActions().updateOrder(p, null, t);
    },

    acceptRideByPhone: async (p) => {
      const orderId = get(p, 'orderId', 'order_id');
      const phone = get(p, 'phone');
      if (!orderId) return fail('Invalid Order ID');
      if (!phone) return fail('Invalid Phone Number');
      const driver = await findDriver({ phone });
      if (!driver) return fail('NOT_REGISTERED');
      if (driver.status !== 'active') return fail('DRIVER_NOT_ACTIVE');
      return assignDriverToOrder(orderId, driver);
    },

    acceptOrder: async (p, s, t) => createActions().acceptRideByPhone(p, s, t),

    acceptByTelegramWebApp: async (p) => {
      const telegramId = String(get(p, 'telegramId', 'telegram_id') || '').trim();
      const driver = await collections().drivers.findOne({ telegramId });
      if (!driver) return fail('NOT_REGISTERED');
      if (driver.status !== 'active') return fail('DRIVER_NOT_ACTIVE');
      return assignDriverToOrder(get(p, 'orderId', 'order_id'), driver);
    },

    assignDriver: async (p) => {
      const driver = await findDriver({
        phone: get(p, 'phone'),
        driverId: get(p, 'driverId', 'driver_id'),
      });
      if (!driver) return fail('NOT_REGISTERED');
      return assignDriverToOrder(get(p, 'orderId', 'order_id'), driver, get(p, 'driverName'));
    },

    unassignDriver: async (p) => {
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('הזמנה לא נמצאה');
      await collections().orders.updateOne(
        { orderId: order.orderId },
        {
          $set: {
            status: 'pending',
            updatedAt: nowIso(),
          },
          $unset: { driverId: '', driverName: '', driverPhone: '', driverCarPlate: '' },
        }
      );
      return ok({ orderId: order.orderId, status: 'pending' });
    },

    completeOrder: async (p, _s, t) => {
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('הזמנה לא נמצאה');
      const settings = await settingsMap();
      const commPct = parseFloat(settings.STATION_COMMISSION_PCT || 15) || 15;
      const fullPrice = parsePrice(order.price);
      const commission = fullPrice * (commPct / 100);
      const driverProfit = fullPrice - commission;
      if (String(order.status).toLowerCase() === 'completed') {
        return ok({
          orderId: order.orderId,
          fullPrice,
          commission,
          driverProfit,
          paymentPhone: settings.STATION_PAYMENT_PHONE,
          paypalEmail: settings.STATION_PAYPAL_EMAIL,
        }, { message: 'הזמנה זו כבר הושלמה בעבר' });
      }
      if (!(await orderAuth(order, t, get(p, 'phone', 'driverPhone'))) && !isAdmin(t)) {
        return fail('Unauthorized');
      }
      await collections().orders.updateOne(
        { orderId: order.orderId },
        {
          $set: {
            status: 'completed',
            commission,
            driverProfit,
            completedAt: nowIso(),
            updatedAt: nowIso(),
          },
        }
      );
      if (order.driverId) {
        await collections().drivers.updateOne(
          { driverId: order.driverId },
          { $inc: { totalRides: 1, totalRevenue: fullPrice } }
        );
      }
      return ok({
        orderId: order.orderId,
        fullPrice,
        commission,
        driverProfit,
        paymentPhone: settings.STATION_PAYMENT_PHONE,
        paypalEmail: settings.STATION_PAYPAL_EMAIL,
      });
    },

    markPaymentCompleted: async (p, _s, t) => {
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('הזמנה לא נמצאה');
      if (!isAdmin(t) && !(await orderAuth(order, t, get(p, 'phone')))) {
        return fail('Unauthorized');
      }
      await collections().orders.updateOne(
        { orderId: order.orderId },
        { $set: { paymentCompleted: true, paymentStatus: 'paid', updatedAt: nowIso() } }
      );
      return ok({ orderId: order.orderId, paymentCompleted: true });
    },

    markPayment: async (p, s, t) => createActions().markPaymentCompleted(p, s, t),

    getPaymentInfo: async () => {
      const s = await settingsMap();
      return ok({
        paymentPhone: s.STATION_PAYMENT_PHONE || '',
        paypalEmail: s.STATION_PAYPAL_EMAIL || '',
        commissionPct: s.STATION_COMMISSION_PCT || 15,
      });
    },

    resendOrderDetails: async (p) => {
      const order = await findOrder(get(p, 'orderId', 'order_id'));
      if (!order) return fail('Order not found');
      if (!order.driverId) return fail('Driver not found for this order');
      return ok(null, { message: 'Order details resent to driver' });
    },

    getOrdersDelta: async (p) => {
      const lastSync = get(p, 'lastSync') ? new Date(get(p, 'lastSync')).getTime() : 0;
      const limit = parseInt(get(p, 'limit') || 50, 10) || 50;
      const list = await collections()
        .orders.find({})
        .sort({ updatedAt: -1 })
        .toArray();
      const delta = list
        .filter((o) => {
          const t = Math.max(
            new Date(o.updatedAt || 0).getTime(),
            new Date(o.createdAt || 0).getTime(),
            new Date(o.completedAt || 0).getTime()
          );
          return t > lastSync;
        })
        .slice(0, limit)
        .map(stripDoc);
      return ok({ orders: delta, syncedAt: nowIso(), totalDelta: delta.length });
    },

    getCustomerOrders: async (p) => {
      const phone = normalizePhone(get(p, 'phone'));
      const list = await collections()
        .orders.find({ customerPhone: phone })
        .sort({ createdAt: -1 })
        .toArray();
      return ok({ items: list.map(stripDoc), total: list.length });
    },

    getPassengerHistory: async (p, _s, t) => {
      const passenger = await isPassenger(t);
      const phone = normalizePhone(get(p, 'phone') || passenger?.phone);
      const page = parseInt(get(p, 'page') || 1, 10) || 1;
      const limit = parseInt(get(p, 'limit') || 10, 10) || 10;
      const list = await collections()
        .orders.find({ customerPhone: phone })
        .sort({ createdAt: -1 })
        .toArray();
      const start = (page - 1) * limit;
      return ok({ items: list.slice(start, start + limit).map(stripDoc), total: list.length });
    },

    getDrivers: async (p) => {
      const offset = parseInt(get(p, 'offset') || 0, 10) || 0;
      const limit = Math.min(parseInt(get(p, 'limit') || 50, 10) || 50, 200);
      const all = await collections()
        .drivers.find({ status: { $ne: 'deleted' } })
        .toArray();
      const items = all.map(stripDoc).slice(offset, offset + limit);
      return ok({ items, total: all.length, hasMore: offset + limit < all.length });
    },

    getDriver: async (p) => {
      const d = await findDriver({ driverId: get(p, 'id', 'driverId', 'driver_id') });
      if (!d || d.status === 'deleted') return fail('Not found');
      return ok(stripDoc(d));
    },

    registerDriver: async (p, _s, t) => {
      const phone = normalizePhone(get(p, 'phone'));
      const driverName = get(p, 'driverName', 'driver_name');
      if (!phone || !driverName) return fail('Missing driver name or phone');
      const existing = await findDriver({ phone });
      if (existing && existing.status !== 'deleted') {
        return fail('נהג עם מספר זה כבר רשום');
      }
      const n = (await collections().drivers.countDocuments()) + 1001;
      const driverId = `DRV-${n}`;
      const status = isAdmin(t) ? 'active' : 'pending_approval';
      const doc = {
        driverId,
        driverName,
        phone,
        telegramId: String(get(p, 'telegramId', 'telegram_id') || ''),
        telegramUsername: get(p, 'telegramUsername', 'telegram_username') || '',
        status,
        serviceArea: get(p, 'serviceArea', 'service_area') || '',
        licenseNumber: get(p, 'licenseNumber', 'license_number') || '',
        taxiPlateNumber: get(p, 'taxiPlateNumber', 'taxi_plate_number') || '',
        sessionSecret: randomSecret(),
        totalRides: 0,
        totalRevenue: 0,
        debt: 0,
        isOnline: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await collections().drivers.insertOne(doc);
      return ok({ driverId, status });
    },

    registerDriverSelf: async (p, s, t) => createActions().registerDriver(p, s, t),

    getDriverPortalData: async (p, _s, t) => {
      const driver = await isDriver(t || get(p, 'token', 'authToken'));
      if (!driver) return fail('Invalid or expired token');
      const page = Math.max(1, parseInt(get(p, 'page') || 1, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(get(p, 'limit') || 20, 10) || 20));
      const mine = await collections()
        .orders.find({ driverId: driver.driverId })
        .sort({ createdAt: -1 })
        .toArray();
      const completed = mine.filter((o) => ['completed', 'paid'].includes(String(o.status).toLowerCase()));
      const cancelled = mine.filter((o) => String(o.status).toLowerCase() === 'cancelled');
      const denom = completed.length + cancelled.length;
      const start = (page - 1) * limit;
      return ok({
        driver: stripDoc(driver),
        stats: {
          totalRides: mine.length,
          totalEarnings: mine.reduce((a, o) => a + parsePrice(o.price), 0),
          completionRate: denom ? Math.round((completed.length / denom) * 100) : 100,
        },
        recentRides: mine.slice(start, start + limit).map(stripDoc),
      });
    },

    updateDriverLocation: async (p) => {
      const driverId = get(p, 'driverId', 'driver_id');
      const lat = parseFloat(get(p, 'lat'));
      const lng = parseFloat(get(p, 'lng', 'lng'));
      if (!driverId || Number.isNaN(lat) || Number.isNaN(lng)) return fail('Missing fields');
      await collections().drivers.updateOne(
        { driverId },
        { $set: { lat, lng, lastUpdate: nowIso(), lastHeartbeat: Date.now(), updatedAt: nowIso() } }
      );
      return ok({ driverId, lat, lng });
    },

    updateLocation: async (p, s, t) => createActions().updateDriverLocation(p, s, t),

    updateDriverProfile: async (p, _s, t) => {
      const driver = await isDriver(t);
      const updates = get(p, 'updates') || p;
      const driverId = driver?.driverId || get(p, 'driverId', 'driver_id');
      if (!driverId) return fail('Missing driverId');
      const $set = { updatedAt: nowIso() };
      for (const k of ['driverName', 'serviceArea', 'carType', 'email', 'telegramId']) {
        if (updates[k] !== undefined) $set[k] = updates[k];
      }
      await collections().drivers.updateOne({ driverId }, { $set });
      return ok({ driverId });
    },

    /** Driver online/offline/busy (driver app). */
    updateStatus: async (p) => {
      const driverId = get(p, 'driverId', 'driver_id');
      const status = String(get(p, 'status') || '').toLowerCase();
      if (!driverId || !status) return fail('Missing fields');
      if (!['online', 'offline', 'busy'].includes(status)) return fail('Invalid status');
      const driver = await findDriver({ driverId });
      if (!driver) return fail('Driver not found');
      if (String(driver.status).toLowerCase() === 'blocked') return fail('Account blocked. Contact admin.');
      if (String(driver.status).toLowerCase() === 'pending_approval') return fail('Account pending approval.');
      await collections().drivers.updateOne(
        { driverId },
        { $set: { isOnline: status === 'online', onlineStatus: status, lastHeartbeat: Date.now(), updatedAt: nowIso() } }
      );
      return ok({ driverId, status });
    },

    driverStatus: async (p, s, t) => createActions().updateStatus(p, s, t),

    /** Admin account status: active / blocked / pending_approval. */
    updateDriverStatus: async (p) => {
      const driverId = get(p, 'driverId', 'driver_id');
      const status = String(get(p, 'status') || '').toLowerCase();
      if (!driverId || !status) return fail('Missing fields');
      const allowed = ['active', 'blocked', 'pending_approval', 'deleted', 'online', 'offline', 'busy'];
      if (!allowed.includes(status)) return fail('Invalid status');
      if (['online', 'offline', 'busy'].includes(status)) {
        return createActions().updateStatus(p);
      }
      const $set = { status, updatedAt: nowIso() };
      if (status === 'blocked' || status === 'deleted') $set.isOnline = false;
      await collections().drivers.updateOne({ driverId }, { $set });
      return ok({ driverId, status });
    },

    deleteDriver: async (p) => {
      const driverId = get(p, 'driverId', 'driver_id');
      await collections().drivers.updateOne(
        { driverId },
        { $set: { status: 'deleted', updatedAt: nowIso() } }
      );
      return ok({ driverId, status: 'deleted' });
    },

    getPendingDrivers: async () => {
      const items = await collections()
        .drivers.find({ status: 'pending_approval' })
        .toArray();
      return ok({ items: items.map(stripDoc), total: items.length });
    },

    approveDriver: async (p) => {
      const driverId = get(p, 'driverId', 'driver_id');
      await collections().drivers.updateOne(
        { driverId },
        { $set: { status: 'active', updatedAt: nowIso() } }
      );
      return ok({ driverId, status: 'active' });
    },

    rejectDriver: async (p) => {
      const driverId = get(p, 'driverId', 'driver_id');
      await collections().drivers.updateOne(
        { driverId },
        { $set: { status: 'blocked', rejectReason: get(p, 'reason') || '', updatedAt: nowIso() } }
      );
      return ok({ driverId, status: 'blocked' });
    },

    clearDriverDebt: async (p) => {
      const driverId = get(p, 'driverId', 'driver_id');
      await collections().drivers.updateOne({ driverId }, { $set: { debt: 0, updatedAt: nowIso() } });
      return ok({ driverId, debt: 0 });
    },

    blockUser: async (p) => {
      const userId = get(p, 'userId', 'driverId', 'driver_id');
      await collections().drivers.updateOne(
        { driverId: userId },
        { $set: { status: 'blocked', blockReason: get(p, 'reason') || '', updatedAt: nowIso() } }
      );
      return ok({ userId, status: 'blocked' });
    },

    saveFcmToken: async (p, _s, t) => {
      const driver = await isDriver(t);
      const driverId = get(p, 'driverId', 'driver_id');
      const fcmToken = get(p, 'fcmToken', 'fcm_token');
      if (!driverId || !fcmToken) return fail('Missing driverId or fcmToken');
      if (!driver || !compareIds(driver.driverId, driverId)) return fail('Unauthorized');
      await collections().drivers.updateOne(
        { driverId },
        { $set: { fcmToken, fcmUpdatedAt: nowIso(), updatedAt: nowIso() } }
      );
      return ok({ driverId });
    },

    getSystemSettings: async () => ok(await publicSettings()),
    getSettings: async () => ok(await publicSettings()),

    saveSettings: async (p) => {
      const incoming = get(p, 'settings') || p;
      const { settings } = collections();
      for (const [key, value] of Object.entries(incoming)) {
        if (['action', 'authToken', 'payload'].includes(key)) continue;
        await settings.updateOne(
          { _id: key },
          { $set: { key, value: String(value ?? '') } },
          { upsert: true }
        );
      }
      return ok(await publicSettings());
    },

    getDashboardStats: async () => ok(await computeStats()),
    getStats: async () => ok(await computeStats()),

    getDashboardBundle: async (p) => {
      const limit = parseInt(get(p, 'limit') || 30, 10) || 30;
      const ordersRes = await createActions().getOrders({ limit, pageSize: limit, status: get(p, 'status') });
      const stats = await computeStats();
      const driversRes = await createActions().getDrivers({ limit: 100 });
      const settings = await publicSettings();
      return ok({
        orders: ordersRes.data?.items || [],
        stats,
        drivers: driversRes.data?.items || [],
        settings,
        fetchedAt: nowIso(),
      });
    },

    getMapData: async () => {
      const orders = await collections()
        .orders.find({ status: { $in: [...activeOrderStatuses] } })
        .toArray();
      const drivers = await collections()
        .drivers.find({ status: { $ne: 'deleted' } })
        .toArray();
      return ok({ orders: orders.map(stripDoc), drivers: drivers.map(stripDoc) });
    },

    getSystemHealth: async () => {
      const s = await settingsMap();
      return ok({
        mongo: true,
        source: 'mongodb',
        bridge_url: s.WHATSAPP_BRIDGE_URL || process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3000',
        render_url: s.WHATSAPP_RENDER_URL || '',
        has_firebase: false,
        timestamp: nowIso(),
      });
    },

    calculatePrice: async (p) => {
      const lat1 = parseFloat(get(p, 'pickupLat', 'pickup_lat'));
      const lng1 = parseFloat(get(p, 'pickupLng', 'pickup_lng'));
      const lat2 = parseFloat(get(p, 'destLat', 'destinationLat', 'destination_lat'));
      const lng2 = parseFloat(get(p, 'destLng', 'destinationLng', 'destination_lng'));
      let distanceKm = 12;
      if ([lat1, lng1, lat2, lng2].every((n) => Number.isFinite(n))) {
        distanceKm = Math.max(1, haversineKm(lat1, lng1, lat2, lng2));
      }
      const price = Math.max(40, Math.round(12 * distanceKm + 25));
      const mins = Math.max(10, Math.round(distanceKm * 2.2));
      return ok({
        distanceKm: Math.round(distanceKm * 10) / 10,
        duration: `${mins} דקות`,
        price,
        source: 'mongo-fallback',
      });
    },

    searchAddress: async (p) => {
      const q = String(get(p, 'q') || '').trim();
      if (q.length < 2) return ok([]);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=he&q=${encodeURIComponent(q)}`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'TAXIPRO-MONIT2/1.0 (local-dev)' },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) return ok([]);
        const json = await resp.json();
        const mapped = (json || []).map((h) => ({
          display_name: h.display_name,
          lat: h.lat,
          lon: h.lon,
          lng: h.lon,
        }));
        return ok(mapped);
      } catch {
        return ok([]);
      }
    },

    getTaxiNews: async () => ok([]),
    getNews: async () => ok([]),

    getDailyReport: async (p) => {
      const date = get(p, 'date') ? startOfDay(new Date(get(p, 'date'))) : startOfDay();
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const items = await collections()
        .orders.find({ createdAt: { $gte: date.toISOString(), $lt: next.toISOString() } })
        .toArray();
      const revenue = items.reduce((a, o) => a + parsePrice(o.price), 0);
      return ok({ date: date.toISOString().slice(0, 10), items: items.map(stripDoc), total: items.length, revenue });
    },

    generateMonthlyReport: async (p) => {
      const month = parseInt(get(p, 'month') || new Date().getMonth() + 1, 10);
      const year = parseInt(get(p, 'year') || new Date().getFullYear(), 10);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      const q = { createdAt: { $gte: start.toISOString(), $lt: end.toISOString() } };
      const driverId = get(p, 'driverId', 'driver_id');
      if (driverId && driverId !== 'all') q.driverId = driverId;
      const items = await collections().orders.find(q).toArray();
      return ok({ month, year, items: items.map(stripDoc), total: items.length });
    },

    getRevenueStats: async (p) => {
      const period = get(p, 'period') || 'week';
      const stats = await computeStats();
      const revenue =
        period === 'day' ? stats.revenueToday : period === 'month' ? stats.revenueMonthly : stats.revenueWeekly;
      return ok({ period, revenue, stats });
    },

    getDemandHeatmap: async () => {
      const orders = await collections().orders.find({ pickupLat: { $ne: null } }).toArray();
      const points = orders
        .filter((o) => o.pickupLat && o.pickupLng)
        .map((o) => ({ lat: o.pickupLat, lng: o.pickupLng, weight: 1 }));
      return ok({ points });
    },

    getHeatmapData: async (p, s, t) => createActions().getDemandHeatmap(p, s, t),

    getDriverLeaderboard: async () => {
      const items = await collections()
        .drivers.find({ status: { $ne: 'deleted' } })
        .sort({ totalRevenue: -1 })
        .limit(20)
        .toArray();
      return ok({ items: items.map(stripDoc) });
    },

    checkDocumentExpiry: async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);
      const drivers = await collections().drivers.find({ status: { $ne: 'deleted' } }).toArray();
      const alerts = drivers.filter((d) => {
        const dates = [d.insuranceExpiry, d.licenseExpiry, d.carDocExpiry].filter(Boolean);
        return dates.some((x) => new Date(x) <= soon);
      }).map(stripDoc);
      return ok(alerts);
    },

    generateCommissionReport: async (p) => {
      const startDate = get(p, 'startDate') || startOfDay().toISOString();
      const endDate = get(p, 'endDate') || nowIso();
      const q = { createdAt: { $gte: startDate, $lte: endDate } };
      const driverId = get(p, 'driverId', 'driver_id');
      if (driverId && driverId !== 'all') q.driverId = driverId;
      const items = await collections().orders.find(q).toArray();
      const settings = await settingsMap();
      const commPct = parseFloat(settings.STATION_COMMISSION_PCT || 15) || 15;
      const rows = items.map((o) => ({
        ...stripDoc(o),
        commission: parsePrice(o.price) * (commPct / 100),
      }));
      return ok({ items: rows, total: rows.length, commissionPct: commPct });
    },

    submitRating: async (p) => {
      const doc = {
        ratingId: `RT-${crypto.randomBytes(4).toString('hex')}`,
        orderId: get(p, 'orderId', 'order_id'),
        driverId: get(p, 'driverId', 'driver_id'),
        rating: parseFloat(get(p, 'rating')),
        comment: get(p, 'comment') || '',
        createdAt: nowIso(),
      };
      await collections().ratings.insertOne(doc);
      return ok(doc);
    },

    setupSystem: async () => ok({ message: 'Mongo collections already seeded on connect' }),

    getFirebaseToken: async () =>
      fail('Firebase Auth not configured on Mongo API (realtime stays on the Firebase client)'),

    getMarketingStats: async () => ok({}),
    fetchFacebookAdsData: async () => ok({}),
    exportCampaignStats: async () => ok({}),
    setTelegramWebhook: async () => ok({ message: 'not configured on Mongo API' }),
    deleteTelegramWebhook: async () => ok({ message: 'not configured on Mongo API' }),
    openBridgeFolder: async () => fail('Use SETUP-BRIDGE.bat on the local machine'),
    pickBridgeFolder: async () => fail('Use SETUP-BRIDGE.bat on the local machine'),
    proxyBridgeStatus: async (p) => {
      const url = String(get(p, 'bridgeUrl', 'bridge_url') || '').replace(/\/$/, '');
      if (!url) return fail('No Bridge URL provided');
      try {
        const host = new URL(url).hostname.toLowerCase();
        const allowed = ['localhost', '127.0.0.1', 'onrender.com', 'ngrok.io', 'trycloudflare.com'];
        const okHost = allowed.some((d) => host === d || host.endsWith('.' + d));
        if (!okHost) return fail('Domain not authorized for proxy');
        const resp = await fetch(`${url}/status`, { signal: AbortSignal.timeout(5000) });
        const json = await resp.json().catch(() => ({}));
        return resp.ok ? ok(json) : fail(`Bridge error: ${resp.status}`);
      } catch (e) {
        return fail(e.message || 'Bridge unreachable');
      }
    },
  };
}

async function assignDriverToOrder(orderId, driver, driverName) {
  const order = await findOrder(orderId);
  if (!order) return fail('הזמנה לא נמצאה');
  const taken = ['assigned', 'in_progress', 'completed', 'paid'].includes(String(order.status).toLowerCase());
  if (taken && order.driverId && !compareIds(order.driverId, driver.driverId)) {
    return { ok: false, error: 'TAKEN', takenBy: order.driverName || order.driverId };
  }
  await collections().orders.updateOne(
    { orderId: order.orderId },
    {
      $set: {
        status: 'assigned',
        driverId: driver.driverId,
        driverName: driverName || driver.driverName,
        driverPhone: driver.phone,
        driverCarPlate: driver.taxiPlateNumber,
        updatedAt: nowIso(),
      },
    }
  );
  return ok({
    orderId: order.orderId,
    driverId: driver.driverId,
    driverName: driver.driverName,
    status: 'assigned',
  });
}
