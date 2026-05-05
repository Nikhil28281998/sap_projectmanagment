import React, { useState } from 'react';
import {
  Card, Typography, Table, Tag, Space, Button, Alert, Statistic, Row, Col, Badge,
  Divider, message, Tooltip, Result
} from 'antd';
import {
  TeamOutlined, SafetyCertificateOutlined, SettingOutlined,
  ReloadOutlined, BellOutlined, DatabaseOutlined, ApiOutlined,
  CheckCircleOutlined, WarningOutlined, LinkOutlined, SyncOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi, notificationApi, syncApi, autoApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const ROLE_COLORS: Record<string, string> = {
  Admin: 'red',
  Manager: 'blue',
  Developer: 'geekblue',
  Executive: 'green',
};

// Dev mode: known mocked users from package.json
const MOCKED_USERS = [
  { email: 'admin@test.com', name: 'Admin', roles: ['Admin', 'Manager', 'Executive', 'Developer'] },
  { email: 'manager@test.com', name: 'Manager', roles: ['Manager', 'Executive', 'Developer'] },
  { email: 'dev@test.com', name: 'Developer', roles: ['Developer'] },
  { email: 'exec@test.com', name: 'Executive', roles: ['Executive'] },
];

const AdminPage: React.FC = () => {
  const { user, canConfigure } = useAuth();
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  if (!canConfigure) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle="Admin access is required to view this page."
      />
    );
  }

  const handleGenerateNotifications = async () => {
    setGenLoading(true);
    try {
      const result = await notificationApi.generate();
      setGenResult(`Generated ${result.generated} new notifications`);
      message.success(result.message);
    } catch (err: any) {
      setGenResult(`Failed: ${err.message}`);
      message.error(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const data = await dashboardApi.getHealth();
      setHealthData(data);
    } catch (err: any) {
      message.error(`Health check failed: ${err.message}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const userColumns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => <Text strong>{email}</Text>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space>
          {roles.map((r: string) => (
            <Tag key={r} color={ROLE_COLORS[r] || 'default'}>{r}</Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>
        <TeamOutlined style={{ marginRight: 8 }} />
        Admin Panel
      </Title>

      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="Role Management"
        description={
          <Text style={{ fontSize: 12 }}>
            In production, user roles are managed via <strong>Okta groups</strong> mapped to BTP role-collections.
            Roles: <Tag color="red">Admin</Tag> <Tag color="blue">Manager</Tag> <Tag color="geekblue">Developer</Tag> <Tag color="green">Executive</Tag>.
            Admin has full access to all settings, configurations, and can edit every work item field.
          </Text>
        }
        style={{ marginBottom: 16 }}
      />

      {/* Current User Info */}
      <Card title="Your Session" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Logged in as" value={user?.email || 'Unknown'} valueStyle={{ fontSize: 14 }} />
          </Col>
          <Col span={6}>
            <Statistic title="Name" value={user?.name || 'Unknown'} valueStyle={{ fontSize: 14 }} />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Roles</Text>
            <Space>
              {user?.roles?.map((r: string) => (
                <Tag key={r} color={ROLE_COLORS[r] || 'default'}>{r}</Tag>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* User Management (Dev Mode) */}
      <Card title="Users (Development Mode)" size="small" style={{ marginBottom: 16 }}
        extra={<Tag color="orange">Mocked Auth</Tag>}>
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
          These users are defined in <code>package.json</code> for development.
          In production, users are authenticated via Okta/Azure AD and roles come from the IdP.
        </Paragraph>
        <Table
          columns={userColumns}
          dataSource={MOCKED_USERS}
          rowKey="email"
          size="small"
          pagination={false}
          rowClassName={(record) => record.email === user?.email ? 'ant-table-row-selected' : ''}
        />
      </Card>

      {/* System Operations */}
      <Card title="System Operations" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Button
              icon={<BellOutlined />}
              loading={genLoading}
              onClick={handleGenerateNotifications}
              type="primary"
            >
              Generate Notifications
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Auto-detect stuck TRs, failed imports, approaching go-lives, and test failures
            </Text>
          </Space>
          {genResult && <Alert message={genResult} type="info" showIcon closable />}

          <Divider dashed style={{ margin: '8px 0' }} />

          <Space>
            <Button
              icon={<LinkOutlined />}
              loading={linkLoading}
              onClick={async () => {
                setLinkLoading(true);
                try {
                  const result = await autoApi.linkTickets();
                  setLinkResult(result.message);
                  message.success(result.message);
                } catch (err: any) {
                  setLinkResult(`Failed: ${err.message}`);
                  message.error(err.message);
                } finally {
                  setLinkLoading(false);
                }
              }}
              type="primary"
              ghost
            >
              Auto-Link Tickets (SNOW/INC/CS)
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Scan TR descriptions for SNOW*/INC*/CS* patterns and auto-assign to matching work items
            </Text>
          </Space>
          {linkResult && <Alert message={linkResult} type="info" showIcon closable style={{ marginTop: 4 }} />}

          <Divider dashed style={{ margin: '8px 0' }} />

          <Space>
            <Button
              icon={<DatabaseOutlined />}
              loading={healthLoading}
              onClick={handleHealthCheck}
            >
              System Health Check
            </Button>
          </Space>

          {healthData && (
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Status" value={healthData.status}
                    prefix={healthData.status === 'OK' ? <CheckCircleOutlined style={{ color: 'var(--color-status-risk-low)' }} /> : <WarningOutlined style={{ color: 'var(--color-status-risk-medium)' }} />}
                    valueStyle={{ fontSize: 14, color: healthData.status === 'OK' ? 'var(--color-status-risk-low)' : 'var(--color-status-risk-medium)' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Database" value={healthData.database}
                    valueStyle={{ fontSize: 14, color: healthData.database === 'OK' ? 'var(--color-status-risk-low)' : 'var(--color-status-risk-high)' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="RFC (SAP)" value={healthData.rfc}
                    valueStyle={{ fontSize: 14, color: healthData.rfc === 'OK' ? 'var(--color-status-risk-low)' : 'var(--color-status-risk-medium)' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="SharePoint" value={healthData.sharepoint}
                    valueStyle={{ fontSize: 14, color: healthData.sharepoint === 'OK' ? 'var(--color-status-risk-low)' : 'var(--color-status-risk-medium)' }} />
                </Card>
              </Col>
            </Row>
          )}
        </Space>
      </Card>

      {/* Role Reference */}
      <Card title="Role Permissions Reference" size="small">
        <Table
          size="small"
          pagination={false}
          dataSource={[
            { area: 'View Dashboards & Reports', admin: '✅', manager: '✅', developer: '✅', executive: '✅' },
            { area: 'View Work Items & Transports', admin: '✅', manager: '✅', developer: '✅', executive: '✅' },
            { area: 'Edit Work Items', admin: '✅', manager: '✅', developer: '❌', executive: '❌' },
            { area: 'Categorize Transports', admin: '✅', manager: '✅', developer: '❌', executive: '❌' },
            { area: 'Refresh Data (RFC/SharePoint)', admin: '✅', manager: '✅', developer: '❌', executive: '❌' },
            { area: 'Generate Reports', admin: '✅', manager: '✅', developer: '❌', executive: '✅' },
            { area: 'Configure AI Provider', admin: '✅', developer: '❌', manager: '❌', executive: '❌' },
            { area: 'Use AI Chat', admin: '✅', manager: '✅', developer: '✅', executive: '✅' },
            { area: 'App Settings', admin: '✅', manager: '✅', developer: '❌', executive: '❌' },
            { area: 'Admin Panel / Notifications', admin: '✅', manager: '❌', developer: '❌', executive: '❌' },
          ]}
          columns={[
            { title: 'Area', dataIndex: 'area', key: 'area' },
            { title: <Tag color="red">Admin</Tag>, dataIndex: 'admin', key: 'admin', align: 'center' as const },
            { title: <Tag color="blue">Manager</Tag>, dataIndex: 'manager', key: 'manager', align: 'center' as const },
            { title: <Tag color="geekblue">Developer</Tag>, dataIndex: 'developer', key: 'developer', align: 'center' as const },
            { title: <Tag color="green">Executive</Tag>, dataIndex: 'executive', key: 'executive', align: 'center' as const },
          ]}
          rowKey="area"
        />
      </Card>
    </div>
  );
};

export default AdminPage;
