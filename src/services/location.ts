import { registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import { updateOrderDriverLocation } from './firebase';
import { LOCATION_MIN_DISTANCE_M, LOCATION_MIN_INTERVAL_MS } from '../utils/perf';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const startBackgroundTracking = async (orderId: string, driverId?: string) => {
    if (!orderId) return;

    try {
        // 1. Check/Request Permissions
        const watcherId = await BackgroundGeolocation.addWatcher(
            {
                backgroundMessage: "מוניטיל עוקב אחר המיקום שלך לצורך נסיעה פעילה.",
                backgroundTitle: "מעקב נסיעה פעיל",
                requestPermissions: true,
                stale: false,
                distanceFilter: LOCATION_MIN_DISTANCE_M
            },
            async (location, error) => {
                if (error) {
                    if (error.code === "NOT_AUTHORIZED") {
                        if (window.confirm("אנא אשרו גישה למיקום 'בכל עת' כדי להמשיך לעקוב אחר הנסיעה גם כשהמסך כבוי.")) {
                            BackgroundGeolocation.openSettings();
                        }
                    }
                    return;
                }

                if (location) {
                    await updateOrderDriverLocation(orderId, {
                        lat: location.latitude,
                        lng: location.longitude,
                        heading: (location as any).bearing || 0
                    }, driverId);
                }
            }
        );

        return watcherId;
    } catch (e) {
        console.warn("Background Geolocation not supported or failed", e);

        // 2. Fallback to Browser Geolocation (Web/Telegram)
        if (navigator.geolocation) {
            const id = navigator.geolocation.watchPosition(
                async (pos) => {
                    await updateOrderDriverLocation(orderId, {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        heading: pos.coords.heading || 0
                    }, driverId);
                },
                (err) => console.error("Web Geolocation error", err),
                {
                    enableHighAccuracy: true,
                    maximumAge: LOCATION_MIN_INTERVAL_MS,
                    timeout: 15000
                }
            );
            return `web-${id}`;
        }
    }
};

export const stopBackgroundTracking = async (watcherId: string) => {
    if (!watcherId) return;

    if (watcherId.startsWith('web-')) {
        const id = parseInt(watcherId.split('-')[1]);
        navigator.geolocation.clearWatch(id);
        return;
    }

    try {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
    } catch (e) {
        console.error("Failed to stop background tracking", e);
    }
};
