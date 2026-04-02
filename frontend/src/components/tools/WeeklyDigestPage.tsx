import React, { useState, useEffect } from 'react';
import {
  Card, Button, Typography, Space, Select, Tag, Empty, Spin,
  Alert, Tabs, Divider, Badge, message as antMessage,
} from 'antd';
import {
  RobotOutlined, FileTextOutlined, CalendarOutlined,
  EyeOutlined, CodeOutlined, ReloadOutlined, SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import DOMPurify from 'dompurify';
import { digestApi } from '../../services/api';
import { useModule } from '../../contexts/ModuleContext';

const { Title, Text, Paragraph } = Typography;

interface Digest {
  ID: string;
  weekLabel: string;
  application: string;
  digestHtml: string;
  digestText: string;
  projectCount: number;
  riskCount: number;
  highlights: string;
  generatedBy: string;
  aiProvider: string;
  createdAt: string;
}

const APP_OPTIONS = [
  { value: 'ALL', label: '🌐 All Applications' },
  { value: 'SAP', label: '⚙️ SAP Project Management' },
  { value: 'Coupa', label: '🛒 Coupa Project Management' },
  { value: 'Commercial', label: '💊 Commercial Project Management' },
];

const WeeklyDigestPage: React.FC = () => {
  const { activeModule } = useModule();
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [selectedDigest, setSelectedDigest] = useState<Digest | null>(null);
  const [viewTab, setViewTab] = useState<'preview' | 'text'>('preview');
  const [appFilter, setAppFilter] = useState<string>(
    activeModule === 'sap' ? 'SAP' : activeModule === 'coupa' ? 'Coupa' : 'Commercial'
  );

  const loadDigests = async () => {
    setLoading(true);
    try {
      const res = await digestApi.getAll();
      setDigests(res.value || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDigests();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await digestApi.generate(appFilter);
      if (result.success) {
        antMessage.success(result.message);
        // Reload digests
        await loadDigests();
        // Select the new digest in preview
        setSelectedDigest({
          ID: result.digestId,
          weekLabel: '',
          application: appFilter,
          digestHtml: result.digestHtml,
          digestText: '',
          projectCount: 0,
          riskCount: 0,
          highlights: '[]',
          generatedBy: '',
          aiProvider: result.provider,
          createdAt: new Date().toISOString(),
        });
        setViewTab('preview');
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const appColor: Record<string, string> = { SAP: 'blue', Coupa: 'green', Commercial: 'purple', ALL: 'default' };

  return (
    <div>
      <Title level={3}>
        <CalendarOutlined style={{ marginRight: 8 }} />
        AI Weekly Digest
      </Title>

      <Alert
        message="AI-powered weekly summaries of your project portfolio"
        description="Generate a concise executive digest covering active projects, risks, go-live timelines, and highlights. Digests are saved for reference — no emails are sent automatically."
        type="info"
        showIcon
        icon={<RobotOutlined />}
        style={{ marginBottom: 16 }}
      />

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Application Scope</Text>
            <Select
              value={appFilter}
              onChange={setAppFilter}
              style={{ width: 260 }}
              options={APP_OPTIONS}
            />
          </div>
          <div style={{ paddingTop: 20 }}>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={generating}
            >
              {generating ? 'AI is generating digest...' : 'Generate Weekly Digest'}
            </Button>
          </div>
          <div style={{ paddingTop: 20 }}>
            <Button icon={<ReloadOutlined />} onClick={loadDigests}>Refresh</Button>
          </div>
        </Space>
      </Card>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Digest History */}
        <Card
          title={<Space><FileTextOutlined /> Saved Digests</Space>}
          size="small"
          style={{ width: 300, flexShrink: 0 }}
          loading={loading}
        >
          {digests.length === 0 ? (
            <Empty description="No digests yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflow: 'auto' }}>
              {digests.map(d => {
                const isSelected = selectedDigest?.ID === d.ID;
                let highlights: string[] = [];
                try { highlights = JSON.parse(d.highlights || '[]'); } catch { /* ignore */ }
                return (
                  <Card
                    key={d.ID}
                    size="small"
                    hoverable
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected ? '#1677ff' : '#d9d9d9',
                      backgroundColor: isSelected ? '#f0f5ff' : '#fff',
                    }}
                    onClick={() => { setSelectedDigest(d); setViewTab('preview'); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13 }}>{d.weekLabel || 'Draft'}</Text>
                      <Tag color={appColor[d.application] || 'default'} style={{ fontSize: 10 }}>
                        {d.application}
                      </Tag>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {new Date(d.createdAt).toLocaleDateString()} • {d.projectCount} projects
                        {d.riskCount > 0 && <Tag color="red" style={{ fontSize: 9, marginLeft: 4 }}>{d.riskCount} risks</Tag>}
                      </Text>
                    </div>
                    {d.aiProvider && (
                      <Tag style={{ fontSize: 9, marginTop: 4 }}>🤖 {d.aiProvider}</Tag>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Card>

        {/* Digest Preview */}
        <Card
          title={
            selectedDigest ? (
              <Space>
                <EyeOutlined />
                <span>{selectedDigest.weekLabel || 'New Digest'}</span>
                <Tag color={appColor[selectedDigest.application] || 'default'}>
                  {selectedDigest.application}
                </Tag>
              </Space>
            ) : (
              <Space><EyeOutlined /> Digest Preview</Space>
            )
          }
          size="small"
          style={{ flex: 1 }}
          extra={
            selectedDigest && (
              <Space size={4}>
                <Button
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={() => {
                    if (selectedDigest?.digestHtml) {
                      const blob = new Blob([selectedDigest.digestHtml], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `digest-${selectedDigest.weekLabel || 'draft'}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                      antMessage.success('Digest HTML downloaded');
                    }
                  }}
                >
                  Download HTML
                </Button>
              </Space>
            )
          }
        >
          {!selectedDigest ? (
            <Empty
              description="Select a digest from the list or generate a new one"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '60px 0' }}
            />
          ) : (
            <div>
              {/* Stats bar */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <Tag color="blue">{selectedDigest.projectCount} projects</Tag>
                {selectedDigest.riskCount > 0 && <Tag color="red">{selectedDigest.riskCount} risks</Tag>}
                {selectedDigest.aiProvider && <Tag>🤖 {selectedDigest.aiProvider}</Tag>}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Generated: {new Date(selectedDigest.createdAt).toLocaleString()}
                  {selectedDigest.generatedBy && ` by ${selectedDigest.generatedBy}`}
                </Text>
              </div>

              <Tabs
                activeKey={viewTab}
                onChange={(k) => setViewTab(k as 'preview' | 'text')}
                size="small"
                items={[
                  {
                    key: 'preview',
                    label: <span><EyeOutlined /> HTML Preview</span>,
                    children: (
                      <div
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedDigest.digestHtml || '<p>No HTML content</p>') }}
                        style={{
                          border: '1px solid #d9d9d9',
                          borderRadius: 6,
                          padding: 16,
                          minHeight: 300,
                          maxHeight: '55vh',
                          overflow: 'auto',
                          background: '#fff',
                        }}
                      />
                    ),
                  },
                  {
                    key: 'text',
                    label: <span><CodeOutlined /> Plain Text</span>,
                    children: (
                      <pre style={{
                        border: '1px solid #d9d9d9',
                        borderRadius: 6,
                        padding: 16,
                        minHeight: 300,
                        maxHeight: '55vh',
                        overflow: 'auto',
                        background: '#fafafa',
                        fontSize: 12,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {selectedDigest.digestText || 'No plain text version available'}
                      </pre>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default WeeklyDigestPage;
