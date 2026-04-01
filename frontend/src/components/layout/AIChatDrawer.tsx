import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer, Input, Button, Typography, Space, Tag, Spin, Avatar, Empty
} from 'antd';
import {
  RobotOutlined, SendOutlined, UserOutlined, CloseOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { aiApi } from '../../services/api';

const { Text, Paragraph } = Typography;
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
  'Which projects are RED status?',
  'Show me projects with failed tests',
  'Any go-lives coming up this month?',
  'What transports are stuck?',
  'Give me a summary of all active projects',
  'Which projects need attention?',
];

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ open, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content: 'Hi! I\'m your SAP Project Assistant. I can answer questions about your projects, transports, test status, milestones, and more. Ask me anything!',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: q, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await aiApi.chat(q);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
        provider: result.provider,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response'}. Make sure AI is configured in Settings → AI Integration.`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'system',
      content: 'Chat cleared. Ask me anything about your projects!',
      timestamp: new Date(),
    }]);
  };

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined style={{ color: '#1677ff' }} />
          <span>AI Project Assistant</span>
        </Space>
      }
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      extra={
        <Button size="small" onClick={clearChat}>Clear</Button>
      }
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        minHeight: 'calc(100vh - 220px)',
        maxHeight: 'calc(100vh - 220px)',
      }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 16,
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <Avatar
              size="small"
              icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{
                backgroundColor: msg.role === 'user' ? '#1677ff' : '#52c41a',
                flexShrink: 0,
              }}
            />
            <div style={{
              maxWidth: '85%',
              background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
              color: msg.role === 'user' ? '#fff' : '#000',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
              {msg.provider && (
                <div style={{ marginTop: 4 }}>
                  <Tag
                    color={msg.provider === 'claude' ? 'orange' : 'green'}
                    style={{ fontSize: 10-1, margin: 0 }}
                  >
                    {msg.provider === 'claude' ? 'Claude' : 'ChatGPT'}
                  </Tag>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 12 }}>Thinking...</Text>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 8px', borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8, marginBottom: 6 }}>
            <BulbOutlined /> Try asking:
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <Tag
                key={i}
                color="blue"
                style={{ cursor: 'pointer', fontSize: 11, margin: 0 }}
                onClick={() => sendMessage(q)}
              >
                {q}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your projects, transports, tests..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ borderRadius: '8px 0 0 8px' }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => sendMessage()}
            loading={loading}
            style={{ height: 'auto', borderRadius: '0 8px 8px 0' }}
          />
        </Space.Compact>
        <Text type="secondary" style={{ fontSize: 10, marginTop: 4, display: 'block' }}>
          Shift+Enter for new line • AI queries your live project data
        </Text>
      </div>
    </Drawer>
  );
};

export default AIChatDrawer;
