import { randomUUID } from 'node:crypto';

export const notificationGateway = {
  name: 'local-outbox',

  async deliver({ channel = 'in-app', recipient, template, subject, body, metadata = {} }) {
    return {
      id: `notification-${randomUUID()}`,
      provider: 'local-outbox',
      channel,
      recipient: String(recipient || '').trim(),
      template: String(template || 'general'),
      subject: String(subject || 'Patient portal notification'),
      body: String(body || ''),
      metadata,
      status: 'Delivered to local outbox',
      createdAt: new Date().toISOString(),
      readAt: null,
    };
  },
};
