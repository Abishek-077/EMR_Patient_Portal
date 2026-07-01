import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function listConversations({ query = '' } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const db = await readDb();
  const conversations = db.messageConversations
    .filter((conversation) => {
      if (!normalizedQuery) return true;
      return [
        conversation.participantName,
        conversation.participantRole,
        conversation.subject,
        conversation.preview,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    })
    .map(toConversationSummary);

  return {
    conversations,
    activeConversationId: conversations[0]?.id || null,
    total: conversations.length,
  };
}

export async function getConversation(conversationId) {
  const db = await readDb();
  const conversation = db.messageConversations.find((item) => item.id === conversationId);
  if (!conversation) throw notFound('Conversation not found');
  return toConversationDetail(conversation);
}

export async function sendConversationMessage(conversationId, input) {
  const result = await updateDb((db) => {
    const conversation = db.messageConversations.find((item) => item.id === conversationId);
    if (!conversation) return null;

    const message = createOutboundMessage(input.body, input.attachment);
    conversation.messages ||= [];
    conversation.messages.push(message);
    conversation.preview = input.body;
    conversation.time = 'Just now';
    conversation.unread = false;
    conversation.resolved = false;
    conversation.updatedAt = new Date().toISOString();

    db.messages ||= [];
    db.messages.unshift(toLegacyMessage(conversation, message));
    return { conversation, message };
  });

  if (!result) throw notFound('Conversation not found');
  return {
    message: result.message,
    conversation: toConversationDetail(result.conversation),
  };
}

export async function createConversationMessage(input) {
  return updateDb((db) => {
    db.messageConversations ||= [];
    db.messages ||= [];

    const conversation = {
      id: `conv-${randomUUID()}`,
      participantName: 'Care Team',
      participantRole: 'Patient Support',
      activeNow: false,
      subject: input.subject,
      preview: input.body,
      time: 'Just now',
      unread: false,
      resolved: false,
      messages: [createOutboundMessage(input.body)],
      createdAt: new Date().toISOString(),
    };

    db.messageConversations.unshift(conversation);
    const legacyMessage = toLegacyMessage(conversation, conversation.messages[0]);
    db.messages.unshift(legacyMessage);
    return legacyMessage;
  });
}

export async function setConversationResolved(conversationId, input) {
  const conversation = await updateDb((db) => {
    const foundConversation = db.messageConversations.find((item) => item.id === conversationId);
    if (!foundConversation) return null;

    foundConversation.resolved = input.resolved;
    foundConversation.unread = false;
    foundConversation.updatedAt = new Date().toISOString();
    return foundConversation;
  });

  if (!conversation) throw notFound('Conversation not found');
  return toConversationDetail(conversation);
}

function createOutboundMessage(body, attachment = null) {
  const message = {
    id: `thread-msg-${randomUUID()}`,
    direction: 'outbound',
    body,
    sentAtLabel: 'Just now',
    createdAt: new Date().toISOString(),
    read: false,
  };
  if (attachment) message.attachment = attachment;
  return message;
}

function toLegacyMessage(conversation, message) {
  return {
    id: message.id,
    from: 'You',
    subject: conversation.subject,
    preview: message.body,
    time: message.sentAtLabel,
    outbound: true,
    conversationId: conversation.id,
  };
}

function toConversationSummary(conversation) {
  return {
    id: conversation.id,
    participantName: conversation.participantName,
    participantRole: conversation.participantRole,
    activeNow: Boolean(conversation.activeNow),
    subject: conversation.subject,
    preview: conversation.preview,
    time: conversation.time,
    unread: Boolean(conversation.unread),
    resolved: Boolean(conversation.resolved),
  };
}

function toConversationDetail(conversation) {
  return {
    ...toConversationSummary(conversation),
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
  };
}
