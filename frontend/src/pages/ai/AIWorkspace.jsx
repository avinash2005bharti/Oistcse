import React, { useState, useRef, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { aiApi } from '../../api/aiApi';
import { fileApi } from '../../api/fileApi';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bot,
  Sparkles,
  Send,
  Paperclip,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Wrench,
  Activity,
  User,
  Shield,
  Clock,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  FileCheck,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { Badge, Button } from '../../components/common';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function AIWorkspace() {
  const { currentRole, currentUser } = useERP();
  const navigate = useNavigate();
  const location = useLocation();

  // Active conversation state
  const [conversationId, setConversationId] = useState(() => {
    return location.state?.conversationId || `conv-${Date.now()}`;
  });
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'documents' | 'agents' | 'tools'
  const [userDocuments, setUserDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [observabilityOpen, setObservabilityOpen] = useState(false);
  const [observabilityStats, setObservabilityStats] = useState(null);

  // Chat message thread
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      agentUsed: 'ERPAssistantAgent',
      text: `## 🚀 Welcome to CampusFlow AI Workspace\n\nI am your **Universal Departmental AI Operating Layer**. I execute real ERP actions, analyze files, reason over timetables and attendance, and coordinate departmental operations under **${(currentRole || 'Student').toUpperCase()}** authorization.\n\n### What would you like me to do today?\n- **Files:** Attach PDFs, Excel sheets, PPTs, or images for immediate reasoning.\n- **ERP Actions:** Ask me to check attendance, view or generate schedules, process leaves, or inspect faculty workloads.\n- **Destructive Operations:** High-impact modifications will always prompt for your explicit confirmation first.`,
      timestamp: new Date().toISOString()
    }
  ]);

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Timestamp formatting helper
  const formatMessageTimestamp = (dateInput) => {
    if (!dateInput) return 'Just now';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    const isToday = now.toDateString() === date.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  };

  // Intent label mapping helper
  const formatIntentLabel = (intent) => {
    if (!intent) return null;
    const clean = String(intent).toUpperCase();
    if (clean === 'GENERAL_QUERY') {
      return currentRole === 'admin' ? 'General Query' : null;
    }
    const mapping = {
      'TIMETABLE_GENERATION': 'Timetable',
      'GENERATETIMETABLE': 'Timetable',
      'ATTENDANCE_QUERY': 'Attendance',
      'GETTEACHERSONLEAVE': 'Faculty Availability',
      'MARKTEACHERLEAVE': 'Leave Processing',
      'DEACTIVATETEACHER': 'Faculty Management',
      'ACTION_EXECUTION': 'ERP Action',
      'FILEPROCESSINGSTATUS': 'Document Processing'
    };
    return mapping[clean] || (currentRole === 'admin' ? intent : 'ERP Assistant');
  };

  // Load user conversation list
  const loadConversations = async () => {
    try {
      const res = await aiApi.getConversations();
      if (res && res.conversations) {
        setConversations(res.conversations);
      }
    } catch (e) {
      console.warn('Could not load conversations:', e.message);
    }
  };

  // Load uploaded documents
  const loadUserDocuments = async () => {
    setLoadingDocs(true);
    try {
      const res = await fileApi.getFiles({ limit: 30 });
      if (res && res.files) {
        setUserDocuments(res.files);
      }
    } catch (e) {
      console.warn('Could not load documents:', e.message);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Load observability data
  const loadObservability = async () => {
    try {
      const res = await aiApi.getObservability();
      if (res && res.stats) {
        setObservabilityStats(res.stats);
      }
    } catch (e) {
      console.warn('Could not load observability:', e.message);
    }
  };

  useEffect(() => {
    loadConversations();
    loadUserDocuments();
  }, []);

  // Specialized 10 Agents registry for sidebar
  const specializedAgents = [
    { id: 'erp_assistant', name: 'General ERP Assistant', desc: 'Central coordinator for departmental navigation and inquiries', roles: ['ALL'] },
    { id: 'timetable', name: 'Timetable Optimizer Agent', desc: 'CSP scheduling engine, room allocation & timetable draft generation', roles: ['HOD', 'ADMIN'] },
    { id: 'teacher_absence', name: 'Absence & Substitution Agent', desc: 'Detects absent faculty, finds feasible substitutes and resolves clashes', roles: ['HOD', 'ADMIN', 'TEACHER'] },
    { id: 'teacher_scheduling', name: 'Workload & Allocation Agent', desc: 'Monitors teaching capacities, period distributions and lab allocations', roles: ['HOD', 'ADMIN'] },
    { id: 'attendance', name: 'Attendance Ledger Agent', desc: 'Audits student attendance percentages, shortage alerts and sessions', roles: ['ALL'] },
    { id: 'leave_management', name: 'Leave Workflow Agent', desc: 'Applies, reviews, and sanctions teacher & student leave applications', roles: ['ALL'] },
    { id: 'rag', name: 'Document Intelligence Agent', desc: 'Performs semantic retrieval over syllabus, PDFs, policies in Qdrant', roles: ['ALL'] },
    { id: 'spreadsheet', name: 'Spreadsheet Intelligence Agent', desc: 'Direct pandas calculation over XLSX/CSV data with zero hallucination', roles: ['ALL'] },
    { id: 'vision', name: 'Vision Intelligence Agent', desc: 'Qwen visual reasoning over timetables, diagrams, handwritten charts', roles: ['ALL'] },
    { id: 'file_generation', name: 'Report & Export Agent', desc: 'Generates downloadable Excel spreadsheets and printable official PDFs', roles: ['ALL'] }
  ];

  // Role-aware tool capabilities
  const getRoleTools = () => {
    const role = (currentRole || 'student').toLowerCase();
    if (role === 'hod') {
      return [
        { name: 'Generate Timetable', prompt: 'Generate timetable for semester 5 section A' },
        { name: 'Teachers On Leave Today', prompt: 'Show all teachers on leave today' },
        { name: 'Faculty Workload Excel', prompt: 'Create an Excel report of teachers and their weekly workload' },
        { name: 'Attendance Shortage Report', prompt: 'Generate attendance report for semester 5' },
        { name: 'Check Classroom Availability', prompt: 'Check room availability for Monday Period 2' },
        { name: 'Export Timetable Excel', prompt: 'Export timetable excel for semester 5 section A' },
        { name: 'Export Timetable PDF', prompt: 'Export timetable pdf for semester 5 section A' }
      ];
    } else if (role === 'teacher' || role === 'tg') {
      return [
        { name: 'Mark Me On Leave Tomorrow', prompt: 'Put me on leave tomorrow' },
        { name: 'My Schedule Today', prompt: 'Show my schedule for today' },
        { name: 'My Assigned Subjects', prompt: 'Show my assigned subjects and sections' },
        { name: 'Check Room Vacancies', prompt: 'Check classroom availability' }
      ];
    } else if (role === 'admin') {
      return [
        { name: 'System Observability', prompt: 'Show system observability statistics' },
        { name: 'Audit User Directory', prompt: 'Show recent teachers and students' },
        { name: 'All Classrooms', prompt: 'Show all classrooms and capacities' }
      ];
    } else {
      // Student
      return [
        { name: 'My Real Attendance', prompt: 'Show my attendance' },
        { name: 'Today\'s Timetable', prompt: 'What classes do I have today?' },
        { name: 'Attendance Formula', prompt: 'How is university attendance calculated?' }
      ];
    }
  };

  // Start a new chat
  const handleNewChat = () => {
    const newId = `conv-${Date.now()}`;
    setConversationId(newId);
    setAttachedFile(null);
    setSelectedAgent(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        agentUsed: 'ERPAssistantAgent',
        text: `### 💬 New AI Session Initialized\n\nReady to assist you with departmental records, document intelligence, or autonomous ERP operations. What would you like to do?`,
        timestamp: new Date().toISOString()
      }
    ]);
    textareaRef.current?.focus();
  };

  // Select an existing conversation
  const handleSelectConversation = async (conv) => {
    try {
      setConversationId(conv.conversationId);
      const res = await aiApi.getConversation(conv.conversationId);
      if (res && res.conversation && res.conversation.messages) {
        const mapped = res.conversation.messages.map((m, idx) => ({
          id: `db-msg-${idx}`,
          role: m.sender === 'user' ? 'user' : 'assistant',
          text: m.content,
          citations: m.citations || [],
          toolCalls: m.toolCalls || [],
          timestamp: m.timestamp || new Date().toISOString()
        }));
        setMessages(mapped);
      }
    } catch (e) {
      console.warn('Error loading conversation:', e.message);
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    try {
      await aiApi.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.conversationId !== id));
      if (conversationId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // File Upload Handling
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setUploadProgress('Uploading to cloud storage & queueing processing...');

    try {
      const res = await fileApi.upload(file, conversationId);
      if (res && res.file) {
        setAttachedFile({
          id: res.file.id,
          name: res.file.filename,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: res.file.fileType,
          url: res.file.storageUrl || '',
          status: 'ready'
        });

        // Add upload confirmation in conversation
        setMessages(prev => [
          ...prev,
          {
            id: `sys-upload-${Date.now()}`,
            role: 'assistant',
            agentUsed: 'DocumentIntelligenceAgent',
            text: `📁 **File Attached:** \`${file.name}\` (${(file.size / 1024).toFixed(1)} KB)\n\nThe Universal File Intelligence Pipeline has registered and processed this document. You can now execute operations, request visual analysis, or ask questions referencing this file!`,
            timestamp: new Date().toISOString()
          }
        ]);

        // Refresh user documents list
        loadUserDocuments();
      }
    } catch (err) {
      alert(`File upload failed: ${err.message}`);
    } finally {
      setUploadingFile(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  // Send message
  const handleSendMessage = async (textToSend, confirmedAction = null, docOverride = null) => {
    const query = (textToSend !== undefined ? textToSend : prompt).trim();
    const effectiveAttachment = docOverride
      ? {
          id: docOverride._id || docOverride.id,
          name: docOverride.originalName || docOverride.filename || 'document',
          type: docOverride.fileType || 'file',
          url: docOverride.storageUrl || '',
          status: docOverride.processingStatus || 'ready'
        }
      : attachedFile;
    if (!query && !effectiveAttachment && !confirmedAction) return;

    const fileRef = effectiveAttachment ? { ...effectiveAttachment } : null;
    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: query || (confirmedAction ? `[Confirmed ${confirmedAction.tool}]` : `Analyze ${fileRef?.name || 'uploaded file'}`),
      attachment: fileRef,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setAttachedFile(null);
    setIsGenerating(true);

    try {
      const res = await aiApi.chat({
        prompt: query,
        message: query,
        conversation_id: conversationId,
        role: currentRole || 'student',
        user_id: currentUser?.id || 'user_default',
        confirmed_action: confirmedAction,
        attachment: fileRef,
        file_id: fileRef?.id || null
      });

      const answerText = res?.answer || res?.response || 'Operation processed by ERP agent.';
      const assistantMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: answerText,
        agentUsed: res?.agent_used || (selectedAgent ? selectedAgent.name : 'ERPAssistantAgent'),
        detectedIntent: res?.detected_intent,
        toolCalls: res?.tool_calls || [],
        actionsTaken: res?.actions_taken || [],
        requiresConfirmation: Boolean(res?.requires_confirmation),
        confirmationAction: res?.confirmation_action || null,
        generatedFiles: res?.generated_files || [],
        citations: res?.citations || [],
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      loadConversations();
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          isError: true,
          lastPrompt: query,
          text: `⚠️ **Agent Execution Notice:** ${err.message || 'The AI service encountered a temporary timeout or connection delay. Please try again.'}`,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Keyboard shortcut (Enter to send)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c =>
    (c.title || c.conversationId).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayName = (!currentUser?.name || currentUser?.name.toLowerCase() === 'hod' || currentUser?.name.includes('Alok Verma'))
    ? (currentRole === 'hod' ? 'HOD CSE' : 'Authorized User')
    : currentUser.name;

  return (
    <div className="ai-workspace-container">
      {/* Mobile Backdrop for secondary sessions panel */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-35 lg:hidden"
        />
      )}

      {/* ----------------- SECONDARY PANEL (SESSIONS & TOOLS) ----------------- */}
      <aside
        className="ai-sidebar"
        style={{
          width: isSidebarOpen ? '300px' : '0px',
          minWidth: isSidebarOpen ? '300px' : '0px',
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          zIndex: 40
        }}
      >
        {/* Panel Header */}
        <div style={{ padding: '1rem 1.15rem 0.85rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Chat Sessions
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>History & Documents</div>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent"
            title="Collapse sessions panel"
            aria-label="Collapse panel"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New Chat Button */}
        <div style={{ padding: '0.75rem 1rem' }}>
          <button
            onClick={handleNewChat}
            className="btn btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: 'var(--radius-xl)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              padding: '0.65rem 1rem'
            }}
          >
            <Plus size={15} />
            <span>New Chat Session</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 0.5rem' }}>
          {[
            { id: 'chats', label: 'Chats', icon: MessageSquare },
            { id: 'documents', label: 'Docs', icon: FileText },
            { id: 'agents', label: 'Agents', icon: Layers },
            { id: 'tools', label: 'Tools', icon: Wrench }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`ai-sidebar-nav-btn ${active ? 'active' : ''}`}
                style={{
                  padding: '0.6rem 0.25rem',
                  fontSize: '12px',
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--primary-700)' : 'var(--text-secondary)'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Recent Chats */}
        {activeTab === 'chats' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.65rem 1rem 0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--surface-low)', padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px', width: '100%' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.35rem 0.65rem' }}>
              {filteredConversations.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No saved conversations found.
                </div>
              ) : (
                filteredConversations.map(c => {
                  const isCurrent = c.conversationId === conversationId;
                  return (
                    <div
                      key={c._id || c.conversationId}
                      onClick={() => handleSelectConversation(c)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        backgroundColor: isCurrent ? 'var(--primary-50)' : 'transparent',
                        color: isCurrent ? 'var(--primary-700)' : 'var(--text-primary)',
                        border: isCurrent ? '1px solid var(--primary-200)' : '1px solid transparent',
                        transition: 'background 0.15s ease'
                      }}
                      className="hover:bg-slate-100"
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: isCurrent ? 700 : 500 }}>
                        {c.title || c.conversationId}
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, c.conversationId)}
                        style={{ background: 'none', border: 'none', color: isCurrent ? 'var(--primary-500)' : 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: User Documents */}
        {activeTab === 'documents' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0 0.5rem 0.5rem' }}>
              Indexed Documents ({userDocuments.length})
            </div>
            {userDocuments.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No uploaded documents yet. Use "+ Attach" below to upload files.
              </div>
            ) : (
              userDocuments.map(doc => (
                <div
                  key={doc._id}
                  onClick={() => handleSendMessage(`Analyze ${doc.originalName || doc.filename} and summarize its key contents.`, null, doc)}
                  style={{
                    backgroundColor: 'var(--surface)',
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: '1px solid var(--border-subtle)'
                  }}
                  className="hover:border-primary hover:bg-blue-50/40"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '3px' }}>
                    {doc.fileType === 'pdf' && <FileText size={15} color="#EF4444" />}
                    {['xlsx', 'xls', 'csv'].includes(doc.fileType) && <FileSpreadsheet size={15} color="#10B981" />}
                    {['pptx', 'ppt'].includes(doc.fileType) && <Presentation size={15} color="#F59E0B" />}
                    {['png', 'jpg', 'jpeg'].includes(doc.fileType) && <FileImage size={15} color="#3B82F6" />}
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.originalName || doc.filename}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    <span>{doc.extractedContent?.chunksIndexed || 0} vectors</span>
                    <span style={{
                      backgroundColor: doc.processingStatus === 'completed' ? 'var(--success-50)' : 'var(--warning-50)',
                      color: doc.processingStatus === 'completed' ? 'var(--success-700)' : 'var(--warning-700)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontWeight: 700
                    }}>
                      {doc.processingStage || doc.processingStatus}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Specialized Agents */}
        {activeTab === 'agents' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0 0.5rem 0.5rem' }}>
              10 Specialized Agents
            </div>
            {specializedAgents.map(ag => (
              <div
                key={ag.id}
                onClick={() => setSelectedAgent(ag)}
                style={{
                  backgroundColor: selectedAgent?.id === ag.id ? 'var(--primary-50)' : 'var(--surface)',
                  padding: '0.65rem',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: '6px',
                  cursor: 'pointer',
                  border: selectedAgent?.id === ag.id ? '1.5px solid var(--primary-500)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease'
                }}
                className="hover:border-primary"
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: selectedAgent?.id === ag.id ? 'var(--primary-700)' : 'var(--text-primary)', marginBottom: '2px' }}>
                  {ag.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  {ag.desc}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Role-Based Quick Tools */}
        {activeTab === 'tools' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0 0.5rem 0.5rem' }}>
              Available Tools ({currentRole?.toUpperCase()})
            </div>
            {getRoleTools().map((t, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(t.prompt)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  padding: '0.65rem 0.75rem',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
                className="hover:bg-blue-50 hover:border-blue-300 hover:text-primary"
              >
                <span>{t.name}</span>
                <ChevronRight size={13} className="text-slate-400" />
              </button>
            ))}
          </div>
        )}

        {/* Secondary Panel Footer */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
              {displayName.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--secondary)', fontWeight: 800 }}>{currentRole}</div>
            </div>
          </div>
          <button
            onClick={() => {
              loadObservability();
              setObservabilityOpen(true);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-primary hover:bg-white transition-colors cursor-pointer border border-transparent"
            title="System Observability & Vector Status"
            aria-label="Observability stats"
          >
            <Activity size={16} />
          </button>
        </div>
      </aside>

      {/* ----------------- MAIN WORKSPACE CONTENT ----------------- */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--bg-canvas)' }}>
        
        {/* Unified Workspace Top Bar */}
        <header style={{
          height: '56px',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem',
          zIndex: 10,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="btn btn-outline text-xs py-1.5 px-2.5"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Open Chat Sessions & Tools Panel"
                aria-label="Open sessions panel"
              >
                <PanelLeft size={15} className="text-primary" />
                <span className="font-semibold">Sessions</span>
              </button>
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                  AI Workspace
                </h1>
                {selectedAgent && (
                  <Badge variant="primary" size="xs">
                    {selectedAgent.name}
                  </Badge>
                )}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.1 }}>
                Ask, automate and analyze
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Status Pill: AI Assistant · Online */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-xs"
              title={currentRole === 'admin' ? 'Active Models: Qwen 2.5-Coder Vision + FastAPI Orchestrator' : 'CampusFlow AI Services Active'}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>AI Assistant · Online</span>
              {currentRole === 'admin' && (
                <span className="text-[10px] text-emerald-600 border-l border-emerald-300 pl-1.5 ml-0.5">
                  Qwen + OSS
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Conversation Thread Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}
              >
                <div
                  className={isUser ? 'ai-bubble-user' : 'ai-bubble-assistant'}
                  style={{
                    maxWidth: isUser ? '75%' : '85%'
                  }}
                >
                  {/* Assistant Header Badge */}
                  {!isUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={14} />
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {msg.agentUsed || 'ERPAssistantAgent'}
                      </span>
                      {formatIntentLabel(msg.detectedIntent) && (
                        <span className="badge badge-slate text-[10px]">
                          {formatIntentLabel(msg.detectedIntent)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Attachment indicator if user attached a file */}
                  {msg.attachment && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#FFFFFF' }}>
                      <Paperclip size={13} />
                      <span>{msg.attachment.name}</span>
                    </div>
                  )}

                  {/* Visual Tool Execution Step Indicators */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div style={{
                      backgroundColor: 'var(--surface-low)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '0.75rem 1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 800, marginBottom: '6px' }}>
                        ⚡ Autonomous Tool Execution
                      </div>
                      {msg.toolCalls.map((tc, tcIdx) => (
                        <div key={tcIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={14} color="var(--secondary)" />
                            <span>Tool: <code>{tc.tool}</code></span>
                          </div>
                          {tc.steps && tc.steps.map((st, sIdx) => (
                            <div key={sIdx} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', paddingLeft: '1.25rem' }}>
                              ✓ {st}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Main Markdown Content */}
                  <div className="ai-prose">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {/* Error State with Actionable Retry Button */}
                  {msg.isError && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--danger-50)',
                      border: '1px solid var(--danger-200)',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-700)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        <AlertTriangle size={15} />
                        <span>Execution issue detected. Would you like to retry?</span>
                      </div>
                      <button
                        onClick={() => handleSendMessage(msg.lastPrompt || prompt)}
                        className="btn btn-outline text-xs py-1 px-3 font-semibold"
                        style={{ borderColor: 'var(--danger-300)', color: 'var(--danger-700)', backgroundColor: '#FFFFFF' }}
                      >
                        <RotateCcw size={12} className="mr-1 inline" />
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Destructive Action Interactive Confirmation Card */}
                  {msg.requiresConfirmation && msg.confirmationAction && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      backgroundColor: 'var(--danger-50)',
                      border: '1px solid var(--danger-200)',
                      borderRadius: 'var(--radius-xl)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-700)', fontWeight: 700, fontSize: 'var(--text-xs)' }}>
                        <AlertTriangle size={16} />
                        <span>High-Impact Action Verification</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleSendMessage('Confirm', msg.confirmationAction)}
                          className="btn btn-danger text-xs py-1.5 px-3 font-bold"
                        >
                          Confirm & Execute
                        </button>
                        <button
                          onClick={() => setMessages(prev => [...prev, { id: `cancel-${Date.now()}`, role: 'assistant', text: 'Action cancelled.', timestamp: new Date().toISOString() }])}
                          className="btn btn-outline text-xs py-1.5 px-3"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Generated Files Card */}
                  {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {msg.generatedFiles.map((gf, gIdx) => (
                        <div
                          key={gIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: 'var(--success-50)',
                            border: '1px solid var(--success-200)',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-lg)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <FileSpreadsheet size={18} color="var(--success-700)" />
                            <div>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--success-900)' }}>{gf.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--success-700)' }}>Generated deliverable ready</div>
                            </div>
                          </div>
                          <a
                            href={gf.url}
                            download={gf.name}
                            className="btn btn-primary text-xs py-1.5 px-3 font-bold"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source Citations Pills */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ marginTop: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {msg.citations.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          style={{
                            fontSize: '11px',
                            backgroundColor: 'var(--surface-low)',
                            color: 'var(--text-secondary)',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <FileCheck size={11} color="var(--primary-600)" />
                          <span>{c.sourceCitation || `Source: ${c.title}`}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '10px', color: isUser ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                    {formatMessageTimestamp(msg.timestamp || msg.time)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking / Streaming Indicator */}
          {isGenerating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', padding: '0.5rem 1rem' }}>
              <div className="spinner-border text-primary" role="status" style={{ width: '1.25rem', height: '1.25rem' }} />
              <span>Orchestrating agent, checking permissions, and querying PostgreSQL...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Uploading Status Overlay */}
        {uploadingFile && (
          <div style={{ padding: '0.5rem 1.5rem', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', fontSize: 'var(--text-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="spinner-border text-primary" style={{ width: '1rem', height: '1rem' }} />
            <span>{uploadProgress || 'Processing document through AI pipeline...'}</span>
          </div>
        )}

        {/* Bottom Input Area */}
        <div style={{ padding: '0.85rem 1.25rem 1rem', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border-subtle)' }}>
          
          {/* File attachment preview pill */}
          {attachedFile && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--surface-low)', padding: '6px 12px', borderRadius: 'var(--radius-lg)', marginBottom: '0.5rem', fontSize: 'var(--text-xs)', border: '1px solid var(--border-subtle)' }}>
              <FileText size={14} color="var(--primary-600)" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{attachedFile.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}>({attachedFile.size})</span>
              <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Remove attached file">
                <X size={13} />
              </button>
            </div>
          )}

          <div className="ai-input-container">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.xlsx,.xls,.csv,.pptx,.ppt,.docx,.png,.jpg,.jpeg,.webp,.txt"
              style={{ display: 'none' }}
            />

            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline text-xs py-2 px-3"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}
              title="Attach PDF, Excel, PPTX, or Image"
              aria-label="Attach file"
            >
              <Paperclip size={14} />
              <span>Attach</span>
            </button>

            {/* Input textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything as ${(currentRole || 'User').toUpperCase()} (e.g. "Show teachers on leave today", "Generate timetable for 5A")...`}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                maxHeight: '120px',
                resize: 'none',
                padding: '6px 0'
              }}
            />

            {/* Send button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={isGenerating || (!prompt.trim() && !attachedFile)}
              className="btn btn-primary"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-lg)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: (!prompt.trim() && !attachedFile) ? 0.45 : 1,
                cursor: (!prompt.trim() && !attachedFile) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Send Prompt (Enter)"
              aria-label="Send Message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </main>

      {/* ----------------- OBSERVABILITY MODAL ----------------- */}
      {observabilityOpen && (
        <div className="modal-backdrop" onClick={() => setObservabilityOpen(false)}>
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '620px', width: '92%' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="modal-title">
                    Admin Observability & Vector Health
                  </h3>
                  <p className="modal-subtitle">Real-time status of reasoning engines and knowledge base</p>
                </div>
              </div>
              <button
                onClick={() => setObservabilityOpen(false)}
                className="modal-close-btn"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {observabilityStats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div style={{ backgroundColor: 'var(--surface-low)', padding: '1rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Documents</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{observabilityStats.totalDocuments}</div>
                    <div style={{ fontSize: '11px', color: 'var(--secondary)', marginTop: '2px', fontWeight: 600 }}>{observabilityStats.completedDocuments} Indexed & Ready</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--surface-low)', padding: '1rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>Qdrant Chunks (Vectors)</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--primary-700)' }}>{observabilityStats.totalChunksIndexed}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{observabilityStats.qdrantStatus}</div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--surface-low)', padding: '1rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active LLM & Vision Models</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Reasoning LLM:</strong> <code>{observabilityStats.models?.llm}</code></div>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Vision Engine:</strong> <code>{observabilityStats.models?.vision}</code></div>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Embeddings:</strong> <code>{observabilityStats.models?.embeddings}</code></div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent Agent Tool Executions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {observabilityStats.recentExecutions?.map((ex, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: 'var(--surface-low)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{ex.agent}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{ex.action}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ex.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                Loading real observability statistics...
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
