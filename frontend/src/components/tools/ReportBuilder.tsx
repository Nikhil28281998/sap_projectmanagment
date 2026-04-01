import React, { useState } from 'react';
import {
  Card, Button, Switch, Typography, Space, Alert, Spin, Divider, message
} from 'antd';
import {
  FileTextOutlined, RobotOutlined, DownloadOutlined, CopyOutlined
} from '@ant-design/icons';
import { useGenerateReport } from '../../hooks/useData';

const { Title, Text, Paragraph } = Typography;

const ReportBuilder: React.FC = () => {
  const generateReport = useGenerateReport();
  const [aiPolish, setAiPolish] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      const result = await generateReport.mutateAsync({ aiPolish });
      setReport(result.markdown || result.report || JSON.stringify(result, null, 2));
      message.success('Report generated successfully');
    } catch {
      message.error('Failed to generate report');
    }
  };

  const handleCopy = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      message.success('Report copied to clipboard');
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-report-${new Date().toISOString().split('T')[0]}.md`;
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
              description="The report data will be sent to your connected AI provider (Claude or ChatGPT) to produce a polished executive email. Configure your AI account in Settings → AI Integration."
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
              <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy</Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>Download .md</Button>
            </Space>
          }
        >
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
        </Card>
      )}
    </div>
  );
};

export default ReportBuilder;
