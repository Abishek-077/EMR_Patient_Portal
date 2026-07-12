import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { badRequest } from '../../errors.js';
import { createConversationMessage } from '../messages/messages.service.js';
import { createNotification, listNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.service.js';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', requireAuth, requirePermission('dashboard.view'), async (request, response, next) => {
  try {
    response.json(await listNotifications(request.auth.user, { unreadOnly: request.query.unread === 'true' }));
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/notifications/read-all', requireAuth, requirePermission('notifications.manage'), async (request, response, next) => {
  try {
    response.json(await markAllNotificationsRead(request.auth.user));
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/notifications/:notificationId/read', requireAuth, requirePermission('notifications.manage'), async (request, response, next) => {
  try {
    response.json(await markNotificationRead(request.auth.user, request.params.notificationId));
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/support', requireAuth, requirePermission('messages.send'), async (request, response, next) => {
  try {
    const subject = String(request.body?.subject || request.body?.topic || '').trim();
    const body = String(request.body?.body || request.body?.message || '').trim();
    if (!subject || !body) throw badRequest('Support subject and message are required');
    const message = await createConversationMessage(request.auth.user, {
      recipientId: 'patient-support',
      subject: `Support: ${subject}`,
      body,
    });
    await createNotification(request.auth.user, {
      id: `notification-${randomUUID()}`,
      type: 'support',
      title: 'Support request received',
      detail: subject,
      relatedId: message.conversationId,
    });
    response.status(201).json({ message, status: 'Queued for local support' });
  } catch (error) {
    next(error);
  }
});
