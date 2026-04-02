import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Badge, Space, Typography, Tooltip, Avatar, Dropdown, Tag
} from 'antd';
import {
  HomeOutlined, DashboardOutlined, ProjectOutlined,
  SettingOutlined, FileTextOutlined,
  BellOutlined, ReloadOutlined, WarningOutlined,
  AppstoreOutlined, RobotOutlined, TeamOutlined,
  ShoppingCartOutlined, MedicineBoxOutlined, ApartmentOutlined,
  FundProjectionScreenOutlined, CalendarOutlined
} from '@ant-design/icons';
import { useNotifications, useRefreshTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule, MODULE_DEFINITIONS, ModuleKey } from '../../contexts/ModuleContext';
import AIChatDrawer from './AIChatDrawer';
import NotificationDrawer from './NotificationDrawer';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AppShellProps {
  children: React.ReactNode;
}

const APP_ICONS: Record<ModuleKey, React.ReactNode> = {
  sap: <ApartmentOutlined />,
  coupa: <ShoppingCartOutlined />,
  commercial: <MedicineBoxOutlined />,
};

const AppShell: React.FC<AppShellProps> = ({ children }) => {
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

  // Build available app sub-items based on user's allowedApps
  const appSubItems = useMemo(() => {
    const appKeys: ModuleKey[] = ['sap', 'coupa', 'commercial'];
    return appKeys
      .filter((k) => allowedApps.includes(k.charAt(0).toUpperCase() + k.slice(1)) || allowedApps.includes(k.toUpperCase()) || allowedApps.includes(MODULE_DEFINITIONS[k].shortName))
      .map((k) => ({
        key: `app-${k}`,
        icon: APP_ICONS[k],
        label: (
          <span>
            {MODULE_DEFINITIONS[k].name}
            {activeModule === k && <Tag color={MODULE_DEFINITIONS[k].color} style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>Active</Tag>}
          </span>
        ),
      }));
  }, [allowedApps, activeModule]);

  // Dynamic menu: show/hide items based on active application
  const isSAP = activeModule === 'sap';

  const menuItems: any[] = [
    // ── Applications submenu ──
    {
      key: 'applications',
      icon: <AppstoreOutlined />,
      label: 'Applications',
      children: appSubItems.length > 0 ? appSubItems : [
        { key: 'app-sap', icon: APP_ICONS.sap, label: 'SAP PM' },
      ],
    },
    { type: 'divider' as const },
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Home Dashboard',
    },
    // Executive Dashboard — for Admin/Executive roles
    ...(canSeeExecutive ? [{
      key: '/executive',
      icon: <FundProjectionScreenOutlined />,
      label: 'Executive Dashboard',
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
      key: '/report',
      icon: <FileTextOutlined />,
      label: 'Weekly Report',
    },
    {
      key: '/digest',
      icon: <CalendarOutlined />,
      label: 'AI Weekly Digest',
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

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'ai-agent') {
      setChatOpen(true);
    } else if (key.startsWith('app-')) {
      const appKey = key.replace('app-', '') as ModuleKey;
      setActiveModule(appKey);
      navigate('/');
    } else if (key === 'applications') {
      // parent submenu click, do nothing
    } else {
      navigate(key);
    }
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
          <AppstoreOutlined style={{ fontSize: 24, color: moduleDef.color }} />
          {!collapsed && (
            <Text strong style={{ marginLeft: 8, fontSize: 14 }}>
              Command Center
            </Text>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname, `app-${activeModule}`]}
          defaultOpenKeys={['applications']}
          items={menuItems}
          onClick={handleMenuClick}
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
          <Space size={8}>
            <Text strong style={{ fontSize: 14, color: '#1f4e79' }}>
              Project Command Center
            </Text>
            <Tag color={moduleDef.color} style={{ fontSize: 11 }}>{moduleDef.icon} {moduleDef.shortName}</Tag>
          </Space>

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
