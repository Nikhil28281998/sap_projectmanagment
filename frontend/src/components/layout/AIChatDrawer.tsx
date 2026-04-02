import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Drawer, Input, Button, Typography, Space, Tag, Spin, Avatar, Empty,
  Upload, Modal, Select, Switch, Tabs, Tooltip, message as antMessage,
  Card, Checkbox, Alert, Badge, Divider, Row, Col
} from 'antd';
import {
  RobotOutlined, SendOutlined, UserOutlined, CloseOutlined,
  BulbOutlined, UploadOutlined, FileTextOutlined, SaveOutlined,
  CodeOutlined, EyeOutlined, UndoOutlined, FormatPainterOutlined,
  FileAddOutlined, CheckCircleOutlined, InboxOutlined,
  MailOutlined, MedicineBoxOutlined, CloudOutlined, FileSearchOutlined,
} from '@ant-design/icons';
import { aiApi, templateApi, workItemApi } from '../../services/api';
import { useModule, MODULE_DEFINITIONS, ModuleKey } from '../../contexts/ModuleContext';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

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

const DOC_TYPES = [
  { value: 'email', label: 'Email / Request', icon: <MailOutlined /> },
  { value: 'veeva', label: 'Veeva Change Control', icon: <MedicineBoxOutlined /> },
  { value: 'sharepoint', label: 'SharePoint Document', icon: <CloudOutlined /> },
  { value: 'general', label: 'General Document', icon: <FileSearchOutlined /> },
];

interface Proposal {
  workItemName: string;
  workItemType: string;
  projectCode: string;
  priority: string;
  complexity: string;
  currentPhase: string;
  businessOwner: string;
  notes: string;
  estimatedGoLive: string;
  confidence: string;
  selected?: boolean;
}

