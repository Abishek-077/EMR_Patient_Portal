import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  archiveConversation,
  createConversationMessage,
  getConversation,
  listMessageRecipients,
  listConversations,
  sendConversationMessage,
  setConversationResolved,
} from './messages.service.js';
import {
  conversationMessageSchema,
  conversationResolveSchema,
  sendMessageSchema,
} from '../../validation.js';

export const messagesRouter = Router();

messagesRouter.get('/recipients', requireAuth, requirePermission('messages.send'), async (_request, response, next) => {
  try { response.json(await listMessageRecipients()); }
  catch (error) { next(error); }
});

messagesRouter.get('/conversations', requireAuth, requirePermission('messages.view'), async (request, response, next) => {
  try {
    response.json(await listConversations(request.auth.user, {
      query: String(request.query.query || ''),
      includeMessages: request.query.include === 'messages',
    }));
  } catch (error) {
    next(error);
  }
});

messagesRouter.get('/conversations/:conversationId', requireAuth, requirePermission('messages.view'), async (request, response, next) => {
  try {
    response.json(await getConversation(request.auth.user, request.params.conversationId));
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/conversations/:conversationId/messages', requireAuth, requirePermission('messages.send'), async (request, response, next) => {
  try {
    response.status(201).json(await sendConversationMessage(
      request.auth.user,
      request.params.conversationId,
      conversationMessageSchema(request.body),
    ));
  } catch (error) {
    next(error);
  }
});

messagesRouter.patch('/conversations/:conversationId/resolve', requireAuth, requirePermission('messages.resolve'), async (request, response, next) => {
  try {
    response.json(await setConversationResolved(
      request.auth.user,
      request.params.conversationId,
      conversationResolveSchema(request.body),
    ));
  } catch (error) {
    next(error);
  }
});

messagesRouter.delete('/conversations/:conversationId', requireAuth, requirePermission('messages.resolve'), async (request, response, next) => {
  try {
    response.json(await archiveConversation(request.auth.user, request.params.conversationId));
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/', requireAuth, requirePermission('messages.send'), async (request, response, next) => {
  try {
    response.status(201).json(await createConversationMessage(request.auth.user, sendMessageSchema(request.body)));
  } catch (error) {
    next(error);
  }
});
