const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Conversation, UserMemory, ShortTermMemory, AgentLog } = require('../models/mongo/aiMemoryModels');
const { aiLogger, logger } = require('../services/loggerService');
const { ToolExecutionLog } = require('../models/mongo/aiMemoryModels');
const { erpAgentTools } = require('../services/erpAgentTools');
const { envConfig } = require('../config/env');

const PYTHON_AI_SERVICE_URL = process.env.AI_SERVICE_URL || process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || envConfig.jwtSecret;
const CONFIRMATION_TOOLS = new Set(['deactivateTeacher', 'deactivateStudent', 'deleteSubject', 'bulkMarkAttendance']);
const usedConfirmationIds = new Map();
const TOOL_ACCESS = {
  getTeachers: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'] },
  getTeacher: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'] },
  createTeacher: { roles: ['HOD', 'ADMIN'], permissions: ['FACULTY_MANAGE'] },
  updateTeacher: { roles: ['HOD', 'ADMIN'], permissions: ['FACULTY_MANAGE'] },
  deactivateTeacher: { roles: ['HOD', 'ADMIN'], permissions: ['FACULTY_MANAGE'] },
  searchTeachers: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'] },
  getTeacherWorkload: { roles: ['TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['FACULTY_MANAGE'] },
  getTeacherAvailability: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  markTeacherLeave: { roles: ['HOD', 'ADMIN'], permissions: ['LEAVE_APPROVE_HOD'] },
  getStudents: { roles: ['TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['STUDENT_LIST_VIEW'] },
  getStudent: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['STUDENT_PROFILE_READ', 'STUDENT_LIST_VIEW'] },
  createStudent: { roles: ['HOD', 'ADMIN'], permissions: ['USER_CREATE'] },
  deactivateStudent: { roles: ['HOD', 'ADMIN'], permissions: ['USER_DELETE'] },
  getStudentAttendance: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['ATTENDANCE_READ_SELF', 'ATTENDANCE_VIEW_ALL', 'ATTENDANCE_MARK', 'ATTENDANCE_OVERRIDE'] },
  getSubjects: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW', 'SUBJECT_MANAGE'] },
  createSubject: { roles: ['HOD', 'ADMIN'], permissions: ['SUBJECT_MANAGE'] },
  deleteSubject: { roles: ['HOD', 'ADMIN'], permissions: ['SUBJECT_MANAGE'] },
  getTimetable: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  generateTimetable: { roles: ['HOD', 'ADMIN'], permissions: ['TIMETABLE_GENERATE'] },
  exportTimetableExcel: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  exportTimetablePDF: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  getTeachersOnLeave: { roles: ['TG', 'HOD', 'ADMIN'], permissions: ['FACULTY_MANAGE', 'LEAVE_REVIEW_TG', 'LEAVE_APPROVE_HOD'] },
  approveLeave: { roles: ['HOD', 'ADMIN'], permissions: ['LEAVE_APPROVE_HOD'] },
  getRooms: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  checkRoomAvailability: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  generateWorkloadReport: { roles: ['HOD', 'ADMIN'], permissions: ['REPORT_GENERATE'] },
  generateAttendanceReport: { roles: ['HOD', 'ADMIN'], permissions: ['REPORT_GENERATE'] },
  markAttendance: { roles: ['TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['ATTENDANCE_MARK'] },
  bulkMarkAttendance: { roles: ['TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['ATTENDANCE_MARK'] },
  applyLeave: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['LEAVE_APPLY'] },
  rejectLeave: { roles: ['TG', 'HOD', 'ADMIN'], permissions: ['LEAVE_REVIEW_TG', 'LEAVE_APPROVE_HOD'] },
  submitAttendanceQuery: { roles: ['STUDENT'], permissions: ['ATTENDANCE_QUERY_SUBMIT'] },
  reviewAttendanceQuery: { roles: ['TG', 'HOD', 'ADMIN'], permissions: ['ATTENDANCE_QUERY_REVIEW', 'ATTENDANCE_QUERY_APPROVE'] },
  getStudentSchedule: { roles: ['STUDENT', 'TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  getTeacherSchedule: { roles: ['TEACHER', 'TG', 'HOD', 'ADMIN'], permissions: ['TIMETABLE_VIEW'] },
  getMentees: { roles: ['TG', 'HOD', 'ADMIN'], permissions: ['MENTEE_MONITOR', 'ATTENDANCE_VIEW_ALL'] },
  appointTg: { roles: ['HOD', 'ADMIN'] },
  createClassroom: { roles: ['HOD', 'ADMIN'], permissions: ['SUBJECT_MANAGE'] },
  getDepartmentAnalytics: { roles: ['HOD', 'ADMIN'], permissions: ['REPORT_VIEW'] },
  getUsers: { roles: ['ADMIN'], permissions: ['USER_READ'] }
};

function authorizeToolExecution(toolName, user) {
  const policy = TOOL_ACCESS[toolName];
  const role = String(user?.role || '').toUpperCase();
  if (!policy || !user?.id || !policy.roles.includes(role)) {
    return { allowed: false, message: `Access denied for tool '${toolName}'.` };
  }

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (policy.permissions?.length && !policy.permissions.some(permission => permissions.includes(permission))) {
    return { allowed: false, message: `Missing permission for tool '${toolName}'.` };
  }

  return { allowed: true };
}

function signToolConfirmation(pendingAction, userId) {
  if (!pendingAction?.tool || !CONFIRMATION_TOOLS.has(pendingAction.tool)) return null;
  return jwt.sign({
    userId: String(userId),
    tool: pendingAction.tool,
    args: pendingAction.args || {},
    agentId: pendingAction.agentId || null,
    conversationId: pendingAction.conversationId || null
  }, JWT_SECRET, { expiresIn: '5m', jwtid: crypto.randomBytes(16).toString('hex') });
}

async function recordToolAudit({ user, toolName, args, result, agentId, conversationId }) {
  try {
    await ToolExecutionLog.create({
      userId: String(user.id),
      role: user.role,
      agentId: agentId || null,
      conversationId: conversationId || null,
      toolName,
      parameters: args,
      result,
      success: result?.success === true,
      resourceId: result?.data?.id || result?.data?.leaveId || result?.data?.studentId || result?.data?.teacherId || null,
      timestamp: new Date()
    });
  } catch (auditError) {
    logger.error(`[AI Tool Audit] Failed to persist ${toolName} audit for user ${user.id}: ${auditError.message}`);
  }
}

async function executeConfirmedTool(payload, user) {
  const token = payload?.confirmationToken;
  if (!token) return { executed: false, error: 'A signed confirmation token is required.' };

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch {
    return { executed: false, error: 'The confirmation is invalid or expired. Please request the action again.' };
  }

  if (String(claims.userId) !== String(user?.id)) {
    return { executed: false, error: 'Access denied: this confirmation belongs to another user.' };
  }
  if (!CONFIRMATION_TOOLS.has(claims.tool) || typeof erpAgentTools[claims.tool] !== 'function') {
    return { executed: false, error: 'The confirmed operation is not an allowed destructive tool.' };
  }
  const authorization = authorizeToolExecution(claims.tool, user);
  if (!authorization.allowed) return { executed: false, error: authorization.message };
  for (const [id, expiresAt] of usedConfirmationIds.entries()) {
    if (expiresAt <= Date.now()) usedConfirmationIds.delete(id);
  }
  if (usedConfirmationIds.has(claims.jti)) {
    return { executed: false, error: 'This confirmation has already been used.' };
  }
  usedConfirmationIds.set(claims.jti, claims.exp * 1000);

  const result = await erpAgentTools[claims.tool](
    { ...(claims.args || {}), confirmed: true },
    { user }
  );
  await recordToolAudit({
    user,
    toolName: claims.tool,
    args: claims.args || {},
    result,
    agentId: claims.agentId,
    conversationId: claims.conversationId
  });
  return {
    executed: result.success === true,
    tool: claims.tool,
    steps: result.steps || [],
    error: result.success ? undefined : result.error || 'The backend operation was not successful.',
    data: result.data
  };
}

// 1. Central Multi-Agent Chat Orchestrator (Node ↔ Python)
exports.chat = async (req, res) => {
  const startTime = Date.now();
  try {
    const promptText = (req.body.prompt || req.body.message || '').trim();
    const conversationId = req.body.conversation_id || req.body.conversationId || `conv-${Date.now()}`;
    const targetAgent = req.body.agent || null;
    const attachment = req.body.attachment || null;
    const fileId = req.body.file_id || req.body.fileId || attachment?.id || attachment?._id || attachment?.file_id || null;

    if (!promptText) {
      return res.status(400).json({ success: false, message: 'A prompt or message string is required.' });
    }

    if (!req.user || !req.user.id || !req.user.role || !Array.isArray(req.user.permissions)) {
      return res.status(401).json({ success: false, message: 'Authentication required to access AI Assistant.' });
    }

    const userId = String(req.user.id);
    const userRole = String(req.user.role).toLowerCase();

    aiLogger.info(`[AI Chat] Received query from User #${userId} (${userRole}) [Agent: ${targetAgent}]: "${promptText.slice(0, 60)}..."`);

    // Retrieve context history from existing MongoDB conversation if present
    let contextHistory = [];
    try {
      const existingConv = await Conversation.findOne({ conversationId });
      if (existingConv && existingConv.messages) {
        contextHistory = existingConv.messages.slice(-6).map(m => ({ role: m.sender, content: m.content }));
      }
    } catch (lookupErr) {
      aiLogger.warn(`[AI Chat] Error fetching conversation context: ${lookupErr.message}`);
    }

    const confirmedActionPayload = req.body.confirmed_action || req.body.confirmedAction;
    let directAction = null;
    let aiResponseData;

    if (confirmedActionPayload) {
      directAction = await executeConfirmedTool(confirmedActionPayload, req.user);
      aiResponseData = {
        success: directAction.executed,
        answer: directAction.executed
          ? `The confirmed operation \`${directAction.tool}\` returned success from the CampusFlow backend.`
          : `The confirmed operation was not completed. ${directAction.error || ''}`.trim(),
        detected_intent: 'CONFIRMED_TOOL_EXECUTION',
        agent_used: determineAgentForRole(userRole),
        actions_taken: directAction.executed ? [directAction.tool] : [],
        tool_calls: directAction.tool ? [{
          tool: directAction.tool,
          steps: directAction.steps || [],
          success: directAction.executed,
          error: directAction.error,
          result: directAction.data
        }] : [],
        steps: directAction.steps || []
      };
    } else {
      if (!INTERNAL_API_SECRET) {
        return res.status(503).json({
          success: false,
          code: 'AI_GATEWAY_NOT_CONFIGURED',
          message: 'The authenticated AI agent gateway is not configured. No tool operation was attempted.'
        });
      }
      try {
        const pyResponse = await axios.post(`${PYTHON_AI_SERVICE_URL}/ai/chat`, {
          user_id: userId,
          role: userRole,
          prompt: promptText,
          message: promptText,
          conversation_id: conversationId,
          conversationId,
          agent: targetAgent,
          context_history: contextHistory,
          user: req.user,
          file_id: fileId,
          attachment
        }, {
          timeout: 25000,
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_API_SECRET
          }
        });
        aiResponseData = pyResponse.data;
      } catch (pyErr) {
        aiLogger.error(`[AI Chat] Agent runtime request failed: ${pyErr.message}`);
        return res.status(503).json({
          success: false,
          code: 'AI_RUNTIME_UNAVAILABLE',
          message: 'The CampusFlow agent runtime is unavailable. No fallback or simulated operation was executed.'
        });
      }
    }

    const answer = aiResponseData?.answer || aiResponseData?.response;
    if (!answer) {
      return res.status(502).json({
        success: false,
        code: 'AI_RESPONSE_MISSING',
        message: 'The agent runtime returned no response. No operation success is being reported.'
      });
    }
    const detected_intent = aiResponseData?.detected_intent || 'GENERAL_QUERY';
    const agent_used = aiResponseData?.agent_used || 'ERPAssistantAgent';
    const actions_taken = aiResponseData?.actions_taken || [];
    const proposed_actions = aiResponseData?.proposed_actions || [];
    const approval_requirement = aiResponseData?.approval_requirement || { requires_approval: false };
    const generated_files = aiResponseData?.generated_files || [];
    const affected_classes = aiResponseData?.affected_classes || [];
    const conflicts = aiResponseData?.conflicts || [];
    const citations = aiResponseData?.citations || [];
    const timetable_data = aiResponseData?.timetable_data || [];
    const tool_calls = aiResponseData?.tool_calls || [];
    const memory_update = aiResponseData?.memory_update || null;

    const steps = directAction?.steps || aiResponseData?.steps || (tool_calls[0]?.steps) || [];
    const requires_confirmation = Boolean(directAction?.requires_confirmation || aiResponseData?.requires_confirmation);
    const confirmation_prompt = directAction?.requires_confirmation ? (directAction.answer || directAction.confirmation_message) : (aiResponseData?.confirmation_prompt || null);
    const pendingConfirmation = aiResponseData?.action_to_confirm || null;
    const action_to_confirm = pendingConfirmation
      ? {
          ...pendingConfirmation,
          confirmationToken: signToolConfirmation({
            ...pendingConfirmation,
            agentId: agent_used,
            conversationId
          }, userId)
        }
      : null;
    const deliverable = (generated_files && generated_files.length > 0)
      ? { filename: generated_files[0].name, url: generated_files[0].url }
      : (aiResponseData?.deliverable || null);

    // Atomically persist conversation and messages to MongoDB
    try {
      await Conversation.findOneAndUpdate(
        { conversationId },
        {
          $setOnInsert: {
            conversationId,
            userId,
            role: userRole,
            title: promptText.slice(0, 40) + '...',
            createdAt: new Date()
          },
          $push: {
            messages: {
              $each: [
                { sender: 'user', content: promptText, timestamp: new Date() },
                { sender: 'assistant', content: answer, citations, toolCalls: tool_calls, timestamp: new Date() }
              ]
            }
          },
          $inc: { messageCount: 2 }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (saveErr) {
      aiLogger.warn(`[AI Chat] Non-critical warning saving conversation history: ${saveErr.message}`);
    }

    // Record Agent Execution Log in MongoDB
    try {
      const executionDuration = Date.now() - startTime;
      await AgentLog.create({
        agentName: agent_used || determineAgentForRole(userRole),
        userId,
        action: detected_intent || 'CHAT_COMPLETION',
        input: { prompt: promptText, conversationId, agent: targetAgent },
        output: { answerSnippet: (answer || '').slice(0, 100), actionsCount: actions_taken.length },
        executionTimeMs: executionDuration,
        status: aiResponseData?.success === true ? 'SUCCESS' : 'FAILED'
      });
    } catch (logErr) {
      aiLogger.warn(`[AI Chat] Non-critical warning logging agent execution: ${logErr.message}`);
    }

    return res.status(200).json({
      success: aiResponseData?.success === true,
      conversation_id: conversationId,
      answer,
      response: answer,
      detected_intent,
      agent_used,
      actions_taken,
      proposed_actions,
      approval_requirement,
      generated_files,
      affected_classes,
      conflicts,
      citations,
      timetable_data,
      tool_calls,
      memory_update,
      steps,
      requires_confirmation,
      confirmation_prompt,
      action_to_confirm,
      deliverable
    });
  } catch (error) {
    aiLogger.error(`[AI Chat] Orchestrator error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error orchestrating AI assistant response.',
      error: error.message
    });
  }
};

// 2. Get User Conversations List (ARCH-01: Graceful degradation when MongoDB is offline)
exports.getConversations = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    const userId = String(req.user.id);

    if (req.app?.locals?.mongoAvailable === false) {
      return res.status(503).json({
        success: false,
        code: 'MEMORY_UNAVAILABLE',
        message: 'Conversational memory storage is temporarily unavailable.'
      });
    }

    const conversations = await Conversation.find({ userId })
      .select('conversationId title messageCount updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .limit(30);

    return res.status(200).json({ success: true, count: conversations.length, conversations });
  } catch (error) {
    return res.status(503).json({
      success: false,
      code: 'MEMORY_UNAVAILABLE',
      message: 'Conversational memory storage could not be queried.'
    });
  }
};

// 3. Get Single Conversation Messages
exports.getConversationById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { id } = req.params;

    if (req.app?.locals?.mongoAvailable === false) {
      return res.status(503).json({
        success: false,
        message: 'Conversational memory service is temporarily offline.',
        code: 'MEMORY_UNAVAILABLE'
      });
    }

    const conversation = await Conversation.findOne({ conversationId: id });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    if (String(conversation.userId || '') !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to another user\'s conversation is denied.' });
    }

    return res.status(200).json({ success: true, conversation });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get User AI Memory Profile
exports.getUserMemory = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    const userId = String(req.user.id);

    if (req.app?.locals?.mongoAvailable === false) {
      return res.status(503).json({
        success: false,
        code: 'MEMORY_UNAVAILABLE',
        message: 'User memory storage is temporarily unavailable.'
      });
    }

    const memory = await UserMemory.findOne({ userId });
    return res.status(200).json({
      success: true,
      memory: memory || { userId, longTermFacts: [], academicInterests: [] }
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      code: 'MEMORY_UNAVAILABLE',
      message: 'User memory storage could not be queried.'
    });
  }
};

// 5. Contextual Query Suggestions
exports.getSuggestions = async (req, res) => {
  try {
    const role = (req.user?.role || 'student').toLowerCase();

    let suggestions = [];
    if (role === 'student') {
      suggestions = [
        "Kal meri class kab hai aur assignment pending hai?",
        "What is my current attendance in DBMS and OS?",
        "Explain Dijkstra's Algorithm with CSE syllabus context",
        "When is the deadline for Computer Networks Lab submission?",
        "What are Dr. Verma's office hours for project guidance?"
      ];
    } else if (role === 'faculty') {
      suggestions = [
        "Generate a 5-question assignment on B-Trees for 3rd Year Sem 5",
        "Which students in Section A have attendance below 75%?",
        "Summarize recent submissions for DBMS Assignment 2",
        "Draft an announcement circular about tomorrow's extra lab session",
        "Analyze overall class performance across test results"
      ];
    } else {
      suggestions = [
        "Generate CSE department student attendance analytics report",
        "Show faculty teaching workload distribution across 1st to 4th year",
        "Identify classes with missing attendance records this week",
        "Summary of circulars and department notifications published this month",
        "Review AI memory and RAG ingestion statistics"
      ];
    }

    return res.status(200).json({ success: true, role, suggestions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. RAG Hybrid Search Proxy
exports.ragSearch = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const { query, category, top_k } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'Search query required.' });

    try {
      const response = await axios.post(`${PYTHON_AI_SERVICE_URL}/ai/rag/search`, {
        query,
        collection: category || 'Notes',
        top_k: top_k || 5,
        user_id: String(req.user.id),
        role: req.user.role,
        user: req.user
      }, {
        timeout: 10000,
        headers: { 'x-internal-secret': INTERNAL_API_SECRET }
      });

      return res.status(200).json(response.data);
    } catch (error) {
      aiLogger.error(`[AI RAG Search] Retrieval failed: ${error.message}`);
      return res.status(502).json({
        success: false,
        message: 'The institutional knowledge search is currently unavailable.'
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 7. Delete Conversation
exports.deleteConversation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Authentication required' });
    const { id } = req.params;

    const conv = await Conversation.findOne({
      $or: [{ conversationId: id }, { _id: id }]
    });

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    if (conv.userId && conv.userId !== String(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to another user\'s conversation is denied.' });
    }

    await Conversation.deleteOne({ _id: conv._id });

    return res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Streaming Chat Endpoint (SSE adapter for the authenticated agent runtime)
exports.chatStream = async (req, res) => {
  try {
    if (!req.user || !req.user.id || !req.user.role || !Array.isArray(req.user.permissions)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const promptText = (req.body.prompt || req.body.message || '').trim();
    if (!promptText) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }

    const userId = String(req.user.id);
    const userRole = String(req.user.role).toLowerCase();

    if (!INTERNAL_API_SECRET) {
      return res.status(503).json({ success: false, code: 'AI_GATEWAY_NOT_CONFIGURED' });
    }
    try {
      const response = await axios.post(`${PYTHON_AI_SERVICE_URL}/ai/chat`, {
          prompt: promptText,
          message: promptText,
          role: userRole,
          user_id: userId,
          user: req.user,
          conversation_id: req.body.conversation_id || req.body.conversationId || `conv-${Date.now()}`,
          context_history: [],
          file_id: req.body.file_id || req.body.fileId || req.body.attachment?.id || req.body.attachment?._id || req.body.attachment?.file_id || null,
          attachment: req.body.attachment || null
        }, {
          timeout: 25000,
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_API_SECRET
          }
        });

      if (!response.data?.answer) {
        return res.status(502).json({ success: false, code: 'AI_RESPONSE_MISSING' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Request processing completed.' })}\n\n`);
      for (const call of response.data.tool_calls || []) {
        res.write(`data: ${JSON.stringify({
          type: 'tool_result',
          tool: call.tool,
          success: call.success === true
        })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'final', answer: response.data.answer })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (streamError) {
      logger.error(`[AI Chat Stream] Agent runtime request failed: ${streamError.message}`);
      if (!res.headersSent) {
        return res.status(503).json({
          success: false,
          code: 'AI_RUNTIME_UNAVAILABLE',
          message: 'The CampusFlow agent runtime is unavailable. No simulated stream was emitted.'
        });
      }
      return res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.end();
  }
};


// Helper: Determine agent name based on user role
function determineAgentForRole(role) {
  switch (role) {
    case 'faculty':
    case 'teacher':
    case 'tg':
    case 'hod':
      return 'FacultyAssistant';
    case 'admin':
      return 'AdminAssistant';
    case 'student':
    default:
      return 'StudentAssistant';
  }
}


// 9. Execute Specific ERP Tool Endpoint (Universal Tool Layer)
exports.executeTool = async (req, res) => {
  try {
    const { tool, args = {}, confirmed = false, confirmationToken } = req.body;
    if (!tool || !erpAgentTools[tool]) {
      return res.status(404).json({
        success: false,
        message: `Tool '${tool}' not found in Universal Tool Registry.`
      });
    }

    const authorization = authorizeToolExecution(tool, req.user);
    if (!authorization.allowed) {
      return res.status(403).json({
        success: false,
        code: 'TOOL_AUTHORIZATION_DENIED',
        message: authorization.message
      });
    }

    if (CONFIRMATION_TOOLS.has(tool)) {
      if (!confirmationToken) {
        return res.status(409).json({
          success: false,
          code: 'CONFIRMATION_REQUIRED',
          message: 'Destructive tools require a signed, user-bound confirmation token.'
        });
      }
      const confirmedResult = await executeConfirmedTool({ confirmationToken }, req.user);
      return res.status(confirmedResult.executed ? 200 : 403).json({
        success: confirmedResult.executed,
        error: confirmedResult.error,
        tool: confirmedResult.tool,
        steps: confirmedResult.steps,
        data: confirmedResult.data
      });
    }

    const result = await erpAgentTools[tool]({ ...args, confirmed: false }, {
      user: req.user,
      agentId: req.body.agentId,
      conversationId: req.body.conversationId
    });
    await recordToolAudit({
      user: req.user,
      toolName: tool,
      args,
      result,
      agentId: req.body.agentId,
      conversationId: req.body.conversationId
    });
    return res.status(200).json(result);
  } catch (err) {
    aiLogger.error(`[AI executeTool] Error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 10. Admin / Developer Observability Endpoint (Section 30)
exports.getObservability = async (req, res) => {
  try {
    const FileDocument = require('../models/mongo/FileDocument');

    // Aggregate file statistics
    const [totalFiles, completedFiles, processingFiles, failedFiles, recentLogs] = await Promise.all([
      FileDocument.countDocuments({ isDeleted: false }),
      FileDocument.countDocuments({ processingStatus: 'completed', isDeleted: false }),
      FileDocument.countDocuments({ processingStatus: { $in: ['pending', 'processing'] }, isDeleted: false }),
      FileDocument.countDocuments({ processingStatus: 'failed', isDeleted: false }),
      AgentLog.find().sort({ createdAt: -1 }).limit(15)
    ]);

    // Calculate total indexed chunks from completed files
    const chunksAgg = await FileDocument.aggregate([
      { $match: { processingStatus: 'completed', isDeleted: false } },
      { $group: { _id: null, totalChunks: { $sum: '$extractedContent.chunksIndexed' } } }
    ]);
    const totalChunks = chunksAgg[0]?.totalChunks || 0;

    // Fetch FastAPI health / Qdrant status if available
    let qdrantStatus = 'Cloud Qdrant Connected';
    let activeModels = {
      llm: 'llama-3.3-70b-versatile',
      vision: 'llama-3.2-11b-vision-preview (Groq)',
      embeddings: 'sentence-transformers/all-mpnet-base-v2 (Local)'
    };

    try {
      const pyHealth = await axios.get(`${PYTHON_AI_SERVICE_URL}/health`, { timeout: 3000 });
      if (pyHealth.data) {
        qdrantStatus = pyHealth.data.qdrant_status || 'UP';
      }
    } catch {}

    return res.status(200).json({
      success: true,
      stats: {
        totalDocuments: totalFiles,
        completedDocuments: completedFiles,
        processingDocuments: processingFiles,
        failedDocuments: failedFiles,
        totalChunksIndexed: totalChunks,
        qdrantStatus,
        models: activeModels,
        recentExecutions: recentLogs.map(l => ({
          id: l._id,
          agent: l.agentName,
          action: l.action,
          status: l.status,
          durationMs: l.executionTimeMs,
          time: l.createdAt
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
