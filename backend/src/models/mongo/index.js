// ============================================================================
// MongoDB Models Registry - AI Application & Conversation Data ONLY
// STRICT RULE: No ERP entity models (Students, Teachers, Attendance, etc.)
// ============================================================================

const Conversation = require('./Conversation');
const Message = require('./Message');
const AgentRun = require('./AgentRun');
const ShortTermMemory = require('./ShortTermMemory');
const StudentPreData = require('./StudentPreData');

module.exports = {
  Conversation,
  Message,
  AgentRun,
  ShortTermMemory,
  StudentPreData
};
