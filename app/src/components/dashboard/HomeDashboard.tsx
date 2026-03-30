import React from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Skeleton, Alert, Empty
} from 'antd';
import {
  ProjectOutlined, CodeOutlined, BugOutlined, RocketOutlined,
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDashboardSummary, useWorkItems, useTransports } from '../../hooks/useData';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };
const RAG_ICONS = { GREEN: '🟢', AMBER: '🟡', RED: '🔴' };

const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useDashboardSummary();
  const { data: workItems = [], isLoading: wiLoading } = useWorkItems();
  const { data: transports = [], isLoading: trLoading } = useTransports();

  const activeProjects = workItems.filter((wi: any) => wi.status === 'Active');
  const unassigned = transports.filter((tr: any) => !tr.workType);
  const stuckTRs = transports.filter((tr: any) => {
    if (tr.currentSystem === 'PRD') return false;
    const days = (Date.now() - new Date(tr.createdDate).getTime()) / 86400000;
    return days > 5;
  });
  const failedTRs = transports.filter((tr: any) => tr.importRC >= 8);

  // Pending items: stuck + unassigned + failed
  const pendingItems = [
    ...failedTRs.map((tr: any) => ({
      icon: '❌', text: `${tr.trNumber} — failed import (RC=${tr.importRC}) in ${tr.currentSystem}`, type: 'error'
    })),
    ...stuckTRs.slice(0, 5).map((tr: any) => ({
      icon: '⏳', text: `${tr.trNumber} — stuck in ${tr.currentSystem} > 5 days (${tr.ownerFullName || tr.trOwner})`, type: 'warning'
    })),
    ...unassigned.slice(0, 5).map((tr: any) => ({
      icon: '📋', text: `${tr.trNumber} — unassigned (${tr.trDescription?.substring(0, 50) || 'no description'})`, type: 'info'
    })),
  ];

  // Completed this week
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const completedItems = workItems.filter((wi: any) => wi.status === 'Done');
  const completedPrd = transports.filter((tr: any) => tr.currentSystem === 'PRD' && tr.importRC === 0);

  if (summaryError) {
    return <Alert message="Failed to load dashboard" description={String(summaryError)} type="error" showIcon />;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>
        <RocketOutlined /> Project Management Command Center
      </Title>

      {/* ── Summary Cards ── */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/workitems/Project')} size="small">
            <Statistic
              title="Projects"
              value={summaryLoading ? '-' : (summary?.activeProjects ?? activeProjects.length)}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/workitems/Enhancement')} size="small">
            <Statistic
              title="Enhancements"
              value={workItems.filter((w: any) => w.workItemType === 'Enhancement' && w.status === 'Active').length}
              prefix={<CodeOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/workitems/Break-fix')} size="small">
            <Statistic
              title="Break-Fixes"
              value={transports.filter((t: any) => t.workType === 'BRK').length}
              prefix={<BugOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/unassigned')} size="small">
            <Statistic
              title="Unassigned"
              value={summaryLoading ? '-' : (summary?.unassignedCount ?? unassigned.length)}
              prefix={<WarningOutlined />}
              valueStyle={{ color: unassigned.length > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable size="small">
            <Statistic
              title="Pending Items"
              value={pendingItems.length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: pendingItems.length > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/report')} size="small">
            <Statistic
              title="Weekly Report"
              value="Draft"
              prefix={<FileTextOutlined />}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Active Projects ── */}
      <Card
        title="Active Projects"
        style={{ marginTop: 16 }}
        extra={<a onClick={() => navigate('/workitems/Project')}>View All</a>}
      >
        {wiLoading ? (
          <Skeleton active />
        ) : activeProjects.length === 0 ? (
          <Empty description="No active projects. Sync SharePoint data to get started." />
        ) : (
          <List
            dataSource={activeProjects}
            renderItem={(project: any) => {
              const projectTRs = transports.filter((t: any) => t.workItem_ID === project.ID);
              const prdCount = projectTRs.filter((t: any) => t.currentSystem === 'PRD').length;
              const totalCount = projectTRs.length || project.estimatedTRCount || 1;
              const deployPct = Math.round((prdCount / totalCount) * 100);
              const projectStuck = projectTRs.filter((t: any) => {
                if (t.currentSystem === 'PRD') return false;
                return (Date.now() - new Date(t.createdDate).getTime()) / 86400000 > 5;
              });
              const projectFailed = projectTRs.filter((t: any) => t.importRC >= 8);
              const rag = calculateRAG({ goLiveDate: project.goLiveDate, totalTransports: totalCount, transportsProd: prdCount, stuckTransports: projectStuck.length, failedImports: projectFailed.length });

              return (
                <List.Item
                  style={{ cursor: 'pointer', padding: '12px 0' }}
                  onClick={() => navigate(`/workitem/${project.ID}`)}
                >
                  <List.Item.Meta
                    avatar={<span style={{ fontSize: 20 }}>{RAG_ICONS[rag]}</span>}
                    title={
                      <Space>
                        <Text strong>{project.workItemName}</Text>
                        {project.goLiveDate && (
                          <Tag color="blue">🚀 Go-Live: {project.goLiveDate} ({daysFromNow(project.goLiveDate)})</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Text type="secondary">
                          Owner: {project.businessOwner || 'N/A'} │ Dev: {project.leadDeveloper || 'N/A'}
                          {project.veevaCCNumber && ` │ Veeva: ${project.veevaCCNumber}`}
                        </Text>
                        <Space>
                          <Progress
                            percent={deployPct}
                            size="small"
                            style={{ width: 200 }}
                            strokeColor={RAG_COLORS[rag]}
                          />
                          <Text type="secondary">{prdCount}/{totalCount} TRs in PRD</Text>
                          {projectStuck.length > 0 && (
                            <Tag color="warning">⚠ {projectStuck.length} stuck</Tag>
                          )}
                          {projectFailed.length > 0 && (
                            <Tag color="error">❌ {projectFailed.length} failed</Tag>
                          )}
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* ── Pending Items ── */}
      {pendingItems.length > 0 && (
        <Card title={`Pending Items (${pendingItems.length})`} style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={pendingItems}
            renderItem={(item: any) => (
              <List.Item>
                <Text>{item.icon} {item.text}</Text>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* ── Completed This Week ── */}
      {completedPrd.length > 0 && (
        <Card title="Recently Deployed to PRD" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={completedPrd.slice(0, 5)}
            renderItem={(tr: any) => (
              <List.Item>
                <Text>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />{' '}
                  {tr.trNumber} — {tr.trDescription?.substring(0, 80)} (RC={tr.importRC})
                </Text>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default HomeDashboard;
