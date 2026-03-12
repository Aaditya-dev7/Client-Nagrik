// Service Worker for NagrikGPT Citizen App
// Handles push notifications and background sync

const CACHE_NAME = 'nagrik-cache-v1';
const NOTIFICATION_TAG = 'nagrik-notification';

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received:', event);

  let data = {
    title: 'NagrikGPT',
    body: 'You have a new notification',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: NOTIFICATION_TAG,
    data: {
      url: '/',
    },
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = {
        ...data,
        ...pushData,
        title: pushData.title || data.title,
        body: pushData.body || pushData.message || data.body,
        data: {
          url: pushData.url || pushData.data?.url || '/',
          reportId: pushData.reportId || pushData.data?.reportId,
          type: pushData.type || pushData.data?.type,
        },
      };
    } catch (e) {
      console.error('[ServiceWorker] Error parsing push data:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    vibrate: [200, 100, 200], // Vibration pattern
    requireInteraction: true, // Keep notification until user interacts
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    data: data.data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'dismiss') {
    return;
  }

  // Default action or 'view' - open the app
  let urlToOpen = data.url || '/';

  // If there's a report ID, navigate to the report
  if (data.reportId) {
    urlToOpen = `/reports/${data.reportId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open a new window if no existing window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline reports
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event);

  if (event.tag === 'sync-reports') {
    event.waitUntil(syncReports());
  }
});

// Sync reports function
async function syncReports() {
  try {
    const db = await openIndexedDB();
    const pendingReports = await getPendingReports(db);

    for (const report of pendingReports) {
      try {
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report.data),
        });

        if (response.ok) {
          await markReportSynced(db, report.id);
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync report:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// IndexedDB helpers
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nagrik-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-reports')) {
        db.createObjectStore('pending-reports', { keyPath: 'id' });
      }
    };
  });
}

function getPendingReports(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-reports'], 'readonly');
    const store = transaction.objectStore('pending-reports');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function markReportSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-reports'], 'readwrite');
    const store = transaction.objectStore('pending-reports');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SUBSCRIBE_NOTIFICATIONS') {
    // Handle subscription request from main app
    event.ports[0].postMessage({ success: true });
  }
});
