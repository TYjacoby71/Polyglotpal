/**
 * notificationService.js
 *
 * Handles push notifications for both Android and iOS.
 * Uses @notifee/react-native (recommended over react-native-push-notification
 * for modern React Native + both platforms).
 *
 * Install: npm install @notifee/react-native
 * Android: auto-linked
 * iOS: cd ios && pod install
 */
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
  RepeatFrequency,
  AuthorizationStatus,
} from '@notifee/react-native';
import { notificationAPI } from './api';

const CHANNEL_ID = 'polyglotpal_sessions';

// ── Setup ────────────────────────────────────────────────────────────────

export async function setupNotifications() {
  // Create Android channel (required for Android 8+)
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Practice Sessions',
    description: 'PolyglotPal conversation prompts',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: true,
  });

  // Request iOS permissions
  const settings = await notifee.requestPermission({
    sound: true,
    badge: true,
    alert: true,
  });

  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

// ── Schedule the next notification ───────────────────────────────────────

export async function scheduleNextNotification() {
  try {
    const { notif_id, content, scheduled_at, type } = await notificationAPI.getNext();

    const triggerDate = new Date(scheduled_at);

    await notifee.createTriggerNotification(
      {
        id: notif_id,
        title: 'PolyglotPal',
        body: content,
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'open', launchActivity: 'default' },
          actions: [
            { title: '💬 Talk', pressAction: { id: 'talk' } },
            { title: '⏰ Later', pressAction: { id: 'snooze' } },
          ],
          smallIcon: 'ic_notification', // must exist in android/app/src/main/res/
        },
        ios: {
          sound: 'default',
          categoryId: 'session',
          foregroundPresentationOptions: { alert: true, sound: true },
        },
        data: { notif_id, type },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
      }
    );

    return { scheduled_at, content };
  } catch (err) {
    console.error('Failed to schedule notification:', err);
    return null;
  }
}

// ── Handle foreground events ──────────────────────────────────────────────

export function setupForegroundHandler(onTalk) {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    const { EventType } = require('@notifee/react-native');
    const notifId = detail.notification?.data?.notif_id;

    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction?.id;

      if (actionId === 'talk' || actionId === 'open') {
        if (notifId) notificationAPI.recordEvent(notifId, 'opened').catch(() => {});
        onTalk?.();
      }
      if (actionId === 'snooze') {
        if (notifId) notificationAPI.recordEvent(notifId, 'snoozed').catch(() => {});
        // Reschedule 30 min later
        const snoozedAt = Date.now() + 30 * 60 * 1000;
        await notifee.createTriggerNotification(
          { ...detail.notification, id: `${notifId}_snoozed` },
          { type: TriggerType.TIMESTAMP, timestamp: snoozedAt }
        );
      }
    }

    if (type === EventType.DISMISSED) {
      if (notifId) notificationAPI.recordEvent(notifId, 'ignored').catch(() => {});
    }
  });
}

// ── Handle background / killed state ─────────────────────────────────────

export function setupBackgroundHandler() {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { EventType } = require('@notifee/react-native');
    const notifId = detail.notification?.data?.notif_id;

    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'snooze') {
      if (notifId) notificationAPI.recordEvent(notifId, 'snoozed').catch(() => {});
    }
    if (type === EventType.DISMISSED) {
      if (notifId) notificationAPI.recordEvent(notifId, 'ignored').catch(() => {});
    }
  });
}

// ── Cancel all pending ────────────────────────────────────────────────────

export async function cancelAllNotifications() {
  await notifee.cancelAllNotifications();
}
