import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  createConversationMessage,
  getConversation,
  listConversations,
  sendConversationMessage,
  setConversationResolved,
} from '../services/messages.service.js';
import {
  conversationMessageSchema,
  conversationResolveSchema,
  sendMessageSchema,
} from '../validation.js';

export const messagesRouter = Router();

messagesRouter.get('/conversations', requireAuth, requirePermission('messages.view'), async (request, response, next) => {
  try {
    response.json(await listConversations({ query: String(request.query.query || '') }));
  } catch (error) {
    next(error);
  }
});

messagesRouter.get('/conversations/:conversationId', requireAuth, requirePermission('messages.view'), async (request, response, next) => {
  try {
    response.json(await getConversation(request.params.conversationId));
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/conversations/:conversationId/messages', requireAuth, requirePermission('messages.send'), async (request, response, next) => {
  try {
    response.status(201).json(await sendConversationMessage(
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
      request.params.conversationId,
      conversationResolveSchema(request.body),
    ));
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/', requireAuth, requirePermission('messages.send'), async (request, response, next) => {
  try {
    response.status(201).json(await createConversationMessage(sendMessageSchema(request.body)));
  } catch (error) {
    next(error);
  }
});
