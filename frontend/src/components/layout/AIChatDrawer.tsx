/**
 * AIChatDrawer — Main AI Assistant drawer.
 *
 * Extracted sub-components:
 *   - AIDocumentAnalysis → document analysis modal (upload + SharePoint browse)
 *   - AITemplateBuilder  → report template generation modal
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  Drawer, Input, Button, Typography, Space, Tag, Spin, Avatar,
} from 'antd';
import {
  RobotOutlined, SendOutlined, UserOutlined, BulbOutlined,
  FileSearchOutlined, ThunderboltOutlined, WarningOutlined,
  ProjectOutlined, CalendarOutlined, QuestionCircleOutlined,
  FileAddOutlined, FileTextOutlined, ClearOutlined,
} from '@ant-design/icons';
import { aiApi } from '../../services/api';
import { useModule } from '../../contexts/ModuleContext';
import AIDocumentAnalysis from './AIDocumentAnalysis';
import AITemplateBuilder from './AITemplateBuilder';

const { Text } = Typography;
const { TextArea } = Input;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
}

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_QUESTIONS = [
  { icon: <WarningOutlined />,       text: 'Which projects are RED status?' },
  { icon: <ThunderboltOutlined />,   text: 'Show me projects with failed tests' },
  { icon: <CalendarOutlined />,      text: 'Any go-lives coming up this month?' },
  { icon: <FileSearchOutlined />,    text: 'What transports are stuck?' },
  { icon: <ProjectOutlined />,       text: 'Summary of all active projects' },
  { icon: <QuestionCircleOutlined />,text: 'Which projects need attention?' },
];

const ChatMessageItem = memo(({ msg }: { msg: ChatMessage }) => (
  <div className={`ai-msg-row ${msg.role === 'user' ? 'ai-msg-row-user' : 'ai-msg-row-bot'}`}>
    <Avatar
      size={28}
      icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
      className={msg.role === 'user' ? 'ai-avatar-user' : 'ai-avatar-bot'}
    />
    <div className={`ai-msg-bubble ${msg.role === 'user' ? 'ai-msg-bubble-user' : 'ai-msg-bubble-bot'}`}>
      {msg.content}
      {msg.provider && (
        <div className="mt-4">
          <Tag color={msg.provider === 'claude' ? 'orange' : msg.provider === 'gemini' ? 'blue' : 'green'}>
            {msg.provider === 'claude' ? 'Claude' : msg.provider === 'gemini' ? 'Gemini' : 'ChatGPT'}
          </Tag>
        </div>
      )}
    </div>
  </div>
));

const INITIAL_MESSAGE: ChatMessage = {
  role: 'system',
  content: "Hi! I'm your Project Command Center AI Assistant.\n\nI can help you with:\n\n\u2022 Answer questions about projects, transports, and test status\n\u2022 Analyze documents (use the Analyze Doc button above)\n\u2022 Generate report templates\n\nAsk me anything or try a quick question below.",
  timestamp: new Date(),
};

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ open, onClose }) => {
  const { activeModule } = useModule();
  const defaultApp = 'SAP';

  const [messages,     setMessages]     = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const sendMessage = useCallback(async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    appendMessage({ role: 'user', content: q, timestamp: new Date() });
    setInput('');
    setLoading(true);

    try {
      const result = await aiApi.chat(q);
      appendMessage({ role: 'assistant', content: result.answer, timestamp: new Date(), provider: result.provider });
    } catch (err: any) {
      appendMessage({
        role: 'assistant',
        content: `Sorry, I couldn't process that request.\n\nError: ${err.message || 'Connection failed'}\n\nTo fix: Go to Settings \u2192 AI Integration and verify your API key is configured.`,
        timestamp: new Date(),
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, appendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => setMessages([{
    role: 'system',
    content: 'Chat cleared. How can I help you?',
    timestamp: new Date(),
  }]);

  const handleDocCreated = useCallback((msg: string) => {
    appendMessage({
      role: 'assistant',
      content: `${msg}\n\nThe new work items are now visible in the Tracker.`,
      timestamp: new Date(),
    });
  }, [appendMessage]);

  const handleTemplateSaved = useCallback((name: string, visibility: string, isDefault: boolean) => {
    appendMessage({
      role: 'assistant',
      content: `Template "${name}" saved as ${visibility}.${isDefault ? ' Set as your default template.' : ''}\n\nFind it in the Report Builder under custom templates.`,
      timestamp: new Date(),
    });
  }, [appendMessage]);

  return (
    <>
      <Drawer
        title={
          <div className="ai-drawer-header">
            <RobotOutlined className="ai-drawer-header-icon" />
            <span className="ai-drawer-header-title">AI Assistant</span>
          </div>
        }
        placement="right"
        width={420}
        open={open}
        onClose={onClose}
        extra={
          <Space size={2}>
            <Button size="small" icon={<FileAddOutlined />}
              onClick={() => setDocModalOpen(true)} type="primary" ghost
              aria-label="Analyze a document">
              Analyze
            </Button>
            <Button size="small" icon={<ClearOutlined />}
              onClick={clearChat} aria-label="Clear chat" />
          </Space>
        }
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
      >
        {/* Messages */}
        <div className="ai-messages-area">
          {messages.map((msg, idx) => <ChatMessageItem key={idx} msg={msg} />)}
          {loading && (
            <div className="ai-loading-row">
              <Avatar size={28} icon={<RobotOutlined />} className="ai-avatar-bot" />
              <Spin size="small" />
              <Text type="secondary">Thinking...</Text>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions + tools — fresh chat only */}
        {messages.length <= 1 && (
          <div className="ai-quick-section">
            <div className="ai-quick-label">
              <BulbOutlined /> Try asking:
            </div>
            <div className="ai-quick-tags">
              {QUICK_QUESTIONS.map((q, i) => (
                <Tag key={i} className="ai-quick-tag" role="button" tabIndex={0}
                  aria-label={q.text} icon={q.icon}
                  onClick={() => sendMessage(q.text)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sendMessage(q.text); } }}>
                  {q.text}
                </Tag>
              ))}
            </div>
            <div className="ai-quick-tools">
              <Button size="small" icon={<FileTextOutlined />} onClick={() => setTplModalOpen(true)}>
                Create Report Template
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="ai-input-area">
          <Space.Compact className="w-full">
            <TextArea ref={inputRef} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your projects..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="ai-input-field" disabled={loading}
              aria-label="Chat message input" />
            <Button type="primary" icon={<SendOutlined />}
              onClick={() => sendMessage()} loading={loading}
              className="ai-send-btn" aria-label="Send message" />
          </Space.Compact>
          <div className="ai-input-hint">
            <Text type="secondary">Shift+Enter for new line &middot; AI queries your live project data</Text>
          </div>
        </div>
      </Drawer>

      <AIDocumentAnalysis open={docModalOpen} defaultApp={defaultApp}
        onClose={() => setDocModalOpen(false)} onCreated={handleDocCreated} />
      <AITemplateBuilder open={tplModalOpen}
        onClose={() => setTplModalOpen(false)} onSaved={handleTemplateSaved} />
    </>
  );
};

export default AIChatDrawer;
