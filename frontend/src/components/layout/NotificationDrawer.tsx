import React from 'react';
import { Drawer, List, Badge, Button, Typography, Tag, Empty, Space } from 'antd';
import {
  BellOutlined, CheckOutlined, ClockCircleOutlined,
  WarningOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNotifications } from '../../hooks/useData';
import { notificationApi } from '../../services/api';

const { Text } = Typography;

const typeConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  STUCK_TR: { color: 'orange', icon: <ClockCircleOutlined style={{ color: '#faad14' }} /> },
  FAILED_IMPORT: { color: 'red', icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> },
  GOLIVE_APPROACHING: { color: 'blue', icon: <WarningOutlined style={{ color: '#1677ff' }} /> },
};

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ open, onClose }) => {
  const { data: notifications = [], refetch } = useNotifications();
  const unread = notifications.filter((n: any) => !n.isRead);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      refetch();
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    for (const n of unread) {
      try { await notificationApi.markRead(n.ID); } catch { /* ignore */ }
    }
    refetch();
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
        unread.length > 0 && (
          <Button size="small" icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            Mark All Read
          </Button>
        )
      }
    >
      {notifications.length === 0 ? (
        <Empty description="No notifications yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(n: any) => {
            const cfg = typeConfig[n.type] || { color: 'default', icon: <BellOutlined /> };
            return (
              <List.Item
                style={{
                  opacity: n.isRead ? 0.55 : 1,
                  cursor: n.isRead ? 'default' : 'pointer',
                  padding: '10px 0',
                }}
                onClick={() => !n.isRead && handleMarkRead(n.ID)}
              >
                <List.Item.Meta
                  avatar={cfg.icon}
                  title={<Text style={{ fontSize: 13 }}>{n.message}</Text>}
                  description={
                    <Space size={4}>
                      <Tag color={cfg.color} style={{ fontSize: 10 }}>
                        {(n.type || '').replace(/_/g, ' ')}
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
