import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Universal Haptic Feedback Utility
 * Supports Capacitor (Native), Telegram WebApp, and Fallback (Web Vibrate)
 */
export const hapticFeedback = {
    /**
     * Successful action or completion
     */
    success: async () => {
        // 1. Try Capacitor (Native)
        try {
            await Haptics.notification({ type: NotificationType.Success });
        } catch (e) {
            // 2. Fallback to Telegram WebApp
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            } else {
                // 3. Last fallback: Standard Web Vibrate
                if (navigator.vibrate) {
                    navigator.vibrate([10, 30, 10]);
                }
            }
        }
    },

    /**
     * Minor impact (e.g. selection change, button click)
     */
    impact: async (style: ImpactStyle = ImpactStyle.Light) => {
        try {
            await Haptics.impact({ style });
        } catch (e) {
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred(style === ImpactStyle.Heavy ? 'heavy' : 'light');
            } else {
                if (navigator.vibrate) {
                    navigator.vibrate(style === ImpactStyle.Heavy ? 20 : 10);
                }
            }
        }
    },

    /**
     * Warning or Error
     */
    warning: async () => {
        try {
            await Haptics.notification({ type: NotificationType.Warning });
        } catch (e) {
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('warning');
            }
        }
    },

    error: async () => {
        try {
            await Haptics.notification({ type: NotificationType.Error });
        } catch (e) {
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('error');
            } else {
                if (navigator.vibrate) {
                    navigator.vibrate([50, 100, 50, 100, 50]);
                }
            }
        }
    }
};
