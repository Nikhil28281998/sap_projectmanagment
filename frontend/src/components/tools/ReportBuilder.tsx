import React, { useState } from 'react';
import {
  Card, Button, Switch, Typography, Space, Alert, Spin, Divider, message, Select
} from 'antd';
import {
  FileTextOutlined, RobotOutlined, DownloadOutlined, CopyOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import { useGenerateReport, useWorkItems } from '../../hooks/useData';

const { Title, Text, Paragraph } = Typography;

const ReportBuilder: React.FC = () => {
  const generateReport = useGenerateReport();
  const { data: workItems = [] } = useWorkItems();
  const [aiPolish, setAiPolish] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [report, setReport] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      const result = await generateReport.mutateAsync({
        aiPolish,
        workItemId: selectedProject || undefined,
      });
      setReport(result.markdown || result.report || JSON.stringify(result, null, 2));
      message.success('Report generated successfully');
    } catch {
      message.error('Failed to generate report');
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    // Detect if report is HTML (AI-polished) vs plain text
    const isHtml = report.trim().startsWith('<') || report.includes('<table');
    if (isHtml) {
      // Copy as rich HTML so it pastes with formatting in Outlook
      try {
        const blob = new Blob([report], { type: 'text/html' });
        const clipboardItem = new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([report], { type: 'text/plain' }) });
        await navigator.clipboard.write([clipboardItem]);
        message.success('Copied as rich HTML — paste directly into Outlook');
      } catch {
        // Fallback to plain text
        navigator.clipboard.writeText(report);
        message.success('Copied to clipboard (plain text)');
      }
    } else {
      navigator.clipboard.writeText(report);
      message.success('Report copied to clipboard');
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const isHtml = report.trim().startsWith('<') || report.includes('<table');
    const ext = isHtml ? 'html' : 'md';
    const mimeType = isHtml ? 'text/html' : 'text/markdown';
    const content = isHtml
      ? `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Weekly Report</title></head><body style="font-family:Calibri,Arial,sans-serif; padding:20px">${report}</body></html>`
      : report;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Title level={3}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        Weekly Report Builder
      </Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            Generate a weekly transport status report summarizing projects,
            transport progress, and key metrics.
          </Text>
          <Divider />

          {/* Project Scope Selector */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              <ProjectOutlined style={{ marginRight: 4 }} />
              Report Scope
            </Text>
            <Select
              style={{ width: 360 }}
              placeholder="All Projects (full weekly report)"
              allowClear
              value={selectedProject}
              onChange={(val) => setSelectedProject(val)}
              options={[
                ...workItems
                  .filter((wi: any) => wi.status === 'Active')
                  .map((wi: any) => ({
                    value: wi.ID,
                    label: `${wi.workItemName} — ${wi.workItemType} (${wi.overallRAG || 'N/A'})`,
                  })),
              ]}
            />
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedProject
                ? 'Report will be generated for the selected project only.'
                : 'Report will include all active projects.'}
            </Text>
          </div>

          <Divider />
          <Space>
            <Switch
              checked={aiPolish}
              onChange={setAiPolish}
              checkedChildren={<RobotOutlined />}
              unCheckedChildren="AI"
            />
            <Text>AI-polish report (transforms raw data into executive-ready email)</Text>
          </Space>
          {aiPolish && (
            <Alert
              message="AI Polish enabled"
              description="The report data will be sent to your connected AI provider (Claude, ChatGPT, or Gemini) to produce a polished executive email. Configure your AI account in Settings → AI Integration."
              type="info"
              showIcon
            />
          )}
          <Button
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            onClick={handleGenerate}
            loading={generateReport.isPending}
          >
            Generate Report
          </Button>
        </Space>
      </Card>

      {generateReport.isPending && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <br /><br />
            <Text type="secondary">Gathering data and generating report...</Text>
          </div>
        </Card>
      )}

      {report && (
        <Card
          title="Generated Report"
          extra={
            <Space>
              <Button icon={<CopyOutlined />} onClick={handleCopy}>
                {(report.trim().startsWith('<') || report.includes('<table')) ? 'Copy HTML' : 'Copy'}
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                Download {(report.trim().startsWith('<') || report.includes('<table')) ? '.html' : '.md'}
              </Button>
            </Space>
          }
        >
          {(report.trim().startsWith('<') || report.includes('<table')) ? (
            <div
              dangerouslySetInnerHTML={{ __html: report }}
              style={{
                maxHeight: '60vh',
                overflow: 'auto',
                padding: 16,
                backgroundColor: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: 6,
              }}
            />
          ) : (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontFamily: 'Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                maxHeight: '60vh',
                overflow: 'auto',
                padding: 16,
                backgroundColor: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: 6,
              }}
            >
              {report}
            </pre>
          )}
        </Card>
      )}
    </div>
  );
};

export default ReportBuilder;
