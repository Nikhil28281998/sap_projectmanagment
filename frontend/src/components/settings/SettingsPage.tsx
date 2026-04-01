import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Switch, Button, Select, Typography,
  Divider, Space, message, Descriptions, Tag, Alert
} from 'antd';
import {
  SettingOutlined, SaveOutlined, RobotOutlined, SyncOutlined,
  ClockCircleOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { useHealth } from '../../hooks/useData';
import { configApi, aiApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const { data: health } = useHealth();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);

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
            <Space><RobotOutlined /> AI Agent (Claude)</Space>
          </Divider>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Enterprise Claude Integration"
            description={
              <div>
                <Paragraph style={{ margin: 0, fontSize: 12 }}>
                  To use AI features, your IT admin needs to create an API key at{' '}
                  <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>.
                  If your organization has an Anthropic enterprise contract, the API calls bill to the org account — 
                  no personal cost. Enterprise Claude.ai login (SSO) is for the chat app only; API access requires a separate key.
                </Paragraph>
              </div>
            }
          />

          <Form.Item
            label="Enable AI Features"
            name="ENABLE_AI"
            valuePropName="checked"
            tooltip="Enable Claude AI for report polish, test analysis, and smart insights"
          >
            <Switch checkedChildren="ON" unCheckedChildren="OFF" />
          </Form.Item>

          <Form.Item
            label="Claude API Key"
            name="CLAUDE_API_KEY"
            tooltip="Anthropic API key (sk-ant-...). Stored securely in app config."
          >
            <Input.Password
              placeholder="sk-ant-api03-..."
              style={{ width: 400 }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              icon={<ThunderboltOutlined />}
              loading={aiTesting}
              onClick={async () => {
                setAiTesting(true);
                setAiTestResult(null);
                try {
                  const result = await aiApi.testConnection();
                  setAiTestResult(result);
                } catch (err: any) {
                  setAiTestResult({ success: false, message: err.message || 'Connection failed' });
                } finally {
                  setAiTesting(false);
                }
              }}
            >
              Test AI Connection
            </Button>
            {aiTestResult && (
              <Tag
                color={aiTestResult.success ? 'success' : 'error'}
                icon={aiTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                style={{ marginLeft: 12 }}
              >
                {aiTestResult.message}
              </Tag>
            )}
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            AI is used for: (1) Polishing weekly reports into executive emails, 
            (2) Analyzing test results for risk insights. 
            Without AI, the app still generates structured reports — AI just makes them prettier.
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
