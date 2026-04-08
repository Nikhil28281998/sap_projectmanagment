import React, { useState } from 'react';
import { Tabs, Typography, Space, Alert } from 'antd';
import { FileTextOutlined, RobotOutlined, CalendarOutlined } from '@ant-design/icons';
import ReportBuilder from './ReportBuilder';
import WeeklyDigestPage from './WeeklyDigestPage';
import ErrorBoundary from '../layout/ErrorBoundary';

const { Title, Text } = Typography;

/**
 * Unified Reports Page — combines "Weekly Report Builder" and "AI Weekly Digest"
 * into a single page with tabs, eliminating the duplicate sidebar entries.
 */
const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('builder');

  return (
    <div>
      <div className="reports-header">
        <Title level={3} className="reports-title">
          <FileTextOutlined className="reports-icon" />
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
            children: <ErrorBoundary><ReportBuilder embedded /></ErrorBoundary>,
          },
          {
            key: 'digest',
            label: (
              <Space>
                <RobotOutlined />
                AI Weekly Digest
              </Space>
            ),
            children: <ErrorBoundary><WeeklyDigestPage embedded /></ErrorBoundary>,
          },
        ]}
      />
    </div>
  );
};

export default ReportsPage;
