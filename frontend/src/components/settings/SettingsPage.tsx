import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, InputNumber, Switch, Button, Typography,
  Divider, Space, message, Alert, Row, Col, DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import {
  SettingOutlined, SaveOutlined, RobotOutlined, SyncOutlined,
  ClockCircleOutlined, ThunderboltOutlined, CheckCircleOutlined,
  CloseCircleOutlined, CloudOutlined, DeploymentUnitOutlined
} from '@ant-design/icons';
import { configApi, aiApi, sharePointApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string; provider?: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const { canConfigure, canWrite } = useAuth();

  // SAP RFC configuration state — values must be entered by Admin/SuperAdmin,
  // no hardcoded defaults. Loaded from AppConfig in loadConfigs().
  const [rfcDestination, setRfcDestination] = useState('');
  const [rfcFmName, setRfcFmName] = useState('');
  const [rfcStartDate, setRfcStartDate] = useState<dayjs.Dayjs | null>(null);
  const [rfcSystemsFilter, setRfcSystemsFilter] = useState('');
  const [rfcSchedule, setRfcSchedule] = useState('');
  const [rfcScheduleEnabled, setRfcScheduleEnabled] = useState(false);
  const [rfcSaving, setRfcSaving] = useState(false);
  const [rfcResult, setRfcResult] = useState<{ success: boolean; message: string } | null>(null);

  // SharePoint configuration state
  const [spTenantId, setSpTenantId] = useState('');
  const [spClientId, setSpClientId] = useState('');
  const [spClientSecret, setSpClientSecret] = useState('');
  const [spSiteUrl, setSpSiteUrl] = useState('');
  const [spDriveId, setSpDriveId] = useState('');
  const [spSaving, setSpSaving] = useState(false);
  const [spResult, setSpResult] = useState<{ success: boolean; message: string } | null>(null);

  // SAP AI Core configuration state
  const [aiDestination, setAiDestination] = useState('');
  const [aiDeploymentId, setAiDeploymentId] = useState('');
  const [aiResourceGroup, setAiResourceGroup] = useState('');
  const [aiCoreSaving, setAiCoreSaving] = useState(false);
  const [aiCoreResult, setAiCoreResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await configApi.getAll();
      const data = res.value || [];
      const formValues: any = {};
      data.forEach((c: any) => {
        // Populate SharePoint fields from saved config
        if (c.configKey === 'SHAREPOINT_TENANT_ID') setSpTenantId(c.configValue || '');
        if (c.configKey === 'SHAREPOINT_CLIENT_ID') setSpClientId(c.configValue || '');
        if (c.configKey === 'SHAREPOINT_CLIENT_SECRET' && c.configValue) setSpClientSecret('••••••••'); // masked
        if (c.configKey === 'SHAREPOINT_SITE_URL') setSpSiteUrl(c.configValue || '');
        if (c.configKey === 'SHAREPOINT_DRIVE_ID') setSpDriveId(c.configValue || '');
        if (c.configKey === 'RFC_DESTINATION_NAME' && c.configValue) setRfcDestination(c.configValue);
        if (c.configKey === 'RFC_FM_NAME' && c.configValue) setRfcFmName(c.configValue);
        if (c.configKey === 'RFC_TR_START_DATE' && c.configValue) {
          // stored as YYYYMMDD
          const d = dayjs(c.configValue, 'YYYYMMDD');
          if (d.isValid()) setRfcStartDate(d);
        }
        if (c.configKey === 'RFC_SYSTEMS_FILTER') setRfcSystemsFilter(c.configValue || '');
        if (c.configKey === 'RFC_SCHEDULE_CRON') setRfcSchedule(c.configValue || '');
        if (c.configKey === 'RFC_SCHEDULE_ENABLED') setRfcScheduleEnabled(c.configValue === 'true');
        if (c.configKey === 'AI_DESTINATION_NAME') setAiDestination(c.configValue || '');
        if (c.configKey === 'AI_CORE_DEPLOYMENT_ID') setAiDeploymentId(c.configValue || '');
        if (c.configKey === 'AI_CORE_RESOURCE_GROUP') setAiResourceGroup(c.configValue || '');
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

      {/* SAP RFC Integration Card */}
      <Card
        title={<Space><DeploymentUnitOutlined /> SAP RFC Integration</Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="info"
          showIcon
          icon={<DeploymentUnitOutlined />}
          style={{ marginBottom: 16 }}
          message="Live SAP Transport Sync"
          description={
            <Text style={{ fontSize: 12 }}>
              Configure the BTP Destination, remote function module, and start date used by
              <code> Refresh All Data</code>. Values are stored in AppConfig and read by the
              backend on every sync — no redeploy needed. The destination must be created in
              <strong> BTP Cockpit → Connectivity → Destinations</strong> with Basic auth and a
              Cloud Connector mapping to your SAP system.
            </Text>
          }
        />

        <Row gutter={16}>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">BTP Destination Name</Text>
              <Input
                value={rfcDestination}
                onChange={e => setRfcDestination(e.target.value)}
                placeholder="S4HANA_RFC_DS4"
                disabled={!canConfigure}
              />
            </div>
          </Col>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Function Module</Text>
              <Input
                value={rfcFmName}
                onChange={e => setRfcFmName(e.target.value)}
                placeholder="ZTCC_GET_TRANSPORTS"
                disabled={!canConfigure}
              />
            </div>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">TR Start Date</Text>
              <DatePicker
                value={rfcStartDate}
                onChange={(d) => setRfcStartDate(d)}
                format="YYYY-MM-DD"
                className="date-picker-block"
                disabled={!canConfigure}
              />
              <Text type="secondary" className="field-hint">
                FM returns transports created on/after this date. Re-runs upsert by TR number so
                no duplicates are created.
              </Text>
            </div>
          </Col>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Systems Filter (optional)</Text>
              <Input
                value={rfcSystemsFilter}
                onChange={e => setRfcSystemsFilter(e.target.value)}
                placeholder="DS4,QS4,PS4"
                disabled={!canConfigure}
              />
              <Text type="secondary" className="field-hint">
                Comma-separated system IDs. Empty = all.
              </Text>
            </div>
          </Col>
        </Row>

        <Divider orientation="left">
          <Space><ClockCircleOutlined /> Auto-Sync Schedule</Space>
        </Divider>

        <Row gutter={16}>
          <Col span={8}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Enable scheduled auto-refresh</Text>
              <Switch
                checked={rfcScheduleEnabled}
                onChange={setRfcScheduleEnabled}
                checkedChildren="On"
                unCheckedChildren="Off"
                disabled={!canConfigure}
              />
              <Text type="secondary" className="field-hint">
                When off, only the header Refresh button triggers a sync.
              </Text>
            </div>
          </Col>
          <Col span={16}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Cron schedule</Text>
              <Input
                value={rfcSchedule}
                onChange={e => setRfcSchedule(e.target.value)}
                placeholder="0 2 * * *   (= every day at 02:00)"
                disabled={!canConfigure || !rfcScheduleEnabled}
              />
              <Text type="secondary" className="field-hint">
                Standard 5-field cron (min&nbsp;hour&nbsp;dom&nbsp;mon&nbsp;dow). Examples:
                <code> */30 * * * *</code> every 30&nbsp;min,
                <code> 0 */4 * * *</code> every 4&nbsp;h,
                <code> 0 6 * * 1-5</code> weekdays 06:00.
                Server timezone is UTC on BTP.
              </Text>
            </div>
          </Col>
        </Row>

        <Space style={{ marginTop: 8 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={rfcSaving}
            disabled={!canConfigure}
            onClick={async () => {
              setRfcSaving(true);
              setRfcResult(null);
              try {
                await configApi.update('RFC_DESTINATION_NAME', rfcDestination);
                await configApi.update('RFC_FM_NAME', rfcFmName);
                await configApi.update(
                  'RFC_TR_START_DATE',
                  rfcStartDate ? rfcStartDate.format('YYYYMMDD') : ''
                );
                await configApi.update('RFC_SYSTEMS_FILTER', rfcSystemsFilter);
                await configApi.update('RFC_SCHEDULE_CRON', rfcSchedule);
                await configApi.update('RFC_SCHEDULE_ENABLED', String(rfcScheduleEnabled));
                const msg = 'SAP RFC settings saved';
                setRfcResult({ success: true, message: msg });
                message.success(msg);
              } catch (err: any) {
                setRfcResult({ success: false, message: err?.message || 'Failed to save' });
                message.error('Failed to save RFC settings');
              } finally {
                setRfcSaving(false);
              }
            }}
          >
            Save SAP RFC Config
          </Button>
          {!canConfigure && (
            <Text type="secondary" className="field-hint">
              Only Admin / SuperAdmin can change RFC settings.
            </Text>
          )}
        </Space>

        {rfcResult && (
          <Alert
            type={rfcResult.success ? 'success' : 'error'}
            showIcon
            style={{ marginTop: 12 }}
            message={rfcResult.success ? 'SAP RFC Configured' : 'Configuration Error'}
            description={rfcResult.message}
          />
        )}
      </Card>

      {/* SAP AI Core Integration Card */}
      <Card
        title={<Space><RobotOutlined /> SAP AI Core Integration</Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="info"
          showIcon
          icon={<RobotOutlined />}
          style={{ marginBottom: 16 }}
          message="SAP Generative AI Hub"
          description={
            <Text style={{ fontSize: 12 }}>
              Configure the BTP Destination and deployment used for all AI features (chat, document
              analysis, weekly digest). Values are stored in AppConfig and read by the backend on
              every request — no redeploy needed. The destination must be created in
              <strong> BTP Cockpit → Connectivity → Destinations</strong> with
              OAuth2ClientCredentials using your AI Core service key.
            </Text>
          }
        />

        <Row gutter={16}>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">BTP Destination Name</Text>
              <Input
                value={aiDestination}
                onChange={e => setAiDestination(e.target.value)}
                placeholder="Ai_Core"
                disabled={!canConfigure}
              />
              <Text type="secondary" className="field-hint">
                Name of the destination configured in BTP Cockpit (e.g. Ai_Core).
              </Text>
            </div>
          </Col>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Deployment ID</Text>
              <Input
                value={aiDeploymentId}
                onChange={e => setAiDeploymentId(e.target.value)}
                placeholder="d8e31dc8207d4ea9"
                disabled={!canConfigure}
              />
              <Text type="secondary" className="field-hint">
                Found in AI Core → ML Operations → Deployments.
              </Text>
            </div>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Resource Group</Text>
              <Input
                value={aiResourceGroup}
                onChange={e => setAiResourceGroup(e.target.value)}
                placeholder="default"
                disabled={!canConfigure}
              />
              <Text type="secondary" className="field-hint">
                AI Core resource group (usually "default").
              </Text>
            </div>
          </Col>
        </Row>

        <Space style={{ marginTop: 8 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={aiCoreSaving}
            disabled={!canConfigure}
            onClick={async () => {
              setAiCoreSaving(true);
              setAiCoreResult(null);
              try {
                await configApi.update('AI_DESTINATION_NAME', aiDestination);
                await configApi.update('AI_CORE_DEPLOYMENT_ID', aiDeploymentId);
                await configApi.update('AI_CORE_RESOURCE_GROUP', aiResourceGroup);
                setAiCoreResult({ success: true, message: 'SAP AI Core settings saved' });
                message.success('SAP AI Core settings saved');
              } catch (err: any) {
                setAiCoreResult({ success: false, message: err?.message || 'Failed to save' });
                message.error('Failed to save AI Core settings');
              } finally {
                setAiCoreSaving(false);
              }
            }}
          >
            Save AI Core Config
          </Button>
          {!canConfigure && (
            <Text type="secondary" className="field-hint">
              Only Admin / SuperAdmin can change AI Core settings.
            </Text>
          )}
        </Space>

        {aiCoreResult && (
          <Alert
            type={aiCoreResult.success ? 'success' : 'error'}
            showIcon
            style={{ marginTop: 12 }}
            message={aiCoreResult.success ? 'AI Core Configured' : 'Configuration Error'}
            description={aiCoreResult.message}
          />
        )}
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
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Azure AD Tenant ID</Text>
              <Input
                value={spTenantId}
                onChange={e => setSpTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={!canConfigure}
              />
            </div>
          </Col>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Client ID (App ID)</Text>
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
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Client Secret</Text>
              <Input.Password
                value={spClientSecret}
                onChange={e => setSpClientSecret(e.target.value)}
                placeholder="Enter client secret..."
                disabled={!canConfigure}
              />
            </div>
          </Col>
          <Col span={12}>
            <div className="settings-field-group">
              <Text strong className="settings-field-label">SharePoint Site URL / ID</Text>
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
            <div className="settings-field-group">
              <Text strong className="settings-field-label">Drive / Library ID</Text>
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
