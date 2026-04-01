import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Switch, Button, Select, Typography,
  Divider, Space, message, Descriptions, Tag, Alert, Radio, Steps
} from 'antd';
import {
  SettingOutlined, SaveOutlined, RobotOutlined, SyncOutlined,
  ClockCircleOutlined, ThunderboltOutlined, CheckCircleOutlined,
  CloseCircleOutlined, LinkOutlined, ApiOutlined
} from '@ant-design/icons';
import { useHealth } from '../../hooks/useData';
import { configApi, aiApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const { data: health } = useHealth();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string; provider?: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiProvider, setAiProvider] = useState<'claude' | 'chatgpt' | 'gemini'>('gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiConnected, setAiConnected] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await configApi.getAll();
      const data = res.value || [];
      setConfigs(data);
      // Map configs to form values
      const formValues: any = {};
      data.forEach((c: any) => {
        if (c.valueType === 'boolean') {
          formValues[c.key] = c.value === 'true';
        } else if (c.valueType === 'number') {
          formValues[c.key] = Number(c.value);
        } else {
          formValues[c.key] = c.value;
        }
      });
      form.setFieldsValue(formValues);
    } catch {
      // Configs may not be loaded in dev mode
    }
  };

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      const updates = Object.entries(values).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      for (const update of updates) {
        await configApi.update(update.key, update.value);
      }
      message.success('Settings saved');
    } catch {
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={3}>
        <SettingOutlined style={{ marginRight: 8 }} />
        Settings
      </Title>

      {/* System Health */}
      <Card title="System Health" size="small" style={{ marginBottom: 16 }}>
        {health ? (
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Status">
              <Tag color={health.status === 'UP' ? 'success' : 'error'}>{health.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Database">
              <Tag color={health.db === 'connected' ? 'success' : 'error'}>{health.db}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="RFC Connection">
              <Tag color={
                health.rfc === 'connected' ? 'success' :
                health.rfc === 'mock' ? 'warning' : 'error'
              }>
                {health.rfc}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="SharePoint">
              <Tag color={
                health.sharepoint === 'connected' ? 'success' :
                health.sharepoint === 'mock' ? 'warning' : 'error'
              }>
                {health.sharepoint}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Last Sync">
              {health.lastSync ? new Date(health.lastSync).toLocaleString() : 'Never'}
            </Descriptions.Item>
            <Descriptions.Item label="Uptime">
              {health.uptime ? `${Math.round(health.uptime / 60)}m` : '—'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">Loading health status...</Text>
        )}
      </Card>

      {/* Application Settings */}
      <Card title="Application Settings" size="small" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            REFRESH_INTERVAL_MINUTES: 30,
            ENABLE_AI: false,
            USE_MOCK_RFC: true,
            USE_MOCK_SHAREPOINT: true,
            TR_PREFIX: 'DEVK9',
            STUCK_THRESHOLD_DAYS: 5,
          }}
        >
          <Divider orientation="left">
            <Space><SyncOutlined /> Data Synchronization</Space>
          </Divider>

          <Form.Item
            label="Auto-Refresh Interval (minutes)"
            name="REFRESH_INTERVAL_MINUTES"
            tooltip="How often to automatically refresh data from SAP and SharePoint"
          >
            <InputNumber min={5} max={120} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            label="Stuck Transport Threshold (days)"
            name="STUCK_THRESHOLD_DAYS"
            tooltip="Number of days in the same system before a transport is considered stuck"
          >
            <InputNumber min={1} max={30} style={{ width: 200 }} />
          </Form.Item>

          <Divider orientation="left">
            <Space><ClockCircleOutlined /> Connections</Space>
          </Divider>

          <Form.Item
            label="Use Mock RFC Data"
            name="USE_MOCK_RFC"
            valuePropName="checked"
            tooltip="Use local mock data instead of live RFC calls to SAP"
          >
            <Switch checkedChildren="Mock" unCheckedChildren="Live" />
          </Form.Item>

          <Form.Item
            label="Use Mock SharePoint Data"
            name="USE_MOCK_SHAREPOINT"
            valuePropName="checked"
            tooltip="Use local mock data instead of live Microsoft Graph API calls"
          >
            <Switch checkedChildren="Mock" unCheckedChildren="Live" />
          </Form.Item>

          <Divider orientation="left">
            <Space><RobotOutlined /> AI Integration — Connect Your Account</Space>
          </Divider>

          <Alert
            type="info"
            showIcon
            icon={<ApiOutlined />}
            style={{ marginBottom: 16 }}
            message="Connect an AI Provider"
            description={
              <div>
                <p style={{ margin: '4px 0', fontSize: 12 }}>
                  Connect your AI account to unlock: <strong>AI Chat Assistant</strong> (ask questions about your projects),
                  <strong> Smart Email Reports</strong> (AI-polished weekly emails), and <strong>Test Risk Analysis</strong>.
                </p>
                <p style={{ margin: '4px 0', fontSize: 12, color: '#389e0d' }}>
                  <strong>Gemini is FREE</strong> — 15 requests/min, 1 million tokens/day. No credit card required.
                </p>
                <p style={{ margin: '4px 0', fontSize: 12 }}>
                  Enterprise users: your IT admin provisions API keys billed to the org — no personal cost.
                </p>
              </div>
            }
          />

          {/* Step 1: Choose Provider */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Step 1: Choose AI Provider</Text>
            <Radio.Group
              value={aiProvider}
              onChange={e => { setAiProvider(e.target.value); setAiTestResult(null); setAiConnected(false); }}
              optionType="button"
              buttonStyle="solid"
              size="large"
            >
              <Radio.Button value="claude" style={{ height: 60, display: 'inline-flex', alignItems: 'center', padding: '0 24px' }}>
                <Space direction="vertical" size={0} align="center">
                  <span style={{ fontSize: 16, fontWeight: 600 }}>Claude</span>
                  <span style={{ fontSize: 11, color: 'inherit', opacity: 0.8 }}>Anthropic</span>
                </Space>
              </Radio.Button>
              <Radio.Button value="chatgpt" style={{ height: 60, display: 'inline-flex', alignItems: 'center', padding: '0 24px' }}>
                <Space direction="vertical" size={0} align="center">
                  <span style={{ fontSize: 16, fontWeight: 600 }}>ChatGPT</span>
                  <span style={{ fontSize: 11, color: 'inherit', opacity: 0.8 }}>OpenAI</span>
                </Space>
              </Radio.Button>
              <Radio.Button value="gemini" style={{ height: 60, display: 'inline-flex', alignItems: 'center', padding: '0 24px' }}>
                <Space direction="vertical" size={0} align="center">
                  <span style={{ fontSize: 16, fontWeight: 600 }}>Gemini ✨</span>
                  <span style={{ fontSize: 11, color: 'inherit', opacity: 0.8 }}>Google • FREE</span>
                </Space>
              </Radio.Button>
            </Radio.Group>
          </div>

          {/* Step 2: Enter API Key */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Step 2: Enter API Key</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              {aiProvider === 'claude'
                ? <>Get your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">console.anthropic.com</a> → API Keys → Create Key</>
                : aiProvider === 'chatgpt'
                ? <>Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com</a> → API Keys → Create new secret key</>
                : <>Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> → Create API Key (FREE, takes 10 seconds)</>
              }
            </Text>
            <Input.Password
              value={aiApiKey}
              onChange={e => setAiApiKey(e.target.value)}
              placeholder={aiProvider === 'claude' ? 'sk-ant-api03-...' : aiProvider === 'chatgpt' ? 'sk-proj-...' : 'AIzaSy...'}
              style={{ width: 420 }}
              addonBefore={<LinkOutlined />}
            />
          </div>

          {/* Step 3: Connect & Test */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Step 3: Connect Account</Text>
            <Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={aiSaving}
                disabled={!aiApiKey.trim()}
                onClick={async () => {
                  setAiSaving(true);
                  setAiTestResult(null);
                  try {
                    // Save config
                    const saveResult = await aiApi.saveConfig(aiProvider, aiApiKey);
                    if (!saveResult.success) {
                      setAiTestResult({ success: false, message: saveResult.message });
                      return;
                    }
                    // Test connection
                    setAiTesting(true);
                    const testResult = await aiApi.testConnection();
                    setAiTestResult(testResult);
                    setAiConnected(testResult.success);
                    if (testResult.success) {
                      message.success(`${aiProvider === 'claude' ? 'Claude' : aiProvider === 'chatgpt' ? 'ChatGPT' : 'Gemini'} connected successfully!`);
                    }
                  } catch (err: any) {
                    setAiTestResult({ success: false, message: err.message || 'Connection failed' });
                  } finally {
                    setAiSaving(false);
                    setAiTesting(false);
                  }
                }}
              >
                Connect & Test
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                loading={aiTesting && !aiSaving}
                onClick={async () => {
                  setAiTesting(true);
                  setAiTestResult(null);
                  try {
                    const result = await aiApi.testConnection();
                    setAiTestResult(result);
                    setAiConnected(result.success);
                  } catch (err: any) {
                    setAiTestResult({ success: false, message: err.message || 'Test failed' });
                  } finally {
                    setAiTesting(false);
                  }
                }}
              >
                Test Existing Connection
              </Button>
            </Space>
          </div>

          {/* Connection Status */}
          {aiTestResult && (
            <Alert
              type={aiTestResult.success ? 'success' : 'error'}
              showIcon
              icon={aiTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              style={{ marginBottom: 16 }}
              message={aiTestResult.success ? 'AI Connected' : 'Connection Failed'}
              description={aiTestResult.message}
            />
          )}

          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Once connected, click the <RobotOutlined /> button (bottom-right) or use the <strong>AI Assistant</strong> menu item 
            to chat with the agent. It can answer questions like "Which projects are RED?" or "Draft a status email for PP project."
          </Text>

          <Divider orientation="left">
            <Space><SettingOutlined /> Transport Settings</Space>
          </Divider>

          <Form.Item
            label="TR Number Prefix"
            name="TR_PREFIX"
            tooltip="Expected prefix for transport request numbers (e.g., DEVK9)"
          >
            <Input style={{ width: 200 }} placeholder="DEVK9" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
            >
              Save Settings
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* About */}
      <Card title="About" size="small">
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Application">SAP Project Management App</Descriptions.Item>
          <Descriptions.Item label="Version">1.0.0</Descriptions.Item>
          <Descriptions.Item label="Framework">SAP CAP + React + Ant Design</Descriptions.Item>
          <Descriptions.Item label="Target Platform">SAP BTP Cloud Foundry</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default SettingsPage;
