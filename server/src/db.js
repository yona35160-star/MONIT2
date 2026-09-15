import { MongoClient } from 'mongodb';
import crypto from 'node:crypto';
import { nowIso } from './util.js';
import { randomSecret } from './auth.js';

let client;
let db;

export const collections = () => {
  if (!db) throw new Error('MongoDB is not connected');
  return {
    users: db.collection('users'),
    orders: db.collection('orders'),
    drivers: db.collection('drivers'),
    customers: db.collection('customers'),
    settings: db.collection('settings'),
    otps: db.collection('otps'),
    ratings: db.collection('ratings'),
    counters: db.collection('counters'),
  };
};

export const nextOrderId = async () => {
  const { counters } = collections();
  const existing = await counters.findOne({ _id: 'orders' });
  if (!existing) {
    await counters.insertOne({ _id: 'orders', seq: 1000 });
  }
  const doc = await counters.findOneAndUpdate(
    { _id: 'orders' },
    { $inc: { seq: 1 } },
    { returnDocument: 'after' }
  );
  const seq = doc?.seq ?? doc?.value?.seq ?? 1001;
  return `TAXI-${seq}`;
};

const hashPassword = (password) =>
  crypto.createHash('sha256').update(String(password)).digest('hex');

export const verifyPassword = (input, storedHash) => hashPassword(input) === storedHash;

const defaultSettings = () => ({
  STATION_NAME: 'TAXIPRO',
  STATION_PHONE: '0500000000',
  STATION_COMMISSION_PCT: '15',
  STATION_PAYMENT_PHONE: '0500000000',
  STATION_PAYPAL_EMAIL: '',
  ENABLE_AUTO_BOT: 'false',
  APP_URL: 'http://localhost:5273/app.html',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@taxi.co.il',
});

async function seedIfEmpty() {
  const c = collections();
  const settingsCount = await c.settings.countDocuments();
  if (settingsCount === 0) {
    const docs = Object.entries(defaultSettings()).map(([key, value]) => ({ _id: key, key, value }));
    await c.settings.insertMany(docs);
  }

  const usersCount = await c.users.countDocuments();
  if (usersCount === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@taxi.co.il').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '123456';
    await c.users.insertOne({
      email,
      role: 'admin',
      passwordHash: hashPassword(password),
      createdAt: nowIso(),
    });
  }

  const driverCount = await c.drivers.countDocuments();
  if (driverCount === 0) {
    const secret1 = randomSecret();
    const secret2 = randomSecret();
    await c.drivers.insertMany([
      {
        driverId: 'DRV-1001',
        driverName: 'מנהל מערכת',
        phone: '0500000000',
        telegramId: '',
        status: 'active',
        serviceArea: 'מרכז',
        licenseNumber: '123456',
        taxiPlateNumber: '77-888-99',
        carType: 'Taxi',
        isOnline: false,
        email: process.env.ADMIN_EMAIL || 'admin@taxi.co.il',
        totalRides: 0,
        totalRevenue: 0,
        debt: 0,
        averageRating: 5,
        totalRatings: 0,
        sessionSecret: secret1,
        lat: 32.08,
        lng: 34.78,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        driverId: 'DRV-1002',
        driverName: 'נהג בדיקה',
        phone: '0500000002',
        telegramId: '',
        status: 'active',
        serviceArea: 'מרכז',
        licenseNumber: '654321',
        taxiPlateNumber: '11-222-33',
        carType: 'Toyota',
        isOnline: false,
        email: 'driver@example.com',
        totalRides: 0,
        totalRevenue: 0,
        debt: 0,
        averageRating: 5,
        totalRatings: 0,
        sessionSecret: secret2,
        lat: 32.07,
        lng: 34.79,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ]);
  }

  const orderCount = await c.orders.countDocuments();
  if (orderCount === 0) {
    await c.counters.updateOne({ _id: 'orders' }, { $setOnInsert: { seq: 1000 } }, { upsert: true });
    const orderId = await nextOrderId();
    await c.orders.insertOne({
      orderId,
      customerName: 'לקוח נסיון',
      customerPhone: '0500000002',
      pickupAddress: 'תל אביב',
      destinationAddress: 'ירושלים',
      pickupDatetime: nowIso(),
      price: 250,
      status: 'pending',
      paymentCompleted: false,
      paymentMethod: 'cash',
      passengers: '1',
      luggage: '0',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  const customerCount = await c.customers.countDocuments();
  if (customerCount === 0) {
    await c.customers.insertOne({
      phone: '0500000002',
      customerName: 'לקוח נסיון',
      sessionSecret: randomSecret(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
}

export async function connectMongo(uri) {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  db = client.db();
  const c = collections();
  await Promise.all([
    c.orders.createIndex({ orderId: 1 }, { unique: true }),
    c.orders.createIndex({ updatedAt: -1 }),
    c.orders.createIndex({ status: 1 }),
    c.drivers.createIndex({ driverId: 1 }, { unique: true }),
    c.drivers.createIndex({ phone: 1 }),
    c.users.createIndex({ email: 1 }, { unique: true }),
    c.customers.createIndex({ phone: 1 }, { unique: true }),
    c.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  await seedIfEmpty();
  return db;
}

export async function pingMongo() {
  if (!db) return false;
  await db.command({ ping: 1 });
  return true;
}

export async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
}
