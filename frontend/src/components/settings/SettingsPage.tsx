import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Switch, Button, Select, Typography,
  Divider, Space, message, Alert, Row, Col,
} from 'antd';
import {
  SettingOutlined, SaveOutlined, RobotOutlined, SyncOutlined,
  ClockCircleOutlined, ThunderboltOutlined, CheckCircleOutlined,
  CloseCircleOutlined, LinkOutlined, ApiOutlined, CloudOutlined
} from '@ant-design/icons';
import { configApi, aiApi, sharePointApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const AI_PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter (Multi-model, FREE)', hint: 'sk-or-v1-...', url: 'https://openrouter.ai/keys' },
  { value: 'gemini',     label: 'Gemini (Google, FREE)',          hint: 'AIzaSy...',     url: 'https://aistudio.google.com/apikey' },
  { value: 'claude',     label: 'Claude (Anthropic)',             hint: 'sk-ant-api03-...', url: 'https://console.anthropic.com/settings/keys' },
  { value: 'chatgpt',    label: 'ChatGPT (OpenAI)',              hint: 'sk-proj-...',   url: 'https://platform.openai.com/api-keys' },
];

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string; provider?: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>('openrouter');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const { canConfigure, canWrite } = useAuth();

  // SharePoint configuration state
  const [spTenantId, setSpTenantId] = useState('');
  const [spClientId, setSpClientId] = useState('');
  const [spClientSecret, setSpClientSecret] = useState('');
  const [spSiteUrl, setSpSiteUrl] = useState('');
  const [spDriveId, setSpDriveId] = useState('');
  const [spSaving, setSpSaving] = useState(false);
  const [spResult, setSpResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await configApi.getAll();
      const data = res.value || [];
      const formValues: any = {};
      data.forEach((c: any) => {
        if (c.configKey === 'AI_PROVIDER') {
          setAiProvider(c.configValue || 'openrouter');
        }
        // Populate SharePoint fields from saved config
        if (c.configKey === 'SHAREPOINT_TENANT_ID') setSpTenantId(c.configValue || '');
        if (c.configKey === 'SHAREPOINT_CLIENT_ID') setSpClientId(c.configValue || '');
        if (c.configKey === 'SHAREPOINT_CLIENT_SECRET' && c.configValue) setSpClientSecret('••••••••'); // masked
        if (c.configKey === 'SHAREPOINT_SITE_URL') setSpSiteUrl(c.configValue || '');
        if (c.configKey === 'SHAREPOINT_DRIVE_ID') setSpDriveId(c.configValue || '');
        const key = c.configKey || c.key;
        if (c.valueType === 'boolean') {
          formValues[key] = c.configValue === 'true';
        } else if (c.valueType === 'number') {
          formValues[key] = Number(c.configValue);
        } else {
          formValues[key] = c.configValue;
        }
      });
      form.setFieldsValue(formValues);
    } catch {
      // Configs may not exist yet
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

  const selectedProvider = AI_PROVIDERS.find(p => p.value === aiProvider);

  return (
    <div>
      <Title level={3}>
        <SettingOutlined style={{ marginRight: 8 }} />
        Settings
      </Title>

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
            SNOW_TASK_PREFIX: 'SNOW',
            INCIDENT_PREFIX: 'INC',
            VENDOR_TICKET_PREFIX: 'CS',
          }}
        >
          <Divider orientation="left">
            <Space><SyncOutlined /> Data Synchronization</Space>
          </Divider>

          <Form.Item label="Auto-Refresh Interval (minutes)" name="REFRESH_INTERVAL_MINUTES"
            tooltip="How often to automatically refresh data from SAP and SharePoint">
            <InputNumber min={5} max={120} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item label="Stuck Transport Threshold (days)" name="STUCK_THRESHOLD_DAYS"
            tooltip="Number of days in the same system before a transport is considered stuck">
            <InputNumber min={1} max={30} style={{ width: 200 }} />
          </Form.Item>

          <Divider orientation="left">
            <Space><ClockCircleOutlined /> Connections</Space>
          </Divider>

          <Form.Item label="Use Mock RFC Data" name="USE_MOCK_RFC" valuePropName="checked"
            tooltip="Use local mock data instead of live RFC calls to SAP">
            <Switch checkedChildren="Mock" unCheckedChildren="Live" />
          </Form.Item>

          <Form.Item label="Use Mock SharePoint Data" name="USE_MOCK_SHAREPOINT" valuePropName="checked"
            tooltip="Use local mock data instead of live Microsoft Graph API calls">
            <Switch checkedChildren="Mock" unCheckedChildren="Live" />
          </Form.Item>

          <Divider orientation="left">
            <Space><RobotOutlined /> AI Integration</Space>
          </Divider>

          <Alert type="info" showIcon icon={<ApiOutlined />} style={{ marginBottom: 16 }}
            message="Connect an AI Provider"
            description={
              <Text style={{ fontSize: 12 }}>
                Choose your AI provider from the dropdown below. Your company IT admin provisions the API key.
                <strong> OpenRouter</strong> and <strong>Gemini</strong> have free tiers — no credit card needed.
              </Text>
            }
          />

          {/* Single Dropdown for AI Provider */}
          <Form.Item label="AI Provider">
            <Select
              value={aiProvider}
              onChange={(val) => { setAiProvider(val); setAiTestResult(null); }}
              style={{ width: 400 }}
              size="large"
            >
              {AI_PROVIDERS.map(p => (
                <Option key={p.value} value={p.value}>{p.label}</Option>
              ))}
            </Select>
          </Form.Item>

          {/* API Key Input */}
          <Form.Item label={
            <Space>
              <span>API Key</span>
              {selectedProvider && (
                <a href={selectedProvider.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                  Get key →
                </a>
              )}
            </Space>
          }>
            <Input.Password
              value={aiApiKey}
              onChange={e => setAiApiKey(e.target.value)}
              placeholder={selectedProvider?.hint || 'Enter API key...'}
              style={{ width: 420 }}
              addonBefore={<LinkOutlined />}
              disabled={!canConfigure}
            />
            {!canConfigure && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                Only Admin can change AI configuration.
              </Text>
            )}
          </Form.Item>

          {/* Connect & Test Buttons */}
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={aiSaving}
              disabled={!aiApiKey.trim() || !canConfigure}
              onClick={async () => {
                setAiSaving(true); setAiTestResult(null);
                try {
                  const saveResult = await aiApi.saveConfig(aiProvider, aiApiKey);
                  if (!saveResult.success) { setAiTestResult({ success: false, message: saveResult.message }); return; }
                  setAiTesting(true);
                  const testResult = await aiApi.testConnection();
                  setAiTestResult(testResult);
                  if (testResult.success) {
                    const name = AI_PROVIDERS.find(p => p.value === aiProvider)?.label || aiProvider;
                    message.success(`${name} connected successfully!`);
                  }
                } catch (err: any) { setAiTestResult({ success: false, message: err.message || 'Connection failed' }); }
                finally { setAiSaving(false); setAiTesting(false); }
              }}>
              Save & Test
            </Button>
            <Button icon={<ThunderboltOutlined />} loading={aiTesting && !aiSaving}
              onClick={async () => {
                setAiTesting(true); setAiTestResult(null);
                try {
                  const result = await aiApi.testConnection();
                  setAiTestResult(result);
                } catch (err: any) { setAiTestResult({ success: false, message: err.message || 'Test failed' }); }
                finally { setAiTesting(false); }
              }}>
              Test Existing
            </Button>
          </Space>

          {aiTestResult && (
            <Alert type={aiTestResult.success ? 'success' : 'error'} showIcon
              icon={aiTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              style={{ marginBottom: 16 }}
              message={aiTestResult.success ? 'AI Connected' : 'Connection Failed'}
              description={aiTestResult.message} />
          )}

          <Divider orientation="left">
            <Space><SettingOutlined /> Transport Settings</Space>
          </Divider>

          <Form.Item label="TR Number Prefix" name="TR_PREFIX"
            tooltip="Expected prefix for transport request numbers (e.g., DEVK9)">
            <Input style={{ width: 200 }} placeholder="DEVK9" />
          </Form.Item>

          <Divider orientation="left">
            <Space><SettingOutlined /> Ticket Prefixes (Auto-Link)</Space>
          </Divider>

          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Auto-Link Ticket Patterns"
            description={
              <Text style={{ fontSize: 12 }}>
                Configure the prefixes used to auto-detect ticket numbers in TR descriptions.
                The app scans each transport description for these patterns and auto-links them to matching work items.
              </Text>
            }
          />

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="ServiceNow Task Prefix" name="SNOW_TASK_PREFIX"
                tooltip="Prefix for ServiceNow regular tasks (e.g., SNOW, SCTASK)">
                <Input placeholder="SNOW" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Incident Prefix" name="INCIDENT_PREFIX"
                tooltip="Prefix for incident tickets (e.g., INC)">
                <Input placeholder="INC" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Vendor Ticket Prefix" name="VENDOR_TICKET_PREFIX"
                tooltip="Prefix for vendor/CS tickets (e.g., CS)">
                <Input placeholder="CS" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
              Save Settings
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* SharePoint Live Integration Card */}
      <Card
        title={<Space><CloudOutlined /> SharePoint Live Integration</Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="info"
          showIcon
          icon={<CloudOutlined />}
          style={{ marginBottom: 16 }}
          message="Connect to Microsoft SharePoint"
          description={
            <Text style={{ fontSize: 12 }}>
              Configure Microsoft Graph API credentials to browse and import SharePoint documents directly into the AI Document Analyzer.
              Requires an <strong>Azure AD App Registration</strong> with <code>Files.Read.All</code> and <code>Sites.Read.All</code> permissions.
              <br />
              <a href="https://learn.microsoft.com/en-us/graph/auth-register-app-v2" target="_blank" rel="noopener noreferrer">
                Azure AD App Registration Guide →
              </a>
            </Text>
          }
        />

        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Azure AD Tenant ID</Text>
              <Input
                value={spTenantId}
                onChange={e => setSpTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={!canConfigure}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Client ID (App ID)</Text>
              <Input
                value={spClientId}
                onChange={e => setSpClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={!canConfigure}
              />
            </div>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Client Secret</Text>
              <Input.Password
                value={spClientSecret}
                onChange={e => setSpClientSecret(e.target.value)}
                placeholder="Enter client secret..."
                disabled={!canConfigure}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>SharePoint Site URL / ID</Text>
              <Input
                value={spSiteUrl}
                onChange={e => setSpSiteUrl(e.target.value)}
                placeholder="contoso.sharepoint.com,site-id,web-id"
                disabled={!canConfigure}
              />
            </div>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Drive / Library ID</Text>
              <Input
                value={spDriveId}
                onChange={e => setSpDriveId(e.target.value)}
                placeholder="b!xxx... (from Graph Explorer)"
                disabled={!canConfigure}
              />
            </div>
          </Col>
        </Row>

        <Space style={{ marginTop: 8 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={spSaving}
            disabled={!canConfigure}
            onClick={async () => {
              setSpSaving(true);
              setSpResult(null);
              try {
                const result = await sharePointApi.configure({
                  tenantId: spTenantId,
                  clientId: spClientId,
                  clientSecret: spClientSecret === '••••••••' ? '' : spClientSecret, // don't send masked placeholder
                  siteUrl: spSiteUrl,
                  driveId: spDriveId,
                });
                setSpResult(result);
                if (result.success) message.success(result.message);
                else message.error(result.message);
              } catch (err: any) {
                setSpResult({ success: false, message: err.message });
              } finally {
                setSpSaving(false);
              }
            }}
          >
            Save SharePoint Config
          </Button>
        </Space>

        {spResult && (
          <Alert
            type={spResult.success ? 'success' : 'error'}
            showIcon
            style={{ marginTop: 12 }}
            message={spResult.success ? 'SharePoint Configured' : 'Configuration Error'}
            description={spResult.message}
          />
        )}
      </Card>
    </div>
  );
};

export default SettingsPage;
