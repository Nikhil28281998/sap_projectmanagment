import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Empty,
  Timeline, Tooltip, Table
} from 'antd';
import {
  ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined,
  WarningOutlined, RocketOutlined, DashboardOutlined, FundOutlined,
  ExclamationCircleOutlined, TeamOutlined,
  ApartmentOutlined, ShoppingCartOutlined, MedicineBoxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule, MODULE_DEFINITIONS, ModuleKey } from '../../contexts/ModuleContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS: Record<string, string> = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };
const RAG_LABELS: Record<string, string> = { GREEN: 'On Track', AMBER: 'At Risk', RED: 'Critical' };
const APP_COLORS: Record<string, string> = { SAP: '#1677ff', Coupa: '#0070d2', Commercial: '#722ed1' };
const APP_ICONS: Record<string, React.ReactNode> = {
  SAP: <ApartmentOutlined />,
  Coupa: <ShoppingCartOutlined />,
  Commercial: <MedicineBoxOutlined />,
};

function getRAG(wi: any): string {
  return wi.overallRAG || calculateRAG({
    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
    status: wi.status, overallRAG: wi.overallRAG,
  });
}

const ExecutiveDashboardClassic: React.FC = () => {
  const navigate = useNavigate();
  const { user, allowedApps } = useAuth();
  const { allModules } = useModule();
  const { data: allWorkItems = [], isLoading } = useWorkItems();

  // Filter by allowed applications for this user
  const workItems = allWorkItems.filter((wi: any) =>
    !wi.application || allowedApps.includes(wi.application)
  );
  const activeProjects = workItems.filter((wi: any) => wi.status === 'Active');

  // GöÇGöÇ Per-Application Breakdown GöÇGöÇ
  const appBreakdown = useMemo(() => {
    const apps = ['SAP', 'Coupa', 'Commercial'].filter(a => allowedApps.includes(a));
    return apps.map(app => {
      const appItems = workItems.filter((wi: any) => wi.application === app);
      const active = appItems.filter((wi: any) => wi.status === 'Active');
      const completed = appItems.filter((wi: any) => wi.status === 'Complete' || wi.status === 'Done' || wi.status === 'Completed');
      const rag = { GREEN: 0, AMBER: 0, RED: 0 };
      for (const wi of active) {
        const r = getRAG(wi);
        if (r in rag) rag[r as keyof typeof rag]++;
        else rag.GREEN++;
      }
      const avgPct = active.length > 0
        ? Math.round(active.reduce((s: number, wi: any) => s + (wi.deploymentPct || 0), 0) / active.length)
        : 0;
      return { app, total: appItems.length, active: active.length, completed: completed.length, rag, avgPct };
    });
  }, [workItems, allowedApps]);

  // RAG distribution (global)
  const ragSummary = useMemo(() => {
    const dist = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const wi of activeProjects) {
      const rag = getRAG(wi);
      if (rag in dist) dist[rag as keyof typeof dist]++;
      else dist.GREEN++;
    }
    return dist;
  }, [activeProjects]);

  // Critical upcoming go-lives
  const upcomingGoLives = useMemo(() => {
    return workItems
      .filter((wi: any) => wi.goLiveDate && wi.status === 'Active')
      .map((wi: any) => ({ ...wi, daysLeft: daysFromNow(wi.goLiveDate) }))
      .filter((wi: any) => wi.daysLeft >= -7 && wi.daysLeft <= 60)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [workItems]);

  // At-risk projects
  const atRiskProjects = useMemo(() => {
    return activeProjects.filter((wi: any) => {
      const rag = getRAG(wi);
      return rag === 'RED' || rag === 'AMBER';
    }).map((wi: any) => ({
      ...wi,
      rag: getRAG(wi),
    }));
  }, [activeProjects]);

  // Completed projects
  const completedCount = workItems.filter((wi: any) => wi.status === 'Complete' || wi.status === 'Completed' || wi.status === 'Done').length;

  // Average completion rate
  const avgDeployment = useMemo(() => {
    if (activeProjects.length === 0) return 0;
    const total = activeProjects.reduce((sum: number, wi: any) => sum + (wi.deploymentPct || 0), 0);
    return Math.round(total / activeProjects.length);
  }, [activeProjects]);

  // Test summary
  const testSummary = useMemo(() => {
    let passed = 0, total = 0;
    for (const wi of activeProjects) {
      passed += wi.testPassed || 0;
      total += wi.testTotal || 0;
    }
    return { passed, total, rate: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }, [activeProjects]);

  const projectTableCols = [
    {
      title: 'Application', dataIndex: 'application', key: 'app', width: 120,
      filters: appBreakdown.map(a => ({ text: a.app, value: a.app })),
      onFilter: (v: any, r: any) => r.application === v,
      render: (app: string) => (
        <Tag color={APP_COLORS[app] || 'default'} icon={APP_ICONS[app]}>
          {app}
        </Tag>
      ),
    },
    {
      title: 'Project', dataIndex: 'workItemName', key: 'name', ellipsis: true,
      render: (t: string, r: any) => (
        <a onClick={() => navigate(`/workitem/${r.ID}`)}>{t}</a>
      ),
    },
    {
      title: 'Type', dataIndex: 'workItemType', key: 'type', width: 120,
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: 'Phase', dataIndex: 'currentPhase', key: 'phase', width: 120,
      render: (t: string) => <Tag color="processing">{t || 'Planning'}</Tag>,
    },
    {
      title: 'Health', key: 'rag', width: 80, align: 'center' as const,
      filters: [
        { text: 'On Track', value: 'GREEN' },
        { text: 'At Risk', value: 'AMBER' },
        { text: 'Critical', value: 'RED' },
      ],
      onFilter: (v: any, r: any) => getRAG(r) === v,
      render: (_: any, r: any) => {
        const rag = getRAG(r);
        return (
          <Tooltip title={RAG_LABELS[rag]}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', margin: '0 auto',
              background: RAG_COLORS[rag] || '#d9d9d9',
            }} />
          </Tooltip>
        );
      },
    },
    {
      title: 'Go-Live', dataIndex: 'goLiveDate', key: 'gl', width: 120,
      render: (d: string) => d ? (
        <Space size={4}>
          <Text style={{ fontSize: 12 }}>{d}</Text>
          <Tag color={daysFromNow(d) <= 14 ? 'red' : 'blue'} style={{ fontSize: 10 }}>
            {daysFromNow(d)}d
          </Tag>
        </Space>
      ) : 'GÇö',
    },
    {
      title: 'Progress', key: 'progress', width: 130,
      render: (_: any, r: any) => (
        <Progress percent={r.deploymentPct || 0} size="small" strokeColor={
          RAG_COLORS[getRAG(r)]
        } />
      ),
    },
    {
      title: 'Owner', dataIndex: 'businessOwner', key: 'owner', width: 120, ellipsis: true,
      render: (t: string) => t || 'GÇö',
    },
  ];

  return (
    <div>
      {/* Banner */}
      <Card
        style={{ marginBottom: 16, background: 'linear-gradient(135deg, #141414 0%, #1f1f1f 50%, #262626 100%)', border: 'none' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              <FundOutlined /> Executive Dashboard
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, display: 'block' }}>
              Welcome, <strong>{user?.name || 'Executive'}</strong> GÇö Cross-application portfolio health
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <div style={{ textAlign: 'center', padding: '4px 16px', cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all')}>
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                  {activeProjects.length}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Active Projects</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px 16px', cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all&status=completed')}>
                <div style={{ color: '#52c41a', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                  {completedCount}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Completed</div>
              </div>
              {atRiskProjects.length > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 16px', cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all&rag=risk')}>
                  <div style={{ color: '#faad14', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                    {atRiskProjects.length}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>At Risk</div>
                </div>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* GöÇGöÇ Per-Application Breakdown Cards GöÇGöÇ */}
      <Row gutter={[12, 12]}>
        {appBreakdown.map(({ app, total, active, completed, rag, avgPct }) => (
          <Col xs={24} md={8} key={app}>
            <Card
              size="small"
              hoverable
              style={{ borderTop: `3px solid ${APP_COLORS[app]}`, cursor: 'pointer' }}
              onClick={() => navigate(`/tracker?app=${app.toLowerCase()}`)}
              title={
                <Space>
                  {APP_ICONS[app]}
                  <Text strong>{app}</Text>
                  <Tag color={APP_COLORS[app]} style={{ fontSize: 10 }}>{total} total</Tag>
                </Space>
              }
            >
              <Row gutter={8}>
                <Col span={8}>
                  <Statistic title={<Text type="secondary" style={{ fontSize: 10 }}>Active</Text>} value={active} valueStyle={{ fontSize: 20 }} />
                </Col>
                <Col span={8}>
                  <Statistic title={<Text type="secondary" style={{ fontSize: 10 }}>Done</Text>} value={completed} valueStyle={{ fontSize: 20, color: '#52c41a' }} />
                </Col>
                <Col span={8}>
                  <Statistic title={<Text type="secondary" style={{ fontSize: 10 }}>Progress</Text>} value={avgPct} suffix="%" valueStyle={{ fontSize: 20 }} />
                </Col>
              </Row>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
                {rag.GREEN > 0 && (
                  <Tooltip title={`On Track: ${rag.GREEN}`}>
                    <div style={{ width: `${(rag.GREEN / (active || 1)) * 100}%`, background: '#52c41a' }} />
                  </Tooltip>
                )}
                {rag.AMBER > 0 && (
                  <Tooltip title={`At Risk: ${rag.AMBER}`}>
                    <div style={{ width: `${(rag.AMBER / (active || 1)) * 100}%`, background: '#faad14' }} />
                  </Tooltip>
                )}
                {rag.RED > 0 && (
                  <Tooltip title={`Critical: ${rag.RED}`}>
                    <div style={{ width: `${(rag.RED / (active || 1)) * 100}%`, background: '#ff4d4f' }} />
                  </Tooltip>
                )}
                {active === 0 && <div style={{ width: '100%', background: '#f0f0f0' }} />}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Global Health Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={8} lg={4}>
          <Card size="small" hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all&rag=GREEN')}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>On Track</Text>}
              value={ragSummary.GREEN}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small" hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all&rag=AMBER')}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>At Risk</Text>}
              value={ragSummary.AMBER}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small" hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all&rag=RED')}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Critical</Text>}
              value={ragSummary.RED}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small" hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all')}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Avg Progress</Text>}
              value={avgDeployment}
              suffix="%"
              prefix={<DashboardOutlined />}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small" hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all')}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Test Pass Rate</Text>}
              value={testSummary.rate}
              suffix="%"
              valueStyle={{ color: testSummary.rate >= 80 ? '#52c41a' : testSummary.rate >= 50 ? '#faad14' : '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small" hoverable style={{ cursor: 'pointer' }} onClick={() => navigate('/tracker?app=all')}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Applications</Text>}
              value={appBreakdown.length}
              prefix={<TeamOutlined />}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* RAG Health Bar */}
      {activeProjects.length > 0 && (
        <Card size="small" style={{ marginTop: 16 }} title={<Space><DashboardOutlined /> Portfolio Health Distribution</Space>}>
          <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            {ragSummary.GREEN > 0 && (
              <Tooltip title={`On Track: ${ragSummary.GREEN}`}>
                <div style={{ width: `${(ragSummary.GREEN / activeProjects.length) * 100}%`, background: '#52c41a', transition: 'width 0.3s' }} />
              </Tooltip>
            )}
            {ragSummary.AMBER > 0 && (
              <Tooltip title={`At Risk: ${ragSummary.AMBER}`}>
                <div style={{ width: `${(ragSummary.AMBER / activeProjects.length) * 100}%`, background: '#faad14', transition: 'width 0.3s' }} />
              </Tooltip>
            )}
            {ragSummary.RED > 0 && (
              <Tooltip title={`Critical: ${ragSummary.RED}`}>
                <div style={{ width: `${(ragSummary.RED / activeProjects.length) * 100}%`, background: '#ff4d4f', transition: 'width 0.3s' }} />
              </Tooltip>
            )}
          </div>
        </Card>
      )}

      {/* Project Portfolio Table + Go-Lives */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title={<Space><ProjectOutlined /> All Active Projects</Space>}
            size="small"
            extra={<a onClick={() => navigate('/tracker?app=all')}>View All GåÆ</a>}
          >
            {activeProjects.length === 0 ? (
              <Empty description="No active projects" />
            ) : (
              <Table
                dataSource={activeProjects}
                columns={projectTableCols}
                rowKey="ID"
                size="small"
                pagination={{ pageSize: 10, size: 'small' }}
                scroll={{ x: 900 }}
                loading={isLoading}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space><RocketOutlined /> Upcoming Go-Lives</Space>} size="small" style={{ marginBottom: 16 }}>
            {upcomingGoLives.length === 0 ? (
              <Empty description="No upcoming go-lives" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={upcomingGoLives.slice(0, 8).map((wi: any) => ({
                  color: wi.daysLeft <= 0 ? 'red' : wi.daysLeft <= 14 ? 'orange' : 'blue',
                  children: (
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/workitem/${wi.ID}`)}>
                      <Space size={4}>
                        <Tag color={APP_COLORS[wi.application] || 'default'} style={{ fontSize: 9, lineHeight: '14px', padding: '0 3px' }}>{wi.application}</Tag>
                        <Text strong style={{ fontSize: 12 }}>{wi.workItemName}</Text>
                      </Space>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {wi.goLiveDate} GÇö <Tag color={wi.daysLeft <= 7 ? 'red' : wi.daysLeft <= 14 ? 'orange' : 'blue'} style={{ fontSize: 10 }}>{wi.daysLeft}d</Tag>
                      </Text>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* At Risk Summary */}
          {atRiskProjects.length > 0 && (
            <Card title={<Space><WarningOutlined style={{ color: '#faad14' }} /> Projects at Risk</Space>} size="small">
              <List
                size="small"
                dataSource={atRiskProjects.slice(0, 6)}
                renderItem={(wi: any) => (
                  <List.Item style={{ cursor: 'pointer', padding: '6px 0' }} onClick={() => navigate(`/workitem/${wi.ID}`)}>
                    <Space size={4}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: RAG_COLORS[wi.rag],
                      }} />
                      <Tag color={APP_COLORS[wi.application] || 'default'} style={{ fontSize: 9, lineHeight: '14px', padding: '0 3px' }}>{wi.application}</Tag>
                      <Text style={{ fontSize: 12 }}>{wi.workItemName}</Text>
                      {wi.goLiveDate && <Tag style={{ fontSize: 10 }}>{daysFromNow(wi.goLiveDate)}d</Tag>}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default ExecutiveDashboardClassic;