const CONFIDENCE_COLORS: Record<string, string> = { high: 'green', medium: 'orange', low: 'red' };
const PRIORITY_COLORS: Record<string, string> = { P1: 'red', P2: 'orange', P3: 'blue' };

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ open, onClose }) => {
  const { activeModule } = useModule();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content: 'Hi! I\'m your Project Command Center AI Assistant. I can answer questions about your projects, analyze uploaded documents, and help create work items.\n\n📄 Upload emails, Veeva Change Controls, or any project document — I\'ll analyze it and propose work items for you to review and approve.',
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
  const [originalHtml, setOriginalHtml] = useState('');
  const [editorTab, setEditorTab] = useState<'code' | 'preview'>('code');

  // Document analysis state
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docContent, setDocContent] = useState('');
  const [docType, setDocType] = useState('email');
  const [docFileName, setDocFileName] = useState('');
  const [docApp, setDocApp] = useState<string>(activeModule === 'sap' ? 'SAP' : activeModule === 'coupa' ? 'Coupa' : 'Commercial');
  const [analyzing, setAnalyzing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [creating, setCreating] = useState(false);

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

  // ─── Document Analysis ───
  const handleDocFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setDocContent(content);
      setDocFileName(file.name);
      // Auto-detect document type from extension
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.eml') || ext.endsWith('.msg') || ext.includes('email')) {
        setDocType('email');
      } else if (ext.includes('veeva') || ext.includes('change-control') || ext.includes('cc-')) {
        setDocType('veeva');
      } else if (ext.includes('sharepoint')) {
        setDocType('sharepoint');
      }
    };
    reader.readAsText(file);
    return false;
  };

  const handleAnalyzeDocument = async () => {
    if (!docContent.trim()) {
      antMessage.warning('Please paste or upload document content.');
      return;
    }
    setAnalyzing(true);
    setProposals([]);
    setAnalysisSummary('');

    try {
      const result = await aiApi.analyzeDocument(docContent, docType, docApp, docFileName);
      if (result.success) {
        const parsed: Proposal[] = JSON.parse(result.proposals).map((p: Proposal) => ({ ...p, selected: true }));
        setProposals(parsed);
        setAnalysisSummary(result.summary);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `📄 Document analyzed: "${docFileName || 'Uploaded document'}"\n\n${result.summary}\n\n${parsed.length} work item(s) proposed. Review them in the Document Analysis panel.`,
          timestamp: new Date(),
          provider: result.provider,
        }]);
        antMessage.success(`AI found ${parsed.length} potential work item(s)`);
      } else {
        antMessage.error(result.summary || 'Analysis failed');
      }
    } catch (err: any) {
      antMessage.error(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleProposal = (index: number) => {
    setProposals(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
  };

  const handleCreateSelected = async () => {
    const selected = proposals.filter(p => p.selected);
    if (selected.length === 0) {
      antMessage.warning('No items selected to create.');
      return;
    }
    setCreating(true);
    try {
      const result = await aiApi.createFromProposal(JSON.stringify(selected), docApp);
      if (result.success) {
        antMessage.success(result.message);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ ${result.message}\n\nThe new work items are now visible in the Tracker. You can click on them to add more details, assign team members, and set milestones.`,
          timestamp: new Date(),
        }]);
        // Clear proposals after creation
        setProposals([]);
        setDocContent('');
        setDocFileName('');
        setDocModalOpen(false);
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
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
        setOriginalHtml(result.templateHtml);
        setEditorTab('code');
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
        setOriginalHtml('');
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
            icon={<FileAddOutlined />}
            onClick={() => setDocModalOpen(true)}
            type="primary"
            ghost
          >
            Analyze Doc
          </Button>
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
          <Space size={4}>
            <Upload
              accept=".txt,.html,.htm,.eml,.msg,.csv,.xlsx,.doc,.docx,.pdf"
              showUploadList={false}
              beforeUpload={(file) => {
                handleDocFileUpload(file);
                setDocModalOpen(true);
                return false;
              }}
            >
              <Button type="link" size="small" icon={<FileAddOutlined />} style={{ fontSize: 10, padding: 0 }}>
                Upload & Analyze
              </Button>
            </Upload>
            <Upload
              accept=".txt,.html,.htm,.eml,.msg"
              showUploadList={false}
              beforeUpload={handleFileUpload}
            >
              <Button type="link" size="small" icon={<UploadOutlined />} style={{ fontSize: 10, padding: 0 }}>
                Email template
              </Button>
            </Upload>
          </Space>
        </div>
      </div>

      {/* Document Analysis Modal */}
      <Modal
        title={
          <Space>
            <FileSearchOutlined style={{ color: '#1677ff' }} />
            <span>AI Document Analysis</span>
            <Tag color="blue">Beta</Tag>
          </Space>
        }
        open={docModalOpen}
        onCancel={() => { setDocModalOpen(false); setProposals([]); setAnalysisSummary(''); }}
        footer={null}
        width={760}
        styles={{ body: { maxHeight: '75vh', overflow: 'auto' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="Upload any project document — emails, Veeva Change Controls, SharePoint exports, or general documents. AI will analyze the content and propose work items for your review."
            type="info"
            showIcon
            style={{ fontSize: 12 }}
          />

          <Row gutter={12}>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Document Type</Text>
              <Select
                value={docType}
                onChange={setDocType}
                style={{ width: '100%' }}
                options={DOC_TYPES.map(dt => ({ value: dt.value, label: <Space size={4}>{dt.icon}{dt.label}</Space> }))}
              />
            </Col>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Target Application</Text>
              <Select
                value={docApp}
                onChange={setDocApp}
                style={{ width: '100%' }}
                options={[
                  { value: 'SAP', label: '⚙️ SAP Project Management' },
                  { value: 'Coupa', label: '🛒 Coupa Project Management' },
                  { value: 'Commercial', label: '💊 Commercial Project Management' },
                ]}
              />
            </Col>
          </Row>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text strong>Document Content</Text>
              {docFileName && <Tag color="blue">{docFileName}</Tag>}
            </div>
            {!docContent ? (
              <Dragger
                accept=".txt,.html,.htm,.eml,.msg,.csv,.xlsx,.doc,.docx"
                showUploadList={false}
                beforeUpload={handleDocFileUpload}
                style={{ padding: '20px 0' }}
              >
                <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 36, color: '#1677ff' }} /></p>
                <p className="ant-upload-text" style={{ fontSize: 13 }}>Click or drag file to upload</p>
                <p className="ant-upload-hint" style={{ fontSize: 11 }}>
                  Supports: .eml, .msg, .txt, .html, .csv, .xlsx, .doc
                </p>
              </Dragger>
            ) : (
              <div>
                <TextArea
                  value={docContent}
                  onChange={e => setDocContent(e.target.value)}
                  placeholder="Paste document content here, or upload a file above..."
                  rows={6}
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                />
                <Button
                  type="link"
                  size="small"
                  onClick={() => { setDocContent(''); setDocFileName(''); }}
                  style={{ padding: 0, fontSize: 11, marginTop: 4 }}
                >
                  Clear content
                </Button>
              </div>
            )}
          </div>

          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleAnalyzeDocument}
            loading={analyzing}
            block
            size="large"
            disabled={!docContent.trim()}
          >
            {analyzing ? 'AI is analyzing document...' : 'Analyze Document with AI'}
          </Button>

          {/* Analysis Results — Proposals */}
          {analysisSummary && (
            <Alert
              message="Analysis Summary"
              description={analysisSummary}
              type="success"
              showIcon
              style={{ fontSize: 12 }}
            />
          )}

          {proposals.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0' }}>
                <Space>
                  <Text strong>Proposed Work Items</Text>
                  <Badge count={proposals.filter(p => p.selected).length} style={{ backgroundColor: '#52c41a' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>/ {proposals.length} total</Text>
                </Space>
              </Divider>

              {proposals.map((proposal, idx) => (
                <Card
                  key={idx}
                  size="small"
                  style={{
                    borderColor: proposal.selected ? '#1677ff' : '#d9d9d9',
                    backgroundColor: proposal.selected ? '#f0f5ff' : '#fafafa',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleToggleProposal(idx)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Space size={4} style={{ marginBottom: 4 }}>
                        <Checkbox checked={proposal.selected} onChange={() => handleToggleProposal(idx)} />
                        <Text strong style={{ fontSize: 13 }}>{proposal.workItemName}</Text>
                      </Space>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4, marginLeft: 24 }}>
                        <Tag color="blue">{proposal.workItemType}</Tag>
                        <Tag color={PRIORITY_COLORS[proposal.priority] || 'default'}>{proposal.priority}</Tag>
                        <Tag>{proposal.complexity}</Tag>
                        <Tag color={CONFIDENCE_COLORS[proposal.confidence] || 'default'}>
                          {proposal.confidence} confidence
                        </Tag>
                      </div>
                      {proposal.notes && (
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginLeft: 24 }}>
                          {proposal.notes.substring(0, 200)}{proposal.notes.length > 200 ? '...' : ''}
                        </Text>
                      )}
                      <div style={{ marginLeft: 24, marginTop: 4, display: 'flex', gap: 8 }}>
                        {proposal.businessOwner && <Text style={{ fontSize: 11 }}>👤 {proposal.businessOwner}</Text>}
                        {proposal.currentPhase && <Text style={{ fontSize: 11 }}>📍 {proposal.currentPhase}</Text>}
                        {proposal.estimatedGoLive && <Text style={{ fontSize: 11 }}>🎯 {proposal.estimatedGoLive}</Text>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleCreateSelected}
                loading={creating}
                block
                size="large"
                disabled={proposals.filter(p => p.selected).length === 0}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                Create {proposals.filter(p => p.selected).length} Selected Work Item(s)
              </Button>
            </>
          )}
        </Space>
      </Modal>

      {/* Template Generation Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1677ff' }} />
            Generate Report Template from Email
          </Space>
        }
        open={templateModalOpen}
        onCancel={() => { setTemplateModalOpen(false); setGeneratedHtml(''); setOriginalHtml(''); }}
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
              {/* ── Template Editor ── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong>Edit Generated Template</Text>
                  <Space size="small">
                    <Tooltip title="Reset to AI-generated original">
                      <Button
                        size="small"
                        icon={<UndoOutlined />}
                        onClick={() => setGeneratedHtml(originalHtml)}
                        disabled={generatedHtml === originalHtml}
                      >
                        Reset
                      </Button>
                    </Tooltip>
                    <Tooltip title="Auto-format HTML">
                      <Button
                        size="small"
                        icon={<FormatPainterOutlined />}
                        onClick={() => {
                          try {
                            // Simple HTML formatter — indent tags
                            const formatted = generatedHtml
                              .replace(/></g, '>\n<')
                              .replace(/\n\s*\n/g, '\n');
                            setGeneratedHtml(formatted);
                          } catch { /* ignore */ }
                        }}
                      >
                        Format
                      </Button>
                    </Tooltip>
                  </Space>
                </div>
                <Tabs
                  activeKey={editorTab}
                  onChange={(k) => setEditorTab(k as 'code' | 'preview')}
                  size="small"
                  items={[
                    {
                      key: 'code',
                      label: <span><CodeOutlined /> Code</span>,
                      children: (
                        <TextArea
                          value={generatedHtml}
                          onChange={(e) => setGeneratedHtml(e.target.value)}
                          rows={14}
                          style={{
                            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                            fontSize: 12,
                            lineHeight: 1.6,
                            background: '#1e1e1e',
                            color: '#d4d4d4',
                            borderRadius: 6,
                            padding: 12,
                          }}
                          spellCheck={false}
                        />
                      ),
                    },
                    {
                      key: 'preview',
                      label: <span><EyeOutlined /> Preview</span>,
                      children: (
                        <div
                          dangerouslySetInnerHTML={{ __html: generatedHtml }}
                          style={{
                            border: '1px solid #d9d9d9',
                            borderRadius: 6,
                            padding: 16,
                            minHeight: 200,
                            maxHeight: 340,
                            overflow: 'auto',
                            background: '#fff',
                          }}
                        />
                      ),
                    },
                  ]}
                />
                {generatedHtml !== originalHtml && (
                  <Text type="warning" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                    ⚠ Template has been manually edited
                  </Text>
                )}
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
