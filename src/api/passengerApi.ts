import {
  ApiResponse,
  CreateOrderPayload,
  CalculatePricePayload,
  Order,
  Rating,
  SystemSettings
} from '../types';
import { sendToBackend, initializeApiUrl, searchAddress, toCamelCase, toSnakeCase, compareIds } from './api';

export { initializeApiUrl, sendToBackend, searchAddress, toCamelCase, toSnakeCase, compareIds };

/**
 * Passenger-specific API service
 */
const getPassengerToken = () => localStorage.getItem('taxi_passenger_phone') || '';

export const passengerApi = {
  /**
   * Request OTP for login
   */
  requestOTP: (phone: string): Promise<ApiResponse<any>> =>
    sendToBackend('requestOTP', { phone, type: 'passenger' }),

  /**
   * Verify OTP
   */
  verifyOTP: (phone: string, otp: string): Promise<ApiResponse<any>> =>
    sendToBackend('verifyOTP', { phone, otp, type: 'passenger' }),

  /**
   * Calculate ride price
   */
  calculatePrice: (payload: CalculatePricePayload): Promise<ApiResponse<any>> =>
    sendToBackend('calculatePrice', payload),

  /**
   * Create a new order
   */
  createOrder: (payload: CreateOrderPayload): Promise<ApiResponse<any>> =>
    sendToBackend('createOrder', payload),

  /**
   * Get current status of an order
   */
  getOrderStatus: (orderId: string): Promise<ApiResponse<Order>> =>
    sendToBackend('getOrderStatus', { orderId }),

  /**
   * Submit driver rating
   */
  submitRating: (rating: Partial<Rating>): Promise<ApiResponse<any>> =>
    sendToBackend('submitRating', rating),

  /**
   * Get passenger ride history (MISSING-002)
   */
  getHistory: (page: number = 1, limit: number = 10): Promise<ApiResponse<any>> => {
    const phone = getPassengerToken();
    const token = localStorage.getItem('taxi_passenger_token') || phone;
    return sendToBackend('getPassengerHistory', { phone, page, limit }, { token });
  },

  /**
   * Get system settings (public)
   */
  getSettings: (): Promise<ApiResponse<SystemSettings>> =>
    sendToBackend('getSystemSettings')
};

// Re-exports for backward compatibility
export const requestOTP = passengerApi.requestOTP;
export const verifyOTP = passengerApi.verifyOTP;
export const calculatePrice = passengerApi.calculatePrice;
export const createOrder = passengerApi.createOrder;
export const getOrderStatus = passengerApi.getOrderStatus;
export const submitRating = passengerApi.submitRating;
export const getPassengerHistory = passengerApi.getHistory;
export const getSystemSettings = passengerApi.getSettings;
export const getTaxiNews = () => sendToBackend<any[]>('getTaxiNews');
