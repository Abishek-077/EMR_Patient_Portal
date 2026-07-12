import {
  archiveConversation,
  listConversations,
  resolveConversation,
  sendConversationAttachment,
  sendConversationMessage,
  sendMessage,
} from '../../shared/api/api';

export const messagesApi = {
  listConversations,
  sendMessage,
  sendConversationMessage,
  sendConversationAttachment,
  resolveConversation,
  archiveConversation,
};
