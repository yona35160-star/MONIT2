import {
  ApiResponse,
  Order,
  Driver,
  LoginPayload,
  DashboardStats,
  SystemSettings
} from '../types';
import { sendToBackend, DEFAULT_WEBAPP_URL, toCamelCase, toSnakeCase, compareIds, sendToBackendWithRetry, initializeApiUrl } from './api';

export { DEFAULT_WEBAPP_URL, toCamelCase, toSnakeCase, compareIds, sendToBackend, initializeApiUrl };

/**
 * Admin API Service
 * Dedicated service for Admin Dashboard operations.
 * Isolates admin-only logic from passenger and driver apps.
 */

// --- Auth ---
export const loginAdmin = (payload: LoginPayload) =>
  sendToBackend<{ token: string }>('loginAdmin', payload);

export const logoutAdmin = () =>
  sendToBackend<any>('logoutAdmin');

export const testConnection = () =>
  sendToBackend<{ version: string, message: string }>('testConnection');

export const sendOTP = (phone: string, type: 'passenger' | 'driver' | 'admin' = 'admin') =>
  sendToBackend('requestOTP', { phone, type });

// --- Dashboard & Monitoring ---
export const getDashboardStats = () =>
  sendToBackend<DashboardStats>('getDashboardStats');

export const getDashboardBundle = (limit = 30, status?: string) =>
  sendToBackend<{ orders: Order[], stats: DashboardStats, drivers: Driver[], settings: SystemSettings, fetchedAt: string }>(
    'getDashboardBundle', { limit, status }
  );

export const getOrdersDelta = (lastSync: string, limit = 50) =>
  sendToBackend<{ orders: Order[], syncedAt: string, totalDelta: number }>('getOrdersDelta', { lastSync, limit });

export const getMapData = () =>
  sendToBackend<{ orders: Order[], drivers: Driver[] }>('getMapData');

export const getHeatmapData = () =>
  sendToBackend<any>('getHeatmapData');

export const getSystemHealth = () =>
  sendToBackend<any>('getSystemHealth');

export const getBridgeStatus = (bridgeUrl: string, apiKey: string) => {
  // Re-using core infrastructure if possible, or implementing bridge check
  // For now, mapping to the backend action if applicable, or exported utility
  // Note: Bridge status check resides partly in api.ts as a utility.
  // We'll import the utility or implement here.
  return import('./api').then(api => api.getBridgeStatus(bridgeUrl, apiKey));
};

// --- Driver Management ---
export const getDrivers = (payload: any = {}) =>
  sendToBackend<any>('getDrivers', payload);

export const getDriver = (id: string) =>
  sendToBackend<any>('getDriver', { id });

export const updateDriverStatus = (driverId: string, status: string) =>
  sendToBackend<any>('updateDriverStatus', { driverId, status });

export const updateDriverLocation = (driverId: string, lat: number, lng: number) =>
  sendToBackend<any>('updateDriverLocation', { driverId, lat, lng });

/**
 * Block a user
 */
export const blockUser = (userId: string, reason: string): Promise<ApiResponse<any>> =>
  sendToBackend('blockUser', { userId, reason });

/**
 * Create a new order (from admin dashboard)
 */
export const createOrder = (payload: any): Promise<ApiResponse<any>> =>
  sendToBackend('createOrder', payload);

/**
 * Calculate ride price (from admin dashboard)
 */
export const calculatePrice = (payload: any): Promise<ApiResponse<any>> =>
  sendToBackend('calculatePrice', payload);

export const assignDriver = (p: { orderId: string, phone: string, driverName?: string }) =>
  sendToBackend<any>('assignDriver', p);

export const unassignDriver = (orderId: string) =>
  sendToBackend<any>('unassignDriver', { orderId });

export const clearDriverDebt = (driverId: string) =>
  sendToBackend<any>('clearDriverDebt', { driverId });

// --- Registration & Approval ---
export const getPendingDrivers = (payload: any = {}) =>
  sendToBackend<any>('getPendingDrivers', payload);

export const approveDriver = (payload: { driver_id: string }) =>
  sendToBackend<any>('approveDriver', payload);

export const rejectDriver = (payload: { driver_id: string, reason?: string }) =>
  sendToBackend<any>('rejectDriver', payload);

// --- Order Management ---
export const getOrders = (payload: any = {}) =>
  sendToBackend<any>('getOrders', payload);

export const getOrderStatus = (orderId: string) =>
  sendToBackend<any>('getOrderStatus', { orderId });

export const updateOrder = (orderId: string, updates: any) =>
  sendToBackend<any>('updateOrder', { orderId, updates });

export const completeOrder = (orderId: string, phone: string) =>
  sendToBackend<any>('completeOrder', { orderId, phone });

export const markPaymentCompleted = (p: { orderId: string, phone: string }) =>
  sendToBackend<any>('markPaymentCompleted', p);

export const resendOrderDetails = (orderId: string) =>
  sendToBackend<any>('resendOrderDetails', { orderId });

// --- Settings & System ---
export const getSystemSettings = () =>
  sendToBackend<SystemSettings>('getSystemSettings', {});

export const getSystemSettingsRaw = (params: any = {}) =>
  sendToBackend<SystemSettings>('getSystemSettings', params);

export const saveSettings = (settings: any) =>
  sendToBackend<any>('saveSettings', { settings });

export const getDailyReport = (date?: string) =>
  sendToBackend<any>('getDailyReport', { date });

export const generateMonthlyReport = (payload: any) =>
  sendToBackend<any>('generateMonthlyReport', payload);

export const setTelegramWebhook = (url: string) =>
  sendToBackend<any>('setTelegramWebhook', { url });

export const deleteTelegramWebhook = () =>
  sendToBackend<any>('deleteTelegramWebhook', {});

export const openBridgeFolder = () => sendToBackend<any>('openBridgeFolder');
export const pickBridgeFolder = () => sendToBackend<any>('pickBridgeFolder');

export const getTaxiNews = () => sendToBackend<any>('getTaxiNews');

// --- Analytics & Fleet Management ---
export const getRevenueStats = (period: 'day' | 'week' | 'month' = 'week') =>
  sendToBackend<any>('getRevenueStats', { period });

export const getDemandHeatmap = () =>
  sendToBackend<any>('getDemandHeatmap');

export const getDriverLeaderboard = () =>
  sendToBackend<any>('getDriverLeaderboard');

export const checkDocumentExpiry = () =>
  sendToBackend<any>('checkDocumentExpiry');

export const generateCommissionReport = (payload: { driverId: string | 'all', startDate: string, endDate: string }) =>
  sendToBackend<any>('generateCommissionReport', payload);
