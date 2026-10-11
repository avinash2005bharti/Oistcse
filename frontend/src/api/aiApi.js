// ==========================================================================
// AI & Agentic Chat API Module
// Real endpoints for Central Chat Orchestrator, RAG, Memory, Suggestions
// ==========================================================================

import { apiClient } from './client';

export const aiApi = {
  chat({ prompt, message, conversation_id, conversationId, role, user_id, confirmed_action, attachment, file_id, fileId }) {
    return apiClient.post('/ai/chat', {
      prompt: prompt || message,
      message: message || prompt,
      conversation_id: conversation_id || conversationId,
      role,
      user_id,
      confirmed_action,
      attachment,
      file_id: file_id || fileId || attachment?.id || null
    });
  },

  executeTool({ tool, args = {}, confirmed = false }) {
    return apiClient.post('/ai/tools/execute', { tool, args, confirmed });
  },

  getObservability() {
    return apiClient.get('/ai/observability');
  },

  getSuggestions(role = 'student') {
    return apiClient.get(`/ai/suggestions?role=${role}`);
  },

  getUserMemory(userId) {
    return apiClient.get(userId ? `/ai/memory?userId=${userId}` : '/ai/memory');
  },

  searchRag(query, category = 'Notes') {
    return apiClient.post('/ai/rag/search', { query, category });
  },

  getConversations() {
    return apiClient.get('/ai/conversations');
  },

  getConversation(id) {
    return apiClient.get(`/ai/conversations/${id}`);
  },

  deleteConversation(id) {
    return apiClient.delete(`/ai/conversations/${id}`);
  }
};
