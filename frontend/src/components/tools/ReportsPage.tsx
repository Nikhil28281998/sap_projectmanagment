import React, { useState } from 'react';
import { Tabs, Typography, Space } from 'antd';
import { FileTextOutlined, RobotOutlined, CalendarOutlined } from '@ant-design/icons';
import ReportBuilder from './ReportBuilder';
import WeeklyDigestPage from './WeeklyDigestPage';

const { Title, Text } = Typography;

/**
 * Unified Reports Page — combines "Weekly Report Builder" and "AI Weekly Digest"
 * into a single page with tabs, eliminating the duplicate sidebar entries.
 */
const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('builder');

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Reports
        </Title>
        <Text type="secondary">
          Build weekly status reports or generate AI-powered executive digests.
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: 'builder',
            label: (
              <Space>
                <FileTextOutlined />
                Report Builder
              </Space>
            ),
            children: <ReportBuilder embedded />,
          },
          {
            key: 'digest',
            label: (
              <Space>
                <RobotOutlined />
                AI Weekly Digest
              </Space>
            ),
            children: <WeeklyDigestPage embedded />,
          },
        ]}
      />
    </div>
  );
};

export default ReportsPage;
