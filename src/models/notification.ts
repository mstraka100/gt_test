import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationPreferences } from '../types';

// In-memory storage
const notifications: Map<string, Notification> = new Map();
const userNotifications: Map<string, string[]> = new Map(); // userId -> notificationIds (newest first)
const preferences: Map<string, NotificationPreferences> = new Map();

// Default preferences
function getDefaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    mentions: true,
    directMessages: true,
    channelMessages: false,
    sounds: true,
    desktop: true,
  };
}

export interface CreateNotificationInput {
  userId: string;
  type: Notification['type'];
  title: string;
  body: string;
  data?: Notification['data'];
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification> {
  const notification: Notification = {
    id: uuidv4(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    read: false,
    data: input.data,
    createdAt: new Date(),
  };

  notifications.set(notification.id, notification);

  // Add to user's notification list (prepend for newest first)
  if (!userNotifications.has(input.userId)) {
    userNotifications.set(input.userId, []);
  }
  userNotifications.get(input.userId)!.unshift(notification.id);

  // Limit stored notifications per user to 100
  const userNotifs = userNotifications.get(input.userId)!;
  if (userNotifs.length > 100) {
    const toRemove = userNotifs.splice(100);
    toRemove.forEach((id) => notifications.delete(id));
  }

  return notification;
}

export async function getUserNotifications(
  userId: string,
  limit: number = 20,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  const notificationIds = userNotifications.get(userId) || [];

  const result: Notification[] = [];
  for (const id of notificationIds) {
    if (result.length >= limit) break;

    const notification = notifications.get(id);
    if (notification) {
      if (unreadOnly && notification.read) continue;
      result.push(notification);
    }
  }

  return result;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const notificationIds = userNotifications.get(userId) || [];
  let count = 0;

  for (const id of notificationIds) {
    const notification = notifications.get(id);
    if (notification && !notification.read) {
      count++;
    }
  }

  return count;
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const notification = notifications.get(notificationId);
  if (!notification) return null;

  if (notification.userId !== userId) {
    throw new Error('Permission denied');
  }

  notification.read = true;
  notifications.set(notificationId, notification);

  return notification;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const notificationIds = userNotifications.get(userId) || [];
  let count = 0;

  for (const id of notificationIds) {
    const notification = notifications.get(id);
    if (notification && !notification.read) {
      notification.read = true;
      notifications.set(id, notification);
      count++;
    }
  }

  return count;
}

export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const notification = notifications.get(notificationId);
  if (!notification) return false;

  if (notification.userId !== userId) {
    throw new Error('Permission denied');
  }

  notifications.delete(notificationId);

  const userNotifs = userNotifications.get(userId);
  if (userNotifs) {
    const index = userNotifs.indexOf(notificationId);
    if (index !== -1) {
      userNotifs.splice(index, 1);
    }
  }

  return true;
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  return preferences.get(userId) || getDefaultPreferences(userId);
}

export async function updatePreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, 'userId'>>
): Promise<NotificationPreferences> {
  const current = await getPreferences(userId);

  const updated: NotificationPreferences = {
    ...current,
    ...updates,
    userId, // Ensure userId doesn't change
  };

  preferences.set(userId, updated);
  return updated;
}

// Helper to check if user should receive notification based on preferences
export async function shouldNotify(
  userId: string,
  type: Notification['type']
): Promise<boolean> {
  const prefs = await getPreferences(userId);

  switch (type) {
    case 'mention':
      return prefs.mentions;
    case 'dm':
      return prefs.directMessages;
    case 'message':
      return prefs.channelMessages;
    case 'channel_invite':
    case 'system':
      return true; // Always notify for these
    default:
      return true;
  }
}

// Notification factory functions
export async function notifyMention(
  userId: string,
  senderName: string,
  channelName: string,
  messagePreview: string,
  data: Notification['data']
): Promise<Notification | null> {
  if (!(await shouldNotify(userId, 'mention'))) return null;

  return createNotification({
    userId,
    type: 'mention',
    title: `${senderName} mentioned you in #${channelName}`,
    body: messagePreview.slice(0, 100),
    data,
  });
}

export async function notifyDM(
  userId: string,
  senderName: string,
  messagePreview: string,
  data: Notification['data']
): Promise<Notification | null> {
  if (!(await shouldNotify(userId, 'dm'))) return null;

  return createNotification({
    userId,
    type: 'dm',
    title: `New message from ${senderName}`,
    body: messagePreview.slice(0, 100),
    data,
  });
}

export async function notifyChannelInvite(
  userId: string,
  inviterName: string,
  channelName: string,
  data: Notification['data']
): Promise<Notification | null> {
  return createNotification({
    userId,
    type: 'channel_invite',
    title: `${inviterName} invited you to #${channelName}`,
    body: `You've been invited to join the channel`,
    data,
  });
}
