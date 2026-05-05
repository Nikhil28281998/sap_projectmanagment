import React, { useState, useMemo } from 'react';
import {
  Card, Button, Typography, Space, Spin, Divider, message, Select, Input, Tag, Tooltip, Tabs, Modal,
} from 'antd';
import {
  FileTextOutlined, DownloadOutlined, CopyOutlined,
  ProjectOutlined, MailOutlined, FileExcelOutlined,
  EyeOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  LockOutlined, GlobalOutlined, StarFilled,
} from '@ant-design/icons';
import DOMPurify from 'dompurify';
import { useGenerateReport, useWorkItems, useReportTemplates } from '../../hooks/useData';
import { reportApi } from '../../services/api';
import {
  weeklyStatusTemplate, executiveSummaryTemplate, goLiveReadinessTemplate,
  steeringCommitteeTemplate,
  getEmailSubject, TEMPLATES,
  type ReportData, type ProjectData,
} from '../../utils/report-templates';
import { exportSingleProjectExcel, exportAllProjectsExcel } from '../../utils/excel-export';
import type { WorkItem, Transport, Milestone, ReportTemplate } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ReportBuilder: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const generateReport = useGenerateReport();
  const { data: workItems = [] } = useWorkItems();
  const { data: customTemplates = [] } = useReportTemplates();

  // State
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [selectedTemplate, setSelectedTemplate] = useState('weekly-status');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState('');

  // Current/Next week editable items
  const [currentWeekItems, setCurrentWeekItems] = useState<string[]>([]);
  const [nextWeekItems, setNextWeekItems] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('configure');

  // Merge predefined + custom templates
  const allTemplates = useMemo(() => {
    const predefined = TEMPLATES.map(t => ({
      ...t,
      source: 'predefined' as const,
      visibility: 'public' as const,
    }));
    const custom = (customTemplates || []).map((t: ReportTemplate) => ({
      id: `custom-${t.ID}`,
      name: t.templateName,
      description: t.description || 'Custom template',
      scope: t.scope || 'single',
      source: 'custom' as const,
      visibility: (t.visibility || 'private') as 'private' | 'public',
      isDefault: t.isDefault,
      ownerEmail: t.ownerEmail,
      templateHtml: t.templateHtml,
    }));
    return [...predefined, ...custom];
  }, [customTemplates]);

  // Get currently available templates based on project selection
  const availableTemplates = useMemo(() => {
    if (selectedProject) {
      return allTemplates.filter(t => t.scope === 'single' || t.scope === 'both');
    }
    return allTemplates.filter(t => t.scope === 'multi' || t.scope === 'both');
  }, [selectedProject, allTemplates]);

  // Auto-select appropriate template when project selection changes
  const handleProjectChange = (val: string | undefined) => {
    setSelectedProject(val);
    setReportData(null);
    setRenderedHtml(null);
    if (val && selectedTemplate === 'executive-summary') {
      setSelectedTemplate('weekly-status');
    }
    if (!val && selectedTemplate !== 'executive-summary') {
      setSelectedTemplate('executive-summary');
    }
  };

  // ─── Step 1: Fetch Data ───
  const handleFetchData = async () => {
    try {
      const result = await generateReport.mutateAsync({
        workItemId: selectedProject || undefined,
      });
      const data: ReportData = JSON.parse(result.data ?? '{}');
      setReportData(data);

      // Auto-populate current/next week suggestions
      setCurrentWeekItems(data.currentWeekSuggestions.length > 0 ? data.currentWeekSuggestions : ['']);
      setNextWeekItems(data.nextWeekSuggestions.length > 0 ? data.nextWeekSuggestions : ['']);

      message.success(`Data loaded: ${data.projects.length} project(s), ${data.totalTransports} transports`);
      setActiveTab('edit');
    } catch {
      message.error('Failed to fetch report data');
    }
  };

  // ─── Step 2: Generate HTML from template ───
  const handleGenerate = () => {
    if (!reportData) return;

    const cw = currentWeekItems.filter(s => s.trim());
    const nw = nextWeekItems.filter(s => s.trim());
    let html = '';

    // Check if it's a custom template
    if (selectedTemplate.startsWith('custom-')) {
      const custom = allTemplates.find(t => t.id === selectedTemplate);
      if (!custom || !('templateHtml' in custom) || !custom.templateHtml) {
        message.error('Custom template has no HTML content');
        return;
      }
      const project = reportData.projects[0];
      // Replace placeholders in custom template
      html = custom.templateHtml
        .replace(/\{\{weekLabel\}\}/g, reportData.weekLabel)
        .replace(/\{\{date\}\}/g, reportData.date)
        .replace(/\{\{projectName\}\}/g, project?.name || 'All Projects')
        .replace(/\{\{projectCode\}\}/g, project?.projectCode || '')
        .replace(/\{\{sapModule\}\}/g, project?.sapModule || '')
        .replace(/\{\{sapOwner\}\}/g, project?.sapOwner || '')
        .replace(/\{\{businessOwner\}\}/g, project?.businessOwner || '')
        .replace(/\{\{systemOwner\}\}/g, project?.systemOwner || '')
        .replace(/\{\{goLiveDate\}\}/g, project?.goLiveDate || 'TBD')
        .replace(/\{\{overallRAG\}\}/g, project?.overallRAG || 'GREEN')
        .replace(/\{\{currentPhase\}\}/g, project?.currentPhase || '')
        .replace(/\{\{deploymentPct\}\}/g, String(project?.deploymentPct || 0))
        .replace(/\{\{testCompletionPct\}\}/g, String(project?.testCompletionPct || 0))
        .replace(/\{\{totalTRs\}\}/g, String(project?.totalTRs || 0))
        .replace(/\{\{trsDEV\}\}/g, String(project?.trsDEV || 0))
        .replace(/\{\{trsQAS\}\}/g, String(project?.trsQAS || 0))
        .replace(/\{\{trsPRD\}\}/g, String(project?.trsPRD || 0))
        .replace(/\{\{currentWeekItems\}\}/g, cw.map(i => `<li>${i}</li>`).join(''))
        .replace(/\{\{nextWeekItems\}\}/g, nw.map(i => `<li>${i}</li>`).join(''))
        .replace(/\{\{milestonesTable\}\}/g, project?.milestones?.map(m =>
          `<tr><td>${m.name}</td><td>${m.date || 'TBD'}</td><td>${m.status}</td></tr>`
        ).join('') || '<tr><td colspan="3">No milestones</td></tr>')
        .replace(/\{\{risksSection\}\}/g, (project?.overallRAG === 'RED' || project?.overallRAG === 'AMBER')
          ? `<p style="color:#c0392b">⚠ Project is at ${project?.overallRAG} status — review milestones and escalation.</p>`
          : '<p style="color:#27ae60">No critical risks at this time.</p>');
    } else if (selectedTemplate === 'weekly-status') {
      const project = reportData.projects[0];
      if (!project) { message.error('No project data available'); return; }
      html = weeklyStatusTemplate(reportData, project, cw, nw);
    } else if (selectedTemplate === 'executive-summary') {
      html = executiveSummaryTemplate(reportData, cw, nw);
    } else if (selectedTemplate === 'golive-readiness') {
      const project = reportData.projects[0];
      if (!project) { message.error('No project data available'); return; }
      html = goLiveReadinessTemplate(reportData, project);
    } else if (selectedTemplate === 'steering-committee') {
      html = steeringCommitteeTemplate(reportData);
    }

    setRenderedHtml(html);
    setEmailSubject(getEmailSubject(
      selectedTemplate,
      selectedProject ? reportData.projects[0] : null,
      reportData,
    ));
    setActiveTab('preview');
    message.success('Report generated');
  };

  // ─── Actions ───
  const handleCopy = async () => {
    if (!renderedHtml) return;
    try {
      const blob = new Blob([renderedHtml], { type: 'text/html' });
      const clipboardItem = new ClipboardItem({
        'text/html': blob,
        'text/plain': new Blob([renderedHtml], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);
      message.success('Copied as rich HTML — paste directly into Outlook');
    } catch {
      navigator.clipboard.writeText(renderedHtml);
      message.success('Copied (plain text fallback)');
    }
  };

  const handleOpenOutlook = async () => {
    if (!renderedHtml) return;
    // Copy HTML to clipboard first
    try {
      const blob = new Blob([renderedHtml], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': new Blob([renderedHtml], { type: 'text/plain' }),
        }),
      ]);
    } catch { /* fallback: user will paste manually */ }

    // Open mailto: with subject
    const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}`;
    window.open(mailto, '_blank');
    message.info('Report copied to clipboard! Press Ctrl+V in the email body to paste.');
  };

  // ── Send via Graph API / Outlook (C8 fix) ──────────────────────────────────
  const [sendModalOpen,   setSendModalOpen]   = useState(false);
  const [sendRecipients,  setSendRecipients]  = useState('');
  const [sendCc,          setSendCc]          = useState('');
  const [sending,         setSending]         = useState(false);

  const handleSendEmail = async () => {
    const toList = sendRecipients.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
    const ccList = sendCc.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);

    if (toList.length === 0) { message.warning('Enter at least one recipient email.'); return; }
    if (!renderedHtml) return;

    setSending(true);
    try {
      const result = await reportApi.sendEmail({
        htmlBody: renderedHtml,
        subject: emailSubject || 'Weekly Status Report',
        toRecipients: toList,
        ccRecipients: ccList,
      });
      if (result.success) {
        message.success(result.message);
        setSendModalOpen(false);
        setSendRecipients('');
        setSendCc('');
      } else {
        message.error(result.message);
      }
    } catch (err: any) {
      message.error(`Send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!renderedHtml) return;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${emailSubject}</title></head><body style="font-family:Calibri,Arial,sans-serif; padding:20px">${renderedHtml}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emailSubject.replace(/[^a-zA-Z0-9 -]/g, '')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadEml = () => {
    if (!renderedHtml) return;
    const subject = emailSubject || 'Weekly Status Report';
    const emlContent = [
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      renderedHtml,
    ].join('\r\n');
    const blob = new Blob([emlContent], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subject.replace(/[^a-zA-Z0-9 -]/g, '')}.eml`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Downloaded — double-click the .eml file to open in Outlook ready to send');
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    if (selectedProject && reportData.projects[0]) {
      exportSingleProjectExcel(reportData, reportData.projects[0]);
    } else {
      exportAllProjectsExcel(reportData);
    }
    message.success('Excel file downloaded');
  };

  // ─── List item helpers ───
  const updateItem = (list: string[], setList: (v: string[]) => void, idx: number, val: string) => {
    const next = [...list];
    next[idx] = val;
    setList(next);
  };

  const addItem = (list: string[], setList: (v: string[]) => void) => {
    setList([...list, '']);
  };

  const removeItem = (list: string[], setList: (v: string[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const renderEditableList = (
    label: string,
    items: string[],
    setItems: (v: string[]) => void,
  ) => (
    <div className="rb-editable-list">
      <Text strong className="d-block mb-8">{label}</Text>
      {items.map((item, idx) => (
        <div key={idx} className="rb-editable-row">
          <span className="rb-row-number">{idx + 1}.</span>
          <Input
            value={item}
            onChange={e => updateItem(items, setItems, idx, e.target.value)}
            placeholder={`${label.replace(' Items', '')} item...`}
            className="flex-1"
          />
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => removeItem(items, setItems, idx)}
            disabled={items.length <= 1}
          />
        </div>
      ))}
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => addItem(items, setItems)}
        className="mt-4"
      >
        Add item
      </Button>
    </div>
  );

  // ─── Tab content ───
  const configureTab = (
    <Card size="small">
      <Space direction="vertical" className="w-full" size="middle">
        {/* Project Selector */}
        <div>
          <Text strong className="d-block mb-8">
            <ProjectOutlined className="mr-4" />
            Report Scope
          </Text>
          <Select
            className="w-full rb-max-w-500"
            placeholder="All Projects (Executive Summary)"
            allowClear
            value={selectedProject}
            onChange={handleProjectChange}
            options={workItems
              .filter((wi: WorkItem) => wi.status === 'Active')
              .map((wi: WorkItem) => ({
                value: wi.ID,
                label: `${wi.workItemName} — ${wi.workItemType} (${wi.overallRAG || 'N/A'})`,
              }))}
          />
          <br />
          <Text type="secondary" className="fs-12">
            {selectedProject
              ? 'Single-project report with milestones & weekly activities.'
              : 'All-projects executive summary — also exportable to Excel.'}
          </Text>
        </div>

        {/* Template Selector */}
        <div>
          <Text strong className="d-block mb-8">
            <FileTextOutlined className="mr-4" />
            Report Template
          </Text>
          <Select
            className="w-full rb-max-w-500"
            value={selectedTemplate}
            onChange={setSelectedTemplate}
            options={availableTemplates.map(t => ({
              value: t.id,
              label: t.name,
              desc: t.description,
            }))}
            optionRender={(option) => {
              const tmpl = allTemplates.find(t => t.id === option.value);
              return (
                <div>
                  <div className="fw-600">
                    {option.label}
                    {tmpl?.source === 'custom' && (
                      <>
                        {' '}
                        {tmpl.visibility === 'private'
                          ? <LockOutlined className="fs-11 text-sec" />
                          : <GlobalOutlined className="fs-11 text-accent" />
                        }
                        {(tmpl as any).isDefault && <StarFilled className="fs-11 text-amber ml-4" />}
                      </>
                    )}
                  </div>
                  <div className="rb-template-desc">
                    {tmpl?.description || ''}
                    {tmpl?.source === 'custom' && <Tag color="purple" className="ml-4 fs-10">Custom</Tag>}
                  </div>
                </div>
              );
            }}
          />
        </div>

        {/* Template descriptions as tags */}
        <div>
          {allTemplates.map(t => (
            <Tag
              key={t.id}
              color={t.id === selectedTemplate ? 'blue' : t.source === 'custom' ? 'purple' : 'default'}
              className="cursor-pointer mb-4"
              onClick={() => {
                if (availableTemplates.some(at => at.id === t.id)) {
                  setSelectedTemplate(t.id);
                }
              }}
            >
              {t.source === 'custom' && (
                t.visibility === 'private'
                  ? <LockOutlined className="mr-4" />
                  : <GlobalOutlined className="mr-4" />
              )}
              {t.name} ({t.scope === 'single' ? 'Single Project' : t.scope === 'multi' ? 'All Projects' : 'Both'})
            </Tag>
          ))}
        </div>

        <Divider className="my-0" />

        <Button
          type="primary"
          size="large"
          icon={<FileTextOutlined />}
          onClick={handleFetchData}
          loading={generateReport.isPending}
          block
          className="rb-max-w-300"
        >
          Fetch Project Data
        </Button>
      </Space>
    </Card>
  );

  const editTab = reportData ? (
    <Card size="small">
      <Space direction="vertical" className="w-full" size="middle">
        {/* Data summary */}
        <div>
          <Text strong>Data Loaded:</Text>{' '}
          <Tag color="blue">{reportData.projects.length} project(s)</Tag>
          <Tag color="green">{reportData.totalTransports} transports</Tag>
          <Tag>{reportData.weekLabel}</Tag>
        </div>

        <Divider className="my-0" />

        {/* Current & Next Week editors — only for weekly-status & executive-summary */}
        {(selectedTemplate === 'weekly-status' || selectedTemplate === 'executive-summary') && (
          <>
            {renderEditableList('Current Week Items', currentWeekItems, setCurrentWeekItems)}
            {renderEditableList('Next Week Items', nextWeekItems, setNextWeekItems)}
          </>
        )}

        <Button
          type="primary"
          size="large"
          icon={<EyeOutlined />}
          onClick={handleGenerate}
          block
          className="rb-max-w-300"
        >
          Generate Report
        </Button>
      </Space>
    </Card>
  ) : (
    <Card size="small">
      <Text type="secondary">Fetch project data first using the Configure tab.</Text>
    </Card>
  );

  const previewTab = renderedHtml ? (
    <div>
      {/* Action bar */}
      <Card size="small" className="rb-action-bar-card">
        <Space wrap>
          <Tooltip title="Copy rich HTML to clipboard for Outlook paste">
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              Copy HTML
            </Button>
          </Tooltip>
          <Tooltip title="Download as .eml — double-click to open in Outlook with subject pre-filled, ready to send">
            <Button icon={<MailOutlined />} onClick={handleDownloadEml} type="primary">
              Open in Outlook (.eml)
            </Button>
          </Tooltip>
          <Tooltip title="Send email directly via Microsoft Graph API (requires Outlook config in Settings)">
            <Button icon={<MailOutlined />} onClick={() => setSendModalOpen(true)}>
              Send via Graph API
            </Button>
          </Tooltip>
          <Tooltip title="Download as .html file">
            <Button icon={<DownloadOutlined />} onClick={handleDownloadHtml}>
              Download .html
            </Button>
          </Tooltip>
          <Tooltip title="Export data to Excel spreadsheet">
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} className="rb-excel-btn">
              Export Excel
            </Button>
          </Tooltip>
        </Space>
        <div className="mt-8">
          <Text type="secondary" className="fs-12">
            Subject: <strong>{emailSubject}</strong>
          </Text>
        </div>
      </Card>

      {/* Rendered preview */}
      <Card
        size="small"
        title="Email Preview"
        extra={
          <Button size="small" icon={<EditOutlined />} onClick={() => setActiveTab('edit')}>
            Edit
          </Button>
        }
      >
        <div
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderedHtml) }}
          className="rb-preview-scroll"
        />
      </Card>
    </div>
  ) : (
    <Card size="small">
      <Text type="secondary">Generate a report first to see the preview.</Text>
    </Card>
  );

  return (
    <div>
      {!embedded && (
        <>
          <Title level={3}>
            <FileTextOutlined className="mr-8" />
            Weekly Report Builder
          </Title>
          <Text type="secondary" className="d-block mb-16">
            Generate professional Outlook-ready reports from your project data. Choose a template, customize, and send.
          </Text>
        </>
      )}

      {generateReport.isPending && (
        <Card className="mb-16">
          <div className="rb-loading-box">
            <Spin size="large" />
            <br /><br />
            <Text type="secondary">Fetching project data...</Text>
          </div>
        </Card>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'configure',
            label: (
              <span>
                <ProjectOutlined /> 1. Configure
              </span>
            ),
            children: configureTab,
          },
          {
            key: 'edit',
            label: (
              <span>
                <EditOutlined /> 2. Edit Items
              </span>
            ),
            children: editTab,
            disabled: !reportData,
          },
          {
            key: 'preview',
            label: (
              <span>
                <EyeOutlined /> 3. Preview & Send
              </span>
            ),
            children: previewTab,
            disabled: !renderedHtml,
          },
        ]}
      />

      {/* ── Send via Email modal ── */}
      <Modal
        title={<Space><MailOutlined style={{ color: '#1677ff' }} /><span>Send Report via Email</span></Space>}
        open={sendModalOpen}
        onCancel={() => setSendModalOpen(false)}
        onOk={handleSendEmail}
        okText={sending ? 'Sending...' : 'Send'}
        okButtonProps={{ loading: sending, disabled: !sendRecipients.trim() }}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Subject</Text>
            <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
              placeholder="Weekly Status Report" />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>To (required)</Text>
            <Input value={sendRecipients} onChange={e => setSendRecipients(e.target.value)}
              placeholder="manager@company.com, stakeholder@company.com"
              allowClear />
            <Text type="secondary" style={{ fontSize: 11 }}>Separate multiple emails with commas</Text>
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>CC (optional)</Text>
            <Input value={sendCc} onChange={e => setSendCc(e.target.value)}
              placeholder="cc@company.com" allowClear />
          </div>
          <Tag color="blue" style={{ fontSize: 11 }}>
            Email will be sent via Microsoft Graph API from the configured sender mailbox.
            Configure in Settings → SharePoint/Outlook.
          </Tag>
        </Space>
      </Modal>
    </div>
  );
};

export default ReportBuilder;
