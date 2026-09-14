import { ApiResponse, AcceptRidePayload, DriverPortalData, DriverRegistrationPayload, Order, Driver, SystemSettings } from '../types';
import { sendToBackend, initializeApiUrl, toCamelCase, toSnakeCase, compareIds } from './api';

export { initializeApiUrl, sendToBackend, toCamelCase, toSnakeCase, compareIds };

/**
 * Driver-specific API service
 */
const getDriverToken = () => localStorage.getItem('taxi_driver_token') || '';

export const driverApi = {
  /**
   * Register a new driver
   */
  register: (payload: DriverRegistrationPayload): Promise<ApiResponse<any>> =>
    sendToBackend('registerDriver', payload),

  /**
   * Request OTP for driver login
   */
  requestOTP: (phone: string): Promise<ApiResponse<any>> =>
    sendToBackend('requestOTP', { phone, type: 'driver' }),

  /**
   * Verify OTP
   */
  verifyOTP: (phone: string, otp: string): Promise<ApiResponse<any>> =>
    sendToBackend('verifyOTP', { phone, otp, type: 'driver' }),

  /**
   * Get driver portal data (stats and recent rides)
   * MISSING-008: Supports pagination
   */
  getPortalData: (page: number = 1, limit: number = 20): Promise<ApiResponse<DriverPortalData>> => {
    const token = getDriverToken();
    return sendToBackend('getDriverPortalData', { page, limit }, { token });
  },

  /**
   * Update driver's real-time location
   */
  updateLocation: (driverId: string, lat: number, lng: number): Promise<ApiResponse<any>> => {
    const token = getDriverToken();
    return sendToBackend('updateDriverLocation', { driverId, lat, lng }, { token });
  },

  /**
   * Update driver's online/offline status
   * ISSUE-004: Respects spreadsheet status (ACTIVE/BLOCKED)
   */
  updateStatus: (driverId: string, status: string): Promise<ApiResponse<any>> => {
    const token = getDriverToken();
    return sendToBackend('updateStatus', { driverId, status }, { token });
  },

  /**
   * Accept an available ride
   */
  acceptRide: (payload: AcceptRidePayload): Promise<ApiResponse<any>> => {
    const token = getDriverToken();
    return sendToBackend('acceptRideByPhone', payload, { token });
  },

  /**
   * Mark a ride as explicitly completed or reported paid
   */
  completeRide: (orderId: string, phone: string): Promise<ApiResponse<any>> => {
    const token = getDriverToken();
    return sendToBackend('completeOrder', { orderId, phone }, { token });
  },

  /**
   * Get monthly earnings report
   */
  getMonthlyReport: (driverId: string, month: number, year: number): Promise<ApiResponse<any>> => {
    const token = getDriverToken();
    return sendToBackend('generateMonthlyReport', { driverId, month, year }, { token });
  },

  /**
   * Update driver profile details
   */
  updateProfile: (updates: Partial<Driver>): Promise<ApiResponse<any>> => {
    const token = getDriverToken();
    return sendToBackend('updateDriverProfile', { updates }, { token });
  },

  /**
   * Get system settings (public)
   */
  getSettings: (): Promise<ApiResponse<SystemSettings>> =>
    sendToBackend('getSystemSettings')
};

// Re-export for backward compatibility if needed during migration
export const registerDriver = driverApi.register;
export const requestOTP = driverApi.requestOTP;
export const verifyOTP = driverApi.verifyOTP;
export const getDriverPortalData = driverApi.getPortalData;
export const updateDriverLocation = driverApi.updateLocation;
export const updateDriverStatus = driverApi.updateStatus;
export const acceptRideByPhone = driverApi.acceptRide;
export const completeOrder = driverApi.completeRide;
export const generateMonthlyReport = driverApi.getMonthlyReport;
export const updateDriverProfile = driverApi.updateProfile;
export const getSystemSettings = driverApi.getSettings;
export const markPaymentCompleted = (p: { orderId: string, phone: string }) =>
  sendToBackend<any>('markPaymentCompleted', p);

