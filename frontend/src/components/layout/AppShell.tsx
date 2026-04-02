import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Badge, Space, Typography, Tooltip, Avatar, Dropdown, Tag
} from 'antd';
import {
  HomeOutlined, DashboardOutlined, ProjectOutlined,
  SettingOutlined, FileTextOutlined,
  BellOutlined, ReloadOutlined, WarningOutlined,
  AppstoreOutlined, RobotOutlined, TeamOutlined
} from '@ant-design/icons';
import { useNotifications, useRefreshTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule } from '../../contexts/ModuleContext';
import AIChatDrawer from './AIChatDrawer';
import NotificationDrawer from './NotificationDrawer';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AppShellProps {
  children: React.ReactNode;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  sap: <AppstoreOutlined />,
  coupa: <AppstoreOutlined style={{ color: '#0070d2' }} />,
  commercial: <AppstoreOutlined style={{ color: '#722ed1' }} />,
};

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notifications = [] } = useNotifications();
  const refreshMutation = useRefreshTransports();
  const { user, canWrite, canConfigure } = useAuth();
  const { activeModule, setActiveModule, moduleDef, allModules } = useModule();

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const roleBadge = user?.isAdmin ? { color: '#f50', text: 'Admin' }
    : user?.isManager ? { color: '#2db7f5', text: 'Manager' }
    : user?.isExecutive ? { color: '#87d068', text: 'Executive' }
    : { color: '#108ee9', text: 'Developer' };

  const menuItems: any[] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Home Dashboard',
    },
    {
      key: '/pipeline',
      icon: <DashboardOutlined />,
      label: 'Transport Pipeline',
    },
    {
      key: '/tracker',
      icon: <ProjectOutlined />,
      label: 'Tracker',
    },
    ...(canWrite ? [{
      key: '/unassigned',
      icon: <WarningOutlined />,
      label: 'Unassigned TRs',
    }] : []),
    {
      key: '/report',
      icon: <FileTextOutlined />,
      label: 'Weekly Report',
    },
    {
      key: 'ai-agent',
      icon: <RobotOutlined />,
      label: 'AI Assistant',
    },
  ];

  if (canWrite) {
    menuItems.push({
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    });
  }

  if (canConfigure) {
    menuItems.push({
      key: '/admin',
      icon: <TeamOutlined />,
      label: 'Admin',
    });
  }

  const userMenuItems = [
    { key: 'role', label: <Tag color={roleBadge.color}>{roleBadge.text}</Tag>, disabled: true },
    { key: 'email', label: <Text type="secondary" style={{ fontSize: 12 }}>{user?.email}</Text>, disabled: true },
    { type: 'divider' as const },
    { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
  ];

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
              Command Center
            </Text>
          )}
        </div>
        {/* Module Switcher */}
        <div style={{ padding: collapsed ? '8px 4px' : '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
          {allModules.map((m) => (
            <Tooltip key={m.key} title={collapsed ? m.name : undefined} placement="right">
              <div
                onClick={() => { setActiveModule(m.key); navigate('/'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: collapsed ? '6px' : '6px 8px', marginBottom: 2,
                  borderRadius: 6, cursor: 'pointer', fontSize: 12,
                  background: activeModule === m.key ? `${m.color}12` : 'transparent',
                  border: activeModule === m.key ? `1px solid ${m.color}40` : '1px solid transparent',
                  transition: 'all 0.2s',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                {!collapsed && <Text style={{ fontSize: 12, color: activeModule === m.key ? m.color : undefined }}>{m.shortName}</Text>}
              </div>
            </Tooltip>
          ))}
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
          <Text strong style={{ fontSize: 14, color: '#1f4e79' }}>
            Project Command Center
          </Text>

          <Space>
            {canWrite && (
              <Tooltip title="Refresh All Data">
                <Button
                  icon={<ReloadOutlined spin={refreshMutation.isPending} />}
                  onClick={() => refreshMutation.mutate()}
                  size="small"
                />
              </Tooltip>
            )}
            <Badge count={unreadCount} size="small">
              <Button icon={<BellOutlined />} size="small" onClick={() => setNotifOpen(true)} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => { if (key === 'settings') navigate('/settings'); } }} trigger={['click']}>
              <Button size="small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Avatar size={20} style={{ backgroundColor: roleBadge.color, fontSize: 10 }}>
                  {(user?.name || 'U')[0].toUpperCase()}
                </Avatar>
                <span style={{ fontSize: 12 }}>{user?.name || 'User'}</span>
              </Button>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '16px', minHeight: 'calc(100vh - 80px)' }}>
          {children}
        </Content>
      </Layout>

      <AIChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />

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
