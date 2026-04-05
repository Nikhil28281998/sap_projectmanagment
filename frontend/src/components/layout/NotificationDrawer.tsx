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
  STUCK_TR: { color: 'orange', icon: <ClockCircleOutlined className="icon-stuck" />, label: 'Stuck TR' },
  FAILED_IMPORT: { color: 'red', icon: <ExclamationCircleOutlined className="icon-failed" />, label: 'Failed Import' },
  GOLIVE_APPROACHING: { color: 'blue', icon: <WarningOutlined className="icon-golive" />, label: 'Go-Live' },
  TEST_FAILURES: { color: 'volcano', icon: <BugOutlined className="icon-test" />, label: 'Test Failures' },
  // AI Risk Notification types
  AI_RISK_SCHEDULE_RISK: { color: 'red', icon: <AlertOutlined className="icon-risk-schedule" />, label: '🤖 Schedule Risk' },
  AI_RISK_QUALITY_RISK: { color: 'orange', icon: <BugOutlined className="icon-risk-quality" />, label: '🤖 Quality Risk' },
  AI_RISK_RESOURCE_RISK: { color: 'purple', icon: <ApartmentOutlined className="icon-risk-resource" />, label: '🤖 Resource Risk' },
  AI_RISK_DEPLOYMENT_RISK: { color: 'red', icon: <ThunderboltOutlined className="icon-risk-deploy" />, label: '🤖 Deploy Risk' },
  AI_RISK_INTEGRATION_RISK: { color: 'cyan', icon: <ApartmentOutlined className="icon-risk-integration" />, label: '🤖 Integration Risk' },
  AI_RISK_COMPLIANCE_RISK: { color: 'magenta', icon: <SafetyCertificateOutlined className="icon-risk-compliance" />, label: '🤖 Compliance Risk' },
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
      <div className="notif-controls">
        <Tooltip title="Run AI-powered predictive risk analysis on active projects">
          <Button
            type="primary"
            size="small"
            icon={<RobotOutlined />}
            onClick={handleRunRiskAnalysis}
            loading={riskLoading}
            className="notif-risk-btn"
          >
            AI Risk Scan
          </Button>
        </Tooltip>
        <Select
          value={filterType}
          onChange={setFilterType}
          size="small"
          className="notif-filter-select"
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
                className={`notif-item ${n.isRead ? 'notif-item-read' : 'notif-item-unread'} ${isAIRisk ? 'notif-item-ai-risk' : ''}`}
                onClick={() => !n.isRead && handleMarkRead(n.ID)}
              >
                <List.Item.Meta
                  avatar={cfg.icon}
                  title={<Text className="notif-message">{n.message}</Text>}
                  description={
                    <Space size={4}>
                      <Tag color={cfg.color} className="notif-tag">
                        {cfg.label}
                      </Tag>
                      {n.trNumber && (
                        <Text type="secondary" className="notif-tr-ref">{n.trNumber}</Text>
                      )}
                      {!n.isRead && <Tag color="blue" className="notif-tag">New</Tag>}
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
