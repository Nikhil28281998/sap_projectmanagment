import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Badge, Dropdown, Space, Typography, Tag, Tooltip
} from 'antd';
import {
  MenuOutlined, HomeOutlined, DashboardOutlined, ProjectOutlined,
  ToolOutlined, SettingOutlined, SearchOutlined, FileTextOutlined,
  BellOutlined, UserOutlined, ReloadOutlined, WarningOutlined,
  AppstoreOutlined, QuestionCircleOutlined, RobotOutlined
} from '@ant-design/icons';
import { useHealth, useNotifications, useRefreshTransports } from '../../hooks/useData';
import AIChatDrawer from './AIChatDrawer';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: health } = useHealth();
  const { data: notifications = [] } = useNotifications();
  const refreshMutation = useRefreshTransports();

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Home Dashboard',
    },
    {
      key: 'dashboards',
      icon: <DashboardOutlined />,
      label: 'Dashboards',
      children: [
        { key: '/pipeline', label: 'Transport Pipeline' },
        { key: '/workitems', label: 'Project Tracker' },
      ],
    },
    {
      key: 'workitems-group',
      icon: <ProjectOutlined />,
      label: 'Work Items',
      children: [
        { key: '/workitems/Project', label: 'Projects' },
        { key: '/workitems/Enhancement', label: 'Enhancements' },
        { key: '/workitems/Break-fix', label: 'Break-Fixes' },
        { key: '/workitems/Upgrade', label: 'Upgrades' },
        { key: '/workitems/Support', label: 'Retailer Support' },
        { key: '/workitems/Hypercare', label: 'Hypercare' },
        { key: '/unassigned', label: '⚠ Unassigned' },
      ],
    },
    {
      key: 'tools',
      icon: <ToolOutlined />,
      label: 'Tools',
      children: [
        { key: '/report', label: 'Weekly Report' },
        { key: '/search', label: 'TR Search' },
      ],
    },
    {
      key: 'ai-agent',
      icon: <RobotOutlined />,
      label: 'AI Assistant',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ];

  const getSystemStatusTag = (system: string, status: string) => {
    const color = status === 'OK' ? 'success' : status === 'FAILED' ? 'error' : 'warning';
    return <Tag color={color}>{system}</Tag>;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <AppstoreOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          {!collapsed && (
            <Text strong style={{ marginLeft: 8, fontSize: 14 }}>
              SAP Project Mgmt
            </Text>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            if (key === 'ai-agent') {
              setChatOpen(true);
            } else {
              navigate(key);
            }
          }}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        {/* System Health Bar */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: 48,
          }}
        >
          <Space size="middle">
            {getSystemStatusTag('DEV', health?.database || 'UNKNOWN')}
            {getSystemStatusTag('QAS', health?.rfc || 'UNKNOWN')}
            {getSystemStatusTag('PRD', health?.sharepoint || 'UNKNOWN')}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {health?.timestamp
                ? `Last sync: ${new Date(health.timestamp).toLocaleTimeString()}`
                : 'Not connected'}
            </Text>
          </Space>

          <Space>
            <Tooltip title="Refresh All Data">
              <Button
                icon={<ReloadOutlined spin={refreshMutation.isPending} />}
                onClick={() => refreshMutation.mutate()}
                size="small"
              />
            </Tooltip>
            <Badge count={unreadCount} size="small">
              <Button icon={<BellOutlined />} size="small" />
            </Badge>
            <Button icon={<UserOutlined />} size="small" />
          </Space>
        </Header>

        {/* Main Content */}
        <Content style={{ margin: '16px', minHeight: 'calc(100vh - 80px)' }}>
          {children}
        </Content>
      </Layout>

      {/* AI Chat Drawer */}
      <AIChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Floating AI Button */}
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<RobotOutlined />}
        onClick={() => setChatOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          fontSize: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000,
        }}
      />
    </Layout>
  );
};

export default AppShell;
