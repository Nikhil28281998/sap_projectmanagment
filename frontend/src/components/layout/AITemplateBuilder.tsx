/**
 * AITemplateBuilder — Generate Outlook-compatible HTML report templates from email samples.
 * Extracted from AIChatDrawer to eliminate the god component.
 * Fixes H7: dangerouslySetInnerHTML DOMPurify is now memoized.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal, Space, Typography, Input, Select, Switch, Button, Tabs, Tag,
  Upload, Tooltip,
} from 'antd';
import {
  FileTextOutlined, RobotOutlined, SaveOutlined, UndoOutlined,
  FormatPainterOutlined, CodeOutlined, EyeOutlined, UploadOutlined,
} from '@ant-design/icons';
import DOMPurify from 'dompurify';
import { aiApi, templateApi } from '../../services/api';
import { message as antMessage } from 'antd';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (templateName: string, visibility: string, isDefault: boolean) => void;
}

const AITemplateBuilder: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const [templateEmail,      setTemplateEmail]      = useState('');
  const [templateName,       setTemplateName]        = useState('');
  const [templateScope,      setTemplateScope]       = useState('single');
  const [templateVisibility, setTemplateVisibility]  = useState('private');
  const [templateDefault,    setTemplateDefault]     = useState(false);
  const [generatingTemplate, setGeneratingTemplate]  = useState(false);
  const [generatedHtml,      setGeneratedHtml]       = useState('');
  const [originalHtml,       setOriginalHtml]        = useState('');
  const [editorTab,          setEditorTab]           = useState<'code' | 'preview'>('code');

  // ── H7 FIX: Memoize DOMPurify sanitization so it only re-runs when HTML changes ──
  const sanitizedPreview = useMemo(
    () => DOMPurify.sanitize(generatedHtml),
    [generatedHtml]
  );

  const handleGenerateTemplate = async () => {
    if (!templateEmail.trim()) { antMessage.warning('Please paste or upload an email sample.'); return; }
    if (!templateName.trim())  { antMessage.warning('Please provide a template name.'); return; }
    setGeneratingTemplate(true);
    try {
      const result = await aiApi.generateTemplate(templateEmail, templateName, templateScope);
      if (result.success) {
        setGeneratedHtml(result.templateHtml);
        setOriginalHtml(result.templateHtml);
        setEditorTab('code');
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
        onSaved(templateName, templateVisibility, templateDefault);
        handleClose();
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Save failed: ${err.message}`);
    }
  };

  const handleClose = () => {
    setGeneratedHtml('');
    setOriginalHtml('');
    setTemplateEmail('');
    setTemplateName('');
    onClose();
  };

  const handleFormatHtml = () => {
    try {
      const formatted = generatedHtml.replace(/></g, '>\n<').replace(/\n\s*\n/g, '\n');
      setGeneratedHtml(formatted);
    } catch { /* ignore */ }
  };

  return (
    <Modal
      title={<Space><FileTextOutlined style={{ color: '#1677ff' }} />Generate Report Template from Email</Space>}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={700}
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">

        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Template Name</Text>
          <Input value={templateName} onChange={e => setTemplateName(e.target.value)}
            placeholder="e.g. Weekly Status — FICO Projects" maxLength={200} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Scope</Text>
            <Select value={templateScope} onChange={setTemplateScope} style={{ width: '100%' }}
              options={[
                { value: 'single', label: 'Single Project' },
                { value: 'multi',  label: 'All Projects' },
                { value: 'both',   label: 'Both' },
              ]} />
          </div>
          <div style={{ flex: 1 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Visibility</Text>
            <Select value={templateVisibility} onChange={setTemplateVisibility} style={{ width: '100%' }}
              options={[
                { value: 'private', label: 'Private (only me)' },
                { value: 'public',  label: 'Public (all users)' },
              ]} />
          </div>
        </div>

        <Space>
          <Switch checked={templateDefault} onChange={setTemplateDefault} size="small" />
          <Text>Set as my default template</Text>
        </Space>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text strong>Paste or Upload Your Email Sample</Text>
            <Upload accept=".txt,.html,.htm,.eml,.msg" showUploadList={false}
              beforeUpload={(file) => {
                const reader = new FileReader();
                reader.onerror = () => antMessage.error('Failed to read file');
                reader.onload  = (e) => setTemplateEmail(e.target?.result as string);
                reader.readAsText(file);
                return false;
              }}>
              <Button size="small" icon={<UploadOutlined />}>Upload File</Button>
            </Upload>
          </div>
          <TextArea value={templateEmail} onChange={e => setTemplateEmail(e.target.value)}
            placeholder="Paste your current email report here... The AI will analyze the structure and generate a reusable Outlook HTML template."
            rows={8} style={{ fontFamily: 'monospace', fontSize: 12 }} />
        </div>

        <Button type="primary" icon={<RobotOutlined />} onClick={handleGenerateTemplate}
          loading={generatingTemplate} block size="large"
          disabled={!templateEmail.trim() || !templateName.trim()}>
          {generatingTemplate ? 'AI is generating template...' : 'Generate Template with AI'}
        </Button>

        {generatedHtml && (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text strong>Edit Generated Template</Text>
                <Space size="small">
                  <Tooltip title="Reset to AI-generated original">
                    <Button size="small" icon={<UndoOutlined />}
                      onClick={() => setGeneratedHtml(originalHtml)}
                      disabled={generatedHtml === originalHtml}>Reset</Button>
                  </Tooltip>
                  <Tooltip title="Auto-format HTML">
                    <Button size="small" icon={<FormatPainterOutlined />} onClick={handleFormatHtml}>Format</Button>
                  </Tooltip>
                </Space>
              </div>
              <Tabs activeKey={editorTab} onChange={(k) => setEditorTab(k as 'code' | 'preview')} size="small"
                items={[
                  {
                    key: 'code',
                    label: <span><CodeOutlined /> Code</span>,
                    children: (
                      <TextArea value={generatedHtml} onChange={(e) => setGeneratedHtml(e.target.value)} rows={14}
                        style={{ fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                          fontSize: 12, lineHeight: 1.6, background: '#1e1e1e', color: '#d4d4d4',
                          borderRadius: 6, padding: 12 }}
                        spellCheck={false} />
                    ),
                  },
                  {
                    key: 'preview',
                    label: <span><EyeOutlined /> Preview</span>,
                    children: (
                      // sanitizedPreview is memoized — DOMPurify only re-runs when generatedHtml changes
                      <div dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
                        style={{ border: '1px solid #f0f0f0', padding: 16, borderRadius: 6, overflow: 'auto', maxHeight: 400 }} />
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

            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveTemplate}
              block size="large" style={{ background: 'var(--color-status-risk-low)', borderColor: 'var(--color-status-risk-low)' }}>
              Save Template ({templateVisibility === 'public' ? 'Public' : 'Private'})
            </Button>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default AITemplateBuilder;
