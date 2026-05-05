import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Badge, Space, Typography, Tooltip, Avatar, Dropdown, Tag, message as antMessage
} from 'antd';
import {
  HomeOutlined, DashboardOutlined, ProjectOutlined,
  SettingOutlined, FileTextOutlined,
  BellOutlined, ReloadOutlined, WarningOutlined,
  AppstoreOutlined, RobotOutlined, TeamOutlined,
  ApartmentOutlined,
  FundProjectionScreenOutlined, LogoutOutlined, MenuOutlined
} from '@ant-design/icons';
import { useNotifications, useRefreshTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule, ModuleKey } from '../../contexts/ModuleContext';
import AIChatDrawer from './AIChatDrawer';
import NotificationDrawer from './NotificationDrawer';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const APP_ICONS: Record<ModuleKey, React.ReactNode> = {
  sap: <ApartmentOutlined />,
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notifications = [] } = useNotifications();
  const refreshMutation = useRefreshTransports();
  const { user, canWrite, canConfigure, allowedApps } = useAuth();
  const { activeModule, moduleDef } = useModule();

  const isAdmin = user?.isAdmin ?? false;
  const isExecutive = user?.isExecutive ?? false;
  const canSeeExecutive = isAdmin || isExecutive;

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const roleBadge = user?.isSuperAdmin ? { color: '#f50', text: 'Super Admin' }
    : user?.isAdmin ? { color: '#f50', text: 'Admin' }
    : user?.isManager ? { color: '#2db7f5', text: 'Manager' }
    : user?.isExecutive ? { color: '#87d068', text: 'Executive' }
    : { color: '#108ee9', text: 'Developer' };

  const isSAP = activeModule === 'sap';

  // Build menu items — no more Applications submenu (moved to sidebar header)
  const menuItems: any[] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Dashboard',
    },
    // Executive Dashboard — for Admin/Executive roles
    ...(canSeeExecutive ? [{
      key: '/executive',
      icon: <FundProjectionScreenOutlined />,
      label: 'Executive View',
    }] : []),
    // Transport Pipeline — only for SAP
    ...(isSAP ? [{
      key: '/pipeline',
      icon: <DashboardOutlined />,
      label: moduleDef.terminology.pipeline,
    }] : []),
    {
      key: '/tracker',
      icon: <ProjectOutlined />,
      label: 'Tracker',
    },
    // Unassigned TRs — only for SAP + canWrite
    ...(isSAP && canWrite ? [{
      key: '/unassigned',
      icon: <WarningOutlined />,
      label: 'Unassigned TRs',
    }] : []),
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: 'Reports',
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
    { key: 'email', label: <Text type="secondary" className="user-name">{user?.email}</Text>, disabled: true },
    { type: 'divider' as const },
    { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
    { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, danger: true },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout className="app-layout">
      {/* §1 skip-links: Skip to main content for keyboard users */}
      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={window.innerWidth < 768 ? 0 : 80}
        theme="light"
        width={220}
        className="app-sider"
      >
        {/* Sidebar header — logo */}
        <div className={`sider-header ${collapsed ? 'sider-header-collapsed' : 'sider-header-expanded'}`}>
          <div className="sider-brand mb-0">
            <AppstoreOutlined className="sider-brand-icon" style={{ color: moduleDef.color }} />
            {!collapsed && (
              <Text strong className="sider-brand-text">
                Command Center
              </Text>
            )}
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="sider-menu"
        />
      </Sider>

      <Layout className={collapsed ? 'app-main-collapsed' : 'app-main-expanded'}>
        <Header className="app-header">
          <Space size={8}>
            <Button
              icon={<MenuOutlined />}
              size="small"
              type="text"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Toggle sidebar"
              className="app-header-hamburger"
            />
            <Text strong className="app-header-title">
              Project Command Center
            </Text>
            <Tag color={moduleDef.color} className="app-header-tag">{moduleDef.icon} {moduleDef.shortName}</Tag>
          </Space>

          <Space size={8}>
            {canWrite && (
              <Tooltip title="Refresh All Data">
                <Button
                  icon={<ReloadOutlined spin={refreshMutation.isPending} />}
                  onClick={() => refreshMutation.mutate(undefined, {
                    onSuccess: (res: any) => {
                      if (res?.success === false) {
                        antMessage.error(`Sync failed: ${res.message}`);
                      } else {
                        antMessage.success(res?.message || 'Data refreshed');
                      }
                    },
                    onError: (err: any) => antMessage.error(`Sync error: ${err?.message || 'Unknown error'}`),
                  })}
                  aria-label="Refresh all data"
                  className="header-icon-btn"
                />
              </Tooltip>
            )}
            <Tooltip title="Notifications">
              <Badge count={unreadCount} size="small">
                <Button
                  icon={<BellOutlined />}
                  onClick={() => setNotifOpen(true)}
                  aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                  className="header-icon-btn"
                />
              </Badge>
            </Tooltip>
            <Dropdown menu={{ items: userMenuItems, onClick: ({ key }) => { if (key === 'settings') navigate('/settings'); if (key === 'logout') { window.location.href = '/api/v1/transport/logout'; } } }} trigger={['click']}>
              <Button size="small" className="user-menu-btn">
                <Avatar size={20} className="user-avatar" style={{ backgroundColor: roleBadge.color }}>
                  {(user?.name || 'U')[0].toUpperCase()}
                </Avatar>
                <span className="user-name">{user?.name || 'User'}</span>
              </Button>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-content" id="main-content" role="main">
          {children}
        </Content>
      </Layout>

      <AIChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />

      <Tooltip title="AI Assistant" placement="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined />}
          onClick={() => setChatOpen(true)}
          className="app-fab"
          aria-label="Open AI Assistant"
        />
      </Tooltip>
    </Layout>
  );
};

export default AppShell;
