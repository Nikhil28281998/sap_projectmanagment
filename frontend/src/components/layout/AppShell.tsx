import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Badge, Space, Typography, Tooltip, Avatar, Dropdown, Tag, Select
} from 'antd';
import {
  HomeOutlined, DashboardOutlined, ProjectOutlined,
  SettingOutlined, FileTextOutlined,
  BellOutlined, ReloadOutlined, WarningOutlined,
  AppstoreOutlined, RobotOutlined, TeamOutlined,
  ShoppingCartOutlined, MedicineBoxOutlined, ApartmentOutlined,
  FundProjectionScreenOutlined, LogoutOutlined, SwapOutlined
} from '@ant-design/icons';
import { useNotifications, useRefreshTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule, MODULE_DEFINITIONS, ModuleKey } from '../../contexts/ModuleContext';
import AIChatDrawer from './AIChatDrawer';
import NotificationDrawer from './NotificationDrawer';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const APP_ICONS: Record<ModuleKey, React.ReactNode> = {
  sap: <ApartmentOutlined />,
  coupa: <ShoppingCartOutlined />,
  commercial: <MedicineBoxOutlined />,
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
  const { activeModule, setActiveModule, moduleDef } = useModule();

  const isAdmin = user?.isAdmin ?? false;
  const isExecutive = user?.isExecutive ?? false;
  const canSeeExecutive = isAdmin || isExecutive;

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const roleBadge = user?.isSuperAdmin ? { color: '#f50', text: 'Super Admin' }
    : user?.isAdmin ? { color: '#f50', text: 'Admin' }
    : user?.isManager ? { color: '#2db7f5', text: 'Manager' }
    : user?.isExecutive ? { color: '#87d068', text: 'Executive' }
    : { color: '#108ee9', text: 'Developer' };

  // Determine which apps the user can access
  const availableApps = useMemo(() => {
    const appKeys: ModuleKey[] = ['sap', 'coupa', 'commercial'];
    return appKeys.filter((k) =>
      allowedApps.includes(k.charAt(0).toUpperCase() + k.slice(1)) ||
      allowedApps.includes(k.toUpperCase()) ||
      allowedApps.includes(MODULE_DEFINITIONS[k].shortName)
    );
  }, [allowedApps]);

  const hasMultipleApps = availableApps.length > 1;
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

  const handleAppSwitch = (appKey: ModuleKey) => {
    setActiveModule(appKey);
    // Stay on current page — just switch context (data re-filters automatically)
  };

  return (
    <Layout className="app-layout">
      {/* §1 skip-links: Skip to main content for keyboard users */}
      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={220}
        className="app-sider"
      >
        {/* Sidebar header — logo + app switcher */}
        <div className={`sider-header ${collapsed ? 'sider-header-collapsed' : 'sider-header-expanded'}`}>
          <div className={`sider-brand ${hasMultipleApps && !collapsed ? 'mb-8' : 'mb-0'}`}>
            <AppstoreOutlined className="sider-brand-icon" style={{ color: moduleDef.color }} />
            {!collapsed && (
              <Text strong className="sider-brand-text">
                Command Center
              </Text>
            )}
          </div>
          {/* App switcher — only show for multi-app users */}
          {hasMultipleApps && !collapsed && (
            <Select
              value={activeModule}
              onChange={handleAppSwitch}
              className="w-full"
              size="small"
              suffixIcon={<SwapOutlined />}
              options={availableApps.map((k) => ({
                value: k,
                label: (
                  <Space size={4}>
                    {APP_ICONS[k]}
                    <span className="module-tag-sm">{MODULE_DEFINITIONS[k].shortName}</span>
                  </Space>
                ),
              }))}
            />
          )}
          {hasMultipleApps && collapsed && (
            <Tooltip title={`Switch app (current: ${moduleDef.shortName})`} placement="right">
              <Button
                size="small"
                type="text"
                icon={<SwapOutlined />}
                className="sider-cycle-btn"
                onClick={() => {
                  // Cycle through apps
                  const idx = availableApps.indexOf(activeModule);
                  const next = availableApps[(idx + 1) % availableApps.length];
                  handleAppSwitch(next);
                }}
              />
            </Tooltip>
          )}
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
                  onClick={() => refreshMutation.mutate()}
                  size="small"
                />
              </Tooltip>
            )}
            <Badge count={unreadCount} size="small">
              <Button icon={<BellOutlined />} size="small" onClick={() => setNotifOpen(true)} />
            </Badge>
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
