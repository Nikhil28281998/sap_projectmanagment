import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer, Input, Button, Typography, Space, Tag, Spin, Avatar, Empty,
  Upload, Modal, Select, Switch, message as antMessage
} from 'antd';
import {
  RobotOutlined, SendOutlined, UserOutlined, CloseOutlined,
  BulbOutlined, UploadOutlined, FileTextOutlined, SaveOutlined
} from '@ant-design/icons';
import { aiApi, templateApi } from '../../services/api';

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
      content: 'Hi! I\'m your SAP Project Assistant. I can answer questions about your projects, transports, test status, milestones, and more.\n\nYou can also generate report templates — paste your current email format or upload a file, and I\'ll create a reusable Outlook template for you!',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // Template generation state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateEmail, setTemplateEmail] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateScope, setTemplateScope] = useState('single');
  const [templateVisibility, setTemplateVisibility] = useState('private');
  const [templateDefault, setTemplateDefault] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');

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

  // ─── Template generation from email ───
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTemplateEmail(content);
      setTemplateModalOpen(true);
    };
    reader.readAsText(file);
    return false; // prevent auto upload
  };

  const handleGenerateTemplate = async () => {
    if (!templateEmail.trim()) {
      antMessage.warning('Please paste or upload an email sample.');
      return;
    }
    if (!templateName.trim()) {
      antMessage.warning('Please provide a template name.');
      return;
    }

    setGeneratingTemplate(true);
    try {
      const result = await aiApi.generateTemplate(templateEmail, templateName, templateScope);
      if (result.success) {
        setGeneratedHtml(result.templateHtml);
        // Add a message in chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Template "${templateName}" generated successfully using ${result.provider}! You can preview it below and save it.`,
          timestamp: new Date(),
          provider: result.provider,
        }]);
        antMessage.success('Template generated! Review and save below.');
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Generation failed: ${err.message}`);
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!generatedHtml) return;
    try {
      const result = await templateApi.save({
        templateName,
        description: `AI-generated from email sample (${templateScope} scope)`,
        templateHtml: generatedHtml,
        scope: templateScope,
        visibility: templateVisibility,
        isDefault: templateDefault,
      });
      if (result.success) {
        antMessage.success(`Template saved! ${templateVisibility === 'public' ? 'Visible to all users.' : 'Private to you.'}`);
        setTemplateModalOpen(false);
        setGeneratedHtml('');
        setTemplateEmail('');
        setTemplateName('');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Template "${templateName}" has been saved as ${templateVisibility}. ${templateDefault ? 'It is set as your default template.' : ''} You can find it in the Report Builder under custom templates.`,
          timestamp: new Date(),
        }]);
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Save failed: ${err.message}`);
    }
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
        <Space>
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => setTemplateModalOpen(true)}
          >
            New Template
          </Button>
          <Button size="small" onClick={clearChat}>Clear</Button>
        </Space>
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
                    color={msg.provider === 'claude' ? 'orange' : msg.provider === 'gemini' ? 'blue' : 'green'}
                    style={{ fontSize: 10-1, margin: 0 }}
                  >
                    {msg.provider === 'claude' ? 'Claude' : msg.provider === 'gemini' ? 'Gemini' : 'ChatGPT'}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Shift+Enter for new line • AI queries your live project data
          </Text>
          <Upload
            accept=".txt,.html,.htm,.eml,.msg"
            showUploadList={false}
            beforeUpload={handleFileUpload}
          >
            <Button type="link" size="small" icon={<UploadOutlined />} style={{ fontSize: 10, padding: 0 }}>
              Upload email sample
            </Button>
          </Upload>
        </div>
      </div>

      {/* Template Generation Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1677ff' }} />
            Generate Report Template from Email
          </Space>
        }
        open={templateModalOpen}
        onCancel={() => { setTemplateModalOpen(false); setGeneratedHtml(''); }}
        footer={null}
        width={700}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Template Name</Text>
            <Input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. Weekly Status — FICO Projects"
              maxLength={200}
            />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Scope</Text>
              <Select
                value={templateScope}
                onChange={setTemplateScope}
                style={{ width: '100%' }}
                options={[
                  { value: 'single', label: 'Single Project' },
                  { value: 'multi', label: 'All Projects' },
                  { value: 'both', label: 'Both' },
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Visibility</Text>
              <Select
                value={templateVisibility}
                onChange={setTemplateVisibility}
                style={{ width: '100%' }}
                options={[
                  { value: 'private', label: 'Private (only me)' },
                  { value: 'public', label: 'Public (all users)' },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={templateDefault} onChange={setTemplateDefault} size="small" />
            <Text>Set as my default template</Text>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text strong>Paste or Upload Your Email Sample</Text>
              <Upload
                accept=".txt,.html,.htm,.eml,.msg"
                showUploadList={false}
                beforeUpload={(file) => {
                  const reader = new FileReader();
                  reader.onload = (e) => setTemplateEmail(e.target?.result as string);
                  reader.readAsText(file);
                  return false;
                }}
              >
                <Button size="small" icon={<UploadOutlined />}>Upload File</Button>
              </Upload>
            </div>
            <TextArea
              value={templateEmail}
              onChange={e => setTemplateEmail(e.target.value)}
              placeholder="Paste your current email report here... The AI will analyze the structure and generate a reusable Outlook HTML template with {{placeholders}} for dynamic data."
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleGenerateTemplate}
            loading={generatingTemplate}
            block
            size="large"
            disabled={!templateEmail.trim() || !templateName.trim()}
          >
            {generatingTemplate ? 'AI is generating template...' : 'Generate Template with AI'}
          </Button>

          {generatedHtml && (
            <>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Preview</Text>
                <div
                  dangerouslySetInnerHTML={{ __html: generatedHtml }}
                  style={{
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    padding: 16,
                    maxHeight: 300,
                    overflow: 'auto',
                    background: '#fff',
                  }}
                />
              </div>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveTemplate}
                block
                size="large"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                Save Template ({templateVisibility === 'public' ? 'Public' : 'Private'})
              </Button>
            </>
          )}
        </Space>
      </Modal>
    </Drawer>
  );
};

export default AIChatDrawer;
