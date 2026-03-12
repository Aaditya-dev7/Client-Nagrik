// Push Notifications Utility for NagrikGPT Citizen App

import { getSupabase } from './supabase';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  reportId?: string;
  type?: 'report_update' | 'status_change' | 'comment' | 'general';
}

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!isNotificationSupported()) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    // Request permission first
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      console.error('Failed to register service worker');
      return null;
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Get existing subscription or create new one
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      // Note: You need to generate VAPID keys for your application
      // Get them from tools like https://tools.reactpwa.com/vapid
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured. Push notifications will not work.');
        return null;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    // Save subscription to Supabase
    const sb = getSupabase();
    if (sb) {
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        await sb.from('push_subscriptions').upsert({
          user_id: user.id,
          subscription: subscription.toJSON(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    }

    console.log('Push subscription successful:', subscription);
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Remove from Supabase
      const sb = getSupabase();
      if (sb) {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          await sb.from('push_subscriptions').delete().eq('user_id', user.id);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

// Show local notification (for when app is in foreground)
export async function showLocalNotification(payload: PushNotificationPayload): Promise<void> {
  if (!isNotificationSupported()) return;

  const permission = getNotificationPermission();
  if (permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/favicon.png',
      badge: payload.badge || '/favicon.png',
      tag: payload.tag || 'nagrik-notification',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: {
        url: payload.url || '/',
        reportId: payload.reportId,
        type: payload.type,
      },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Send push notification via Supabase Edge Function
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.functions.invoke('send-push-notification', {
      body: {
        userId,
        notification: payload,
      },
    });

    if (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

// Initialize notifications on app load
export async function initializeNotifications(): Promise<void> {
  if (!isNotificationSupported()) {
    console.log('Notifications not supported on this device');
    return;
  }

  // Check if user has already granted permission
  const permission = getNotificationPermission();
  
  if (permission === 'granted') {
    // Auto-subscribe if permission is granted
    await subscribeToPushNotifications();
  }

  // Register service worker
  await registerServiceWorker();
}
