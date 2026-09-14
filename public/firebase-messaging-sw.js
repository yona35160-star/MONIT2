/**
 * Firebase Messaging Service Worker
 * 
 * This file MUST be placed in the PUBLIC root directory (e.g., /public/firebase-messaging-sw.js)
 * It handles background push notifications when the app is not in focus.
 * 
 * IMPORTANT: Replace the firebaseConfig values with your own!
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Fetch config from URL parameters injected during registration
const urlParams = new URLSearchParams(location.search);
const firebaseConfig = {
    apiKey: urlParams.get('apiKey'),
    authDomain: urlParams.get('authDomain'),
    projectId: urlParams.get('projectId'),
    storageBucket: urlParams.get('storageBucket'),
    messagingSenderId: urlParams.get('messagingSenderId'),
    appId: urlParams.get('appId')
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Received background message:', payload);

    // If there's no notification object but there's data, we still want to alert the user
    const title = payload.notification?.title || payload.data?.title || '🚖 נסיעה חדשה!';
    const body = payload.notification?.body || payload.data?.body || 'יש נסיעה חדשה זמינה במערכת';
    
    const notificationOptions = {
        body: body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: payload.data?.orderId || 'taxi-notification',
        data: {
            ...payload.data,
            receivedAt: Date.now()
        },
        vibrate: [200, 100, 200],
        requireInteraction: true, // Keep notification until user interacts
        actions: [
            { action: 'open', title: 'פתח נסיעה' },
            { action: 'dismiss', title: 'התעלם' }
        ]
    };

    return self.registration.showNotification(title, notificationOptions).catch(err => {
        console.error('[SW] Error showing notification:', err);
    });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    if (event.action === 'dismiss') return;

    // Determine target URL - prioritize deep link to order
    let urlToOpen = '/';
    if (event.notification.data?.orderId) {
        // Construct URL based on known routes
        urlToOpen = `/complete-ride?orderId=${event.notification.data.orderId}`;
    } else if (event.notification.data?.url) {
        urlToOpen = event.notification.data.url;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // 1. Try to find an existing window and navigate it
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin)) {
                    if ('focus' in client) {
                        client.focus();
                        // If it's a specific order, we might want to navigate
                        if (event.notification.data?.orderId && 'navigate' in client) {
                            client.navigate(urlToOpen);
                        }
                        return;
                    }
                }
            }
            // 2. If no window exists, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        }).catch(err => {
            console.error('[SW] Window match/open failed:', err);
        })
    );
});
