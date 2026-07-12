import { notFound } from '../../errors.js';
import { appendAuditLog, filterOwned, findOwned, stampPatientOwnership } from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

export async function listNotifications(user, { unreadOnly = false } = {}) {
  const database = await readDb();
  const notifications = filterOwned(database.notifications || [], user)
    .filter((notification) => !unreadOnly || !notification.readAt)
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
  return {
    notifications: notifications.map(publicNotification),
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
  };
}

export async function markNotificationRead(user, notificationId) {
  const notification = await updateDb((database) => {
    const found = findOwned(database.notifications || [], user, (item) => item.id === notificationId);
    if (!found) return null;
    found.readAt ||= new Date().toISOString();
    found.updatedAt = new Date().toISOString();
    appendAuditLog(database, user, 'notification read', 'notification', found.id);
    return found;
  });
  if (!notification) throw notFound('Notification not found');
  return publicNotification(notification);
}

export async function markAllNotificationsRead(user) {
  return updateDb((database) => {
    const now = new Date().toISOString();
    let updated = 0;
    for (const notification of filterOwned(database.notifications || [], user)) {
      if (!notification.readAt) {
        notification.readAt = now;
        notification.updatedAt = now;
        updated += 1;
      }
    }
    if (updated) appendAuditLog(database, user, 'all notifications read', 'notification', 'all', { updated });
    return { updated, readAt: now };
  });
}

export async function createNotification(user, input) {
  return updateDb((database) => {
    database.notifications ||= [];
    const notification = stampPatientOwnership({
      ...input,
      readAt: null,
      createdAt: input.createdAt || new Date().toISOString(),
    }, user);
    database.notifications.unshift(notification);
    return publicNotification(notification);
  });
}

function publicNotification(notification) {
  const { patientId: _patientId, userId: _userId, createdByUserId: _createdByUserId, ...safe } = notification;
  return safe;
}
