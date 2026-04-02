import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Skeleton, Alert, Empty,
  Timeline, Badge, Tooltip, Divider, Avatar
} from 'antd';
import {
  ProjectOutlined, CodeOutlined, BugOutlined, RocketOutlined,
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined,
  FileTextOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
  ExperimentOutlined, DashboardOutlined, CloudServerOutlined,
  ArrowRightOutlined, UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDashboardSummary, useWorkItems, useTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS: Record<string, string> = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };
const RAG_ICONS: Record<string, string> = { GREEN: '🟢', AMBER: '🟡', RED: '🔴' };

const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // ── Transport Pipeline stats ──
  const pipeline = useMemo(() => {
    const dev = transports.filter((t: any) => t.currentSystem === 'DEV').length;
    const qas = transports.filter((t: any) => t.currentSystem === 'QAS').length;
    const prd = transports.filter((t: any) => t.currentSystem === 'PRD').length;
    const total = transports.length || 1;
    return { dev, qas, prd, total };
  }, [transports]);

  // ── Test Status summary (aggregated from WorkItem-level test fields) ──
  const testSummary = useMemo(() => {
    const activeWIs = workItems.filter((w: any) => w.status === 'Active');
    let passed = 0, failed = 0, blocked = 0, tbd = 0, skipped = 0, totalCases = 0;
    for (const wi of activeWIs) {
      passed += wi.testPassed || 0;
      failed += wi.testFailed || 0;
      blocked += wi.testBlocked || 0;
      tbd += wi.testTBD || 0;
      skipped += wi.testSkipped || 0;
      totalCases += wi.testTotal || 0;
    }
    const notRun = tbd + blocked;
    const total = totalCases || 1;
    return { passed, failed, notRun, passRate: Math.round((passed / total) * 100) };
  }, [workItems]);

  // ── Upcoming go-lives (within 30 days) ──
  const upcomingGoLives = useMemo(() => {
    return workItems
      .filter((wi: any) => wi.goLiveDate && wi.status === 'Active')
      .map((wi: any) => ({ ...wi, daysLeft: daysFromNow(wi.goLiveDate) }))
      .filter((wi: any) => wi.daysLeft >= 0 && wi.daysLeft <= 30)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [workItems]);

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
      {/* ── Welcome Banner ── */}
      <Card
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          border: 'none',
        }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              <DashboardOutlined /> Project Management Command Center
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, display: 'block' }}>
              Welcome back, <strong>{user?.name || 'User'}</strong>
              {user?.roles && user.roles.length > 0 && (
                <Tag color="gold" style={{ marginLeft: 8 }}>{user.roles[0]}</Tag>
              )}
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Total Transports</span>}
                value={transports.length}
                valueStyle={{ color: '#fff', fontSize: 24 }}
              />
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Active Projects</span>}
                value={activeProjects.length}
                valueStyle={{ color: '#fff', fontSize: 24 }}
              />
              {stuckTRs.length > 0 && (
                <Badge count={stuckTRs.length} overflowCount={99}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Need Attention</span>}
                    value={stuckTRs.length + failedTRs.length}
                    valueStyle={{ color: '#faad14', fontSize: 24 }}
                  />
                </Badge>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Summary Cards ── */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/tracker/Project')} size="small">
            <Statistic
              title="Projects"
              value={summaryLoading ? '-' : (summary?.activeProjects ?? activeProjects.length)}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/tracker/Enhancement')} size="small">
            <Statistic
              title="Enhancements"
              value={workItems.filter((w: any) => w.workItemType === 'Enhancement' && w.status === 'Active').length}
              prefix={<CodeOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card hoverable onClick={() => navigate('/tracker/Break-fix')} size="small">
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

      {/* ── Transport Pipeline + Test Status ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title={<><CloudServerOutlined /> Transport Pipeline</>} size="small">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
              {/* DEV */}
              <Tooltip title="Click to view DEV transports">
              <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }} onClick={() => navigate('/tracker/tr-search?system=DEV')}>
                <div style={{
                  background: '#e6f4ff', borderRadius: 8, padding: '12px 8px',
                  border: '2px solid #91caff', transition: 'all 0.2s',
                }}>
                  <Text strong style={{ fontSize: 24, color: '#1677ff' }}>{pipeline.dev}</Text>
                  <br />
                  <Text type="secondary">DEV</Text>
                </div>
              </div>
              </Tooltip>
              <ArrowRightOutlined style={{ fontSize: 18, color: '#bbb' }} />
              {/* QAS */}
              <Tooltip title="Click to view QAS transports">
              <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }} onClick={() => navigate('/tracker/tr-search?system=QAS')}>
                <div style={{
                  background: '#fff7e6', borderRadius: 8, padding: '12px 8px',
                  border: '2px solid #ffd591', transition: 'all 0.2s',
                }}>
                  <Text strong style={{ fontSize: 24, color: '#fa8c16' }}>{pipeline.qas}</Text>
                  <br />
                  <Text type="secondary">QAS</Text>
                </div>
              </div>
              </Tooltip>
              <ArrowRightOutlined style={{ fontSize: 18, color: '#bbb' }} />
              {/* PRD */}
              <Tooltip title="Click to view PRD transports">
              <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }} onClick={() => navigate('/tracker/tr-search?system=PRD')}>
                <div style={{
                  background: '#f6ffed', borderRadius: 8, padding: '12px 8px',
                  border: '2px solid #b7eb8f', transition: 'all 0.2s',
                }}>
                  <Text strong style={{ fontSize: 24, color: '#52c41a' }}>{pipeline.prd}</Text>
                  <br />
                  <Text type="secondary">PRD</Text>
                </div>
              </div>
              </Tooltip>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Progress
                percent={Math.round((pipeline.prd / pipeline.total) * 100)}
                strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                format={(pct) => `${pct}% deployed`}
                style={{ maxWidth: 400, margin: '0 auto' }}
              />
            </div>
            {failedTRs.length > 0 && (
              <Alert
                type="error"
                showIcon
                message={`${failedTRs.length} transport(s) with failed imports (RC ≥ 8)`}
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<><ExperimentOutlined /> Test Status</>} size="small">
            <Row gutter={16}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Progress
                  type="circle"
                  percent={testSummary.passRate}
                  size={70}
                  strokeColor={testSummary.passRate >= 80 ? '#52c41a' : testSummary.passRate >= 50 ? '#faad14' : '#ff4d4f'}
                />
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>Pass Rate</Text>
              </Col>
              <Col span={16}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text><CheckCircleOutlined style={{ color: '#52c41a' }} /> Passed</Text>
                    <Text strong>{testSummary.passed}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text><WarningOutlined style={{ color: '#ff4d4f' }} /> Failed</Text>
                    <Text strong style={{ color: testSummary.failed > 0 ? '#ff4d4f' : undefined }}>{testSummary.failed}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text><ClockCircleOutlined style={{ color: '#bbb' }} /> Not Run</Text>
                    <Text strong>{testSummary.notRun}</Text>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>
          {/* Upcoming Go-Lives */}
          {upcomingGoLives.length > 0 && (
            <Card title={<><RocketOutlined /> Upcoming Go-Lives</>} size="small" style={{ marginTop: 16 }}>
              <Timeline
                items={upcomingGoLives.slice(0, 5).map((wi: any) => ({
                  color: wi.daysLeft <= 0 ? 'red' : wi.daysLeft <= 7 ? 'orange' : 'blue',
                  children: (
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/workitem/${wi.ID}`)}>
                      <Text strong>{wi.workItemName}</Text>
                      <br />
                      <Text type="secondary">{wi.goLiveDate} — <Tag color="blue">{wi.daysLeft}d left</Tag></Text>
                    </div>
                  ),
                }))}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* ── Active Projects ── */}
      <Card
        title="Active Projects"
        style={{ marginTop: 16 }}
        extra={<a onClick={() => navigate('/tracker/Project')}>View All</a>}
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
              const deployPct = project.deploymentPct || Math.round((prdCount / totalCount) * 100);
              const rag = project.overallRAG || calculateRAG({ goLiveDate: project.goLiveDate, deploymentPct: deployPct, status: project.status, overallRAG: project.overallRAG });
              const projectStuck = projectTRs.filter((t: any) => {
                if (t.currentSystem === 'PRD') return false;
                const days = (Date.now() - new Date(t.createdDate).getTime()) / 86400000;
                return days > 5;
              });
              const projectFailed = projectTRs.filter((t: any) => t.importRC >= 8);

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
