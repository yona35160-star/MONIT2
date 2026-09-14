import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { sendToBackend } from '../api/api';

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[FCM] Not a native platform, falling back to Web Notifications if supported');
        // Traditional Web Notification check if needed, but for now we focus on Native
        return null;
    }

    try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn('[FCM] Push notification permission denied');
            return null;
        }

        return new Promise((resolve) => {
            // Register with Apple / Google
            PushNotifications.register();

            // On success, we get the token
            PushNotifications.addListener('registration', (token) => {
                console.log('[FCM] Native Token received:', token.value.substring(0, 20) + '...');
                resolve(token.value);
            });

            // On error
            PushNotifications.addListener('registrationError', (error) => {
                console.error('[FCM] Registration error:', error.error);
                resolve(null);
            });
        });
    } catch (error) {
        console.error('[FCM] Error getting native permission/token:', error);
        return null;
    }
};

/**
 * Set up native notification listeners
 */
export const setupNativeNotificationHandlers = () => {
    if (!Capacitor.isNativePlatform()) return;

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[FCM] Push received:', notification);
        // Could trigger an internal app alert or refresh
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[FCM] Push action performed:', notification.actionId, notification.notification);
        // Handle deep linking or specific actions when user taps the notification
    });
};

/**
 * Save FCM token to backend (for server-side push)
 */
export const saveFcmTokenToBackend = async (driverId: string, token: string): Promise<boolean> => {
    try {
        const response = await sendToBackend<any>('saveFcmToken', { driverId, fcmToken: token });
        if (!response.ok) {
            console.error('[FCM] Backend rejected token save:', response.error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('[FCM] Failed to save token:', error);
        return false;
    }
};
