import React, { useState } from 'react';
import { Drawer, List, Badge, Button, Typography, Tag, Empty, Space, Tooltip, Select, message as antMessage } from 'antd';
import {
  BellOutlined, CheckOutlined, ClockCircleOutlined,
  WarningOutlined, ExclamationCircleOutlined,
  RobotOutlined, ThunderboltOutlined, AlertOutlined,
  SafetyCertificateOutlined, ApartmentOutlined, BugOutlined,
} from '@ant-design/icons';
import { useNotifications } from '../../hooks/useData';
import { notificationApi } from '../../services/api';
import { useModule } from '../../contexts/ModuleContext';

const { Text } = Typography;

const typeConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  STUCK_TR: { color: 'orange', icon: <ClockCircleOutlined style={{ color: '#faad14' }} />, label: 'Stuck TR' },
  FAILED_IMPORT: { color: 'red', icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />, label: 'Failed Import' },
  GOLIVE_APPROACHING: { color: 'blue', icon: <WarningOutlined style={{ color: '#1677ff' }} />, label: 'Go-Live' },
  TEST_FAILURES: { color: 'volcano', icon: <BugOutlined style={{ color: '#fa541c' }} />, label: 'Test Failures' },
  // AI Risk Notification types
  AI_RISK_SCHEDULE_RISK: { color: 'red', icon: <AlertOutlined style={{ color: '#ff4d4f' }} />, label: '🤖 Schedule Risk' },
  AI_RISK_QUALITY_RISK: { color: 'orange', icon: <BugOutlined style={{ color: '#fa8c16' }} />, label: '🤖 Quality Risk' },
  AI_RISK_RESOURCE_RISK: { color: 'purple', icon: <ApartmentOutlined style={{ color: '#722ed1' }} />, label: '🤖 Resource Risk' },
  AI_RISK_DEPLOYMENT_RISK: { color: 'red', icon: <ThunderboltOutlined style={{ color: '#ff4d4f' }} />, label: '🤖 Deploy Risk' },
  AI_RISK_INTEGRATION_RISK: { color: 'cyan', icon: <ApartmentOutlined style={{ color: '#13c2c2' }} />, label: '🤖 Integration Risk' },
  AI_RISK_COMPLIANCE_RISK: { color: 'magenta', icon: <SafetyCertificateOutlined style={{ color: '#eb2f96' }} />, label: '🤖 Compliance Risk' },
};

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ open, onClose }) => {
  const { data: notifications = [], refetch } = useNotifications();
  const { activeModule } = useModule();
  const [riskLoading, setRiskLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const unread = notifications.filter((n: any) => !n.isRead);
  const aiRiskNotifs = notifications.filter((n: any) => (n.type || '').startsWith('AI_RISK_'));

  const filtered = filterType === 'all'
    ? notifications
    : filterType === 'ai_risk'
      ? notifications.filter((n: any) => (n.type || '').startsWith('AI_RISK_'))
      : notifications.filter((n: any) => n.type === filterType);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      refetch();
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    await Promise.all(unread.map((n: any) => notificationApi.markRead(n.ID).catch(() => {})));
    refetch();
  };

  const handleRunRiskAnalysis = async () => {
    setRiskLoading(true);
    try {
      const appMap: Record<string, string> = { sap: 'SAP', coupa: 'Coupa', commercial: 'Commercial' };
      const result = await notificationApi.analyzeRisks(appMap[activeModule] || 'ALL');
      if (result.success) {
        antMessage.success(result.message);
        refetch();
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Risk analysis failed: ${err.message}`);
    } finally {
      setRiskLoading(false);
    }
  };

  return (
    <Drawer
      title={
        <Space>
          <BellOutlined /> Notifications
          {unread.length > 0 && <Badge count={unread.length} />}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={400}
      extra={
        <Space size={4}>
          {unread.length > 0 && (
            <Button size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
              Mark All Read
            </Button>
          )}
        </Space>
      }
    >
      {/* AI Risk Analysis Controls */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title="Run AI-powered predictive risk analysis on active projects">
          <Button
            type="primary"
            size="small"
            icon={<RobotOutlined />}
            onClick={handleRunRiskAnalysis}
            loading={riskLoading}
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
          >
            AI Risk Scan
          </Button>
        </Tooltip>
        <Select
          value={filterType}
          onChange={setFilterType}
          size="small"
          style={{ width: 140 }}
          options={[
            { value: 'all', label: `All (${notifications.length})` },
            { value: 'ai_risk', label: `🤖 AI Risks (${aiRiskNotifs.length})` },
            { value: 'STUCK_TR', label: 'Stuck TRs' },
            { value: 'FAILED_IMPORT', label: 'Failed Imports' },
            { value: 'GOLIVE_APPROACHING', label: 'Go-Live' },
            { value: 'TEST_FAILURES', label: 'Test Failures' },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <Empty description="No notifications yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={filtered}
          renderItem={(n: any) => {
            const cfg = typeConfig[n.type] || { color: 'default', icon: <BellOutlined />, label: (n.type || '').replace(/_/g, ' ') };
            const isAIRisk = (n.type || '').startsWith('AI_RISK_');
            return (
              <List.Item
                style={{
                  opacity: n.isRead ? 0.55 : 1,
                  cursor: n.isRead ? 'default' : 'pointer',
                  padding: '10px 0',
                  borderLeft: isAIRisk ? '3px solid #722ed1' : 'none',
                  paddingLeft: isAIRisk ? 8 : 0,
                }}
                onClick={() => !n.isRead && handleMarkRead(n.ID)}
              >
                <List.Item.Meta
                  avatar={cfg.icon}
                  title={<Text style={{ fontSize: 13 }}>{n.message}</Text>}
                  description={
                    <Space size={4}>
                      <Tag color={cfg.color} style={{ fontSize: 10 }}>
                        {cfg.label}
                      </Tag>
                      {n.trNumber && (
                        <Text type="secondary" style={{ fontSize: 11 }}>{n.trNumber}</Text>
                      )}
                      {!n.isRead && <Tag color="blue" style={{ fontSize: 10 }}>New</Tag>}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Drawer>
  );
};

export default NotificationDrawer;
