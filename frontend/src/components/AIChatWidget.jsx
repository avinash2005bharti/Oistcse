import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useERP } from '../context/ERPContext';
import { aiApi } from '../api/aiApi';
import { fileApi } from '../api/fileApi';
import {
  Bot,
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  FileText,
  User,
  CornerDownLeft,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Download,
  AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

export default function AIChatWidget() {
  const { currentRole, currentUser } = useERP();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const conversationIdRef = useRef(`conv-${Date.now()}`);
  const [messages, setMessages] = useState(() => [
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: `👋 Hello ${currentUser?.name ? currentUser.name.split(' ')[0] : 'there'}! I am your **CampusFlow AI Copilot**.\n\nI can analyze your attendance health, retrieve your class timetable, answer engineering & technical questions, explain leave clearances, or check department status. How can I assist you today?`,
      time: 'Just now'
    }
  ]);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      textareaRef.current?.focus();
    }
  }, [isOpen, messages]);

  // Suggested quick prompts per role
  const getRoleSuggestions = () => {
    switch (currentRole) {
      case 'student':
        return [
          'What is my attendance standing?',
          'What is my next class and room?',
          'How do I apply for Hackathon leave?'
        ];
      case 'teacher':
        return [
          'Show today\'s teaching schedule',
          'Which students are below the attendance requirement?',
          'Pending assignment evaluations'
        ];
      case 'tg':
        return [
          'Show students below 75% attendance',
          'Which students are at risk?',
          'Show pending requests',
          'Who has the lowest attendance?',
          'Show students needing mentor intervention'
        ];
      case 'hod':
        return [
          'Summary of pending leave approvals',
          'Run AI timetable conflict diagnosis',
          'Department attendance health report'
        ];
      case 'admin':
      default:
        return [
          'Academic enrollment overview',
          'System health and uptime report',
          'Institutional directory summary'
        ];
    }
  };

  // Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
          textareaRef.current?.focus();
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('SpeechRecognition unavailable:', e);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const res = await fileApi.upload(file, conversationIdRef.current);
        if (res && res.file) {
          setAttachedFile({
            id: res.file.id,
            name: res.file.filename,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: res.file.fileType,
            url: res.file.storageUrl || '',
            status: 'ready'
          });
        } else {
          setAttachedFile({
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB'
          });
        }
      } catch (uploadErr) {
        console.warn('Widget file upload warning:', uploadErr);
        setAttachedFile({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB'
        });
      }
    }
    e.target.value = '';
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || prompt).trim();
    if (!query && !attachedFile) return;

    const fileRef = attachedFile ? { ...attachedFile } : null;
    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: query,
      attachment: fileRef,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setAttachedFile(null);
    setIsGenerating(true);

    try {
      const res = await aiApi.chat({
        prompt: query,
        role: currentRole || 'student',
        user_id: currentUser?.id || 'user_default',
        conversation_id: conversationIdRef.current,
        attachment: fileRef,
        file_id: fileRef?.id || null
      });

      const responseText = res?.answer || res?.data?.answer;
      if (!responseText) throw new Error('The AI service returned an empty response.');
      const assistantMsg = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        text: responseText,
        agent_used: res?.agent_used,
        detected_intent: res?.detected_intent,
        steps: res?.steps || [],
        requires_confirmation: res?.requires_confirmation,
        confirmation_prompt: res?.confirmation_prompt,
        action_to_confirm: res?.action_to_confirm,
        deliverable: res?.deliverable,
        citations: res?.citations || [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.warn('[AIChatWidget] AI Service query note:', err.message);
      const assistantMsg = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        text: 'The AI service is unavailable right now. Please try again later.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAction = async (msgId, actionToConfirm) => {
    setIsGenerating(true);
    try {
      const res = await aiApi.chat({
        prompt: `CONFIRM: ${actionToConfirm.tool}`,
        confirmed_action: actionToConfirm,
        role: currentRole || 'student',
        user_id: currentUser?.id || 'user_default',
        conversation_id: conversationIdRef.current
      });

      const responseText = res?.answer || res?.data?.answer || 'Action executed successfully.';
      const confirmReplyMsg = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        text: responseText,
        steps: res?.steps || [],
        deliverable: res?.deliverable,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => prev.map(m => m.id === msgId ? { ...m, requires_confirmation: false } : m).concat(confirmReplyMsg));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelAction = (msgId) => {
    setMessages((prev) => prev.map(m => m.id === msgId ? { ...m, requires_confirmation: false } : m).concat({
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      text: 'Action cancelled.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
  };

  const handleClearChat = () => {
    conversationIdRef.current = `conv-${Date.now()}`;
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        role: 'assistant',
        text: `👋 New session started! How can I assist you with your CSE academic queries, timetable, attendance, or technical questions today?`,
        time: 'Just now'
      }
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (location.pathname.includes('ai-workspace')) {
    return null;
  }

  return (
    <>
      {/* Floating Chat Trigger Button (Fixed Bottom-Right) */}
      <div
        style={{
          position: 'fixed',
          bottom: '1.75rem',
          right: '1.75rem',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >


        <button
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-float)',
            border: '2px solid rgba(255, 255, 255, 0.95)',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="hover:scale-105 active:scale-95"
          title={isOpen ? 'Close AI Assistant' : 'Chat with CampusFlow AI'}
          aria-label="Toggle AI Chat"
        >
          {isOpen ? <X size={20} /> : <Bot size={22} />}
          {!isOpen && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                border: '2px solid #FFFFFF'
              }}
            />
          )}
        </button>
      </div>

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '5.5rem',
            right: '1.75rem',
            zIndex: 95,
            width: '400px',
            maxWidth: 'calc(100vw - 2.5rem)',
            height: '560px',
            maxHeight: 'calc(100vh - 7.5rem)',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-2xl)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'modalScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              backgroundColor: 'var(--primary-800)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-sm)', fontWeight: 800, margin: 0, lineHeight: 1.2, color: '#FFFFFF' }}>
                  CampusFlow AI Copilot
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--primary-200)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--secondary)', display: 'inline-block' }} />
                  Live Academic Assistant
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={handleClearChat}
                style={{
                  color: '#FFFFFF',
                  padding: '6px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'background 0.15s ease'
                }}
                title="New Chat Session"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/ai-workspace', { state: { conversationId: conversationIdRef.current } });
                }}
                style={{
                  color: '#FFFFFF',
                  padding: '6px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'background 0.15s ease'
                }}
                title="Open Fullscreen AI Workspace"
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  color: '#FFFFFF',
                  padding: '6px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'background 0.15s ease'
                }}
                title="Close Chat"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Quick Suggestion Pills */}
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--surface-low)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            {getRoleSuggestions().map((sugg, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sugg)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '0.35rem 0.7rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--primary-700)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                className="hover:border-blue-400 hover:text-blue-800"
              >
                {sugg}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              padding: '1rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              backgroundColor: 'var(--bg-canvas)'
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    alignSelf: isUser ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      backgroundColor: isUser ? 'var(--primary-700)' : 'var(--surface)',
                      color: isUser ? '#FFFFFF' : 'var(--text-primary)',
                      fontSize: 'var(--text-xs)',
                      lineHeight: 1.55,
                      boxShadow: 'var(--shadow-xs)',
                      border: isUser ? 'none' : '1px solid var(--border-subtle)',
                      whiteSpace: isUser ? 'pre-wrap' : 'normal'
                    }}
                  >
                    {!isUser && msg.agent_used && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          marginBottom: '0.45rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--primary-50)',
                          color: 'var(--primary-700)',
                          fontSize: '10px',
                          fontWeight: 700
                        }}
                      >
                        <Sparkles size={11} />
                        <span>{msg.agent_used}</span>
                      </div>
                    )}
                    {isUser ? (
                      <div>{msg.text}</div>
                    ) : (
                      <div className="ai-prose" style={{ fontSize: 'var(--text-xs)' }}>
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkGfm]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.text}
                        </ReactMarkdown>

                        {/* Agent Tool Execution Steps */}
                        {msg.steps && msg.steps.length > 0 && (
                          <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '3px', background: 'var(--surface-low)', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                            {msg.steps.map((st, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--secondary)', fontWeight: 600 }}>
                                <span>✓</span> <span>{st}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Destructive Action Confirmation */}
                        {msg.requires_confirmation && (
                          <div style={{ marginTop: '0.6rem', padding: '0.65rem', backgroundColor: 'var(--danger-50)', border: '1px solid var(--danger-200)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger-700)', fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>
                              <AlertTriangle size={12} /> High-Impact Action Confirmation
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--danger-800)', marginBottom: '8px' }}>
                              {msg.confirmation_prompt}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => handleConfirmAction(msg.id, msg.action_to_confirm)}
                                className="btn btn-danger text-[10px] py-1 px-2.5 font-bold"
                              >
                                Confirm & Execute
                              </button>
                              <button
                                onClick={() => handleCancelAction(msg.id)}
                                className="btn btn-outline text-[10px] py-1 px-2.5"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Downloadable Deliverable */}
                        {msg.deliverable && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.65rem', backgroundColor: 'var(--success-50)', border: '1px solid var(--success-200)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--success-900)' }}>{msg.deliverable.filename}</span>
                              <a
                                href={msg.deliverable.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--success-700)', textDecoration: 'none', fontWeight: 700 }}
                              >
                                <Download size={12} /> Download
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Source Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div style={{ marginTop: '0.45rem', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {msg.citations.map((c, i) => (
                              <span key={i} style={{ fontSize: '10px', backgroundColor: 'var(--surface-low)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 600, border: '1px solid var(--border-subtle)' }}>
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.attachment && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.35rem 0.6rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : 'var(--surface-low)',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          border: isUser ? 'none' : '1px solid var(--border-subtle)'
                        }}
                      >
                        <FileText size={13} />
                        <span>{msg.attachment.name}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', padding: '0 4px' }}>
                    {msg.time}
                  </span>
                </div>
              );
            })}

            {isGenerating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', padding: '0.5rem' }}>
                <span className="spinner-border spinner-border-sm text-primary" role="status" style={{ width: '14px', height: '14px' }} />
                <span>Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Attached File Preview */}
          {attachedFile && (
            <div
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: 'var(--primary-50)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--primary-700)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText size={14} />
                <span style={{ fontWeight: 600 }}>{attachedFile.name} ({attachedFile.size})</span>
              </div>
              <button
                onClick={() => setAttachedFile(null)}
                style={{ color: 'var(--danger-600)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input Box Footer */}
          <div
            style={{
              padding: '0.65rem 0.75rem',
              backgroundColor: 'var(--surface)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--surface-low)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title="Attach Document"
            >
              <Paperclip size={16} />
            </button>

            <button
              type="button"
              onClick={toggleListening}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: isListening ? 'var(--danger-50)' : 'var(--surface-low)',
                color: isListening ? 'var(--danger-600)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title={isListening ? 'Stop Voice Recording' : 'Voice Input'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about timetable, attendance, leave..."
              style={{
                flex: 1,
                padding: '0.45rem 0.65rem',
                fontSize: 'var(--text-xs)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.4,
                maxHeight: '75px',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                backgroundColor: 'var(--surface)'
              }}
            />

            <button
              type="button"
              disabled={!prompt.trim() && !attachedFile}
              onClick={() => handleSend()}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: (prompt.trim() || attachedFile) ? 'var(--primary-700)' : 'var(--slate-200)',
                color: (prompt.trim() || attachedFile) ? '#FFFFFF' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: (prompt.trim() || attachedFile) ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'background 0.2s ease'
              }}
              title="Send Message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
