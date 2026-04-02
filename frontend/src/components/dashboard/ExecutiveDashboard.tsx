import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Empty,
  Timeline, Tooltip, Table
} from 'antd';
import {
  ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined,
  WarningOutlined, RocketOutlined, DashboardOutlined, FundOutlined,
  ExclamationCircleOutlined, TeamOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule } from '../../contexts/ModuleContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS: Record<string, string> = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };
const RAG_LABELS: Record<string, string> = { GREEN: 'On Track', AMBER: 'At Risk', RED: 'Critical' };

const ExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { allModules } = useModule();
  const { data: workItems = [], isLoading } = useWorkItems();

  const activeProjects = workItems.filter((wi: any) => wi.status === 'Active');

  // RAG distribution
  const ragSummary = useMemo(() => {
    const dist = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const wi of activeProjects) {
      const rag = wi.overallRAG || calculateRAG({
        goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
        status: wi.status, overallRAG: wi.overallRAG,
      });
      if (rag in dist) dist[rag as keyof typeof dist]++;
      else dist.GREEN++;
    }
    return dist;
  }, [activeProjects]);

  // Phase distribution
  const phaseSummary = useMemo(() => {
    const phases: Record<string, number> = {};
    for (const wi of activeProjects) {
      const p = wi.currentPhase || 'Planning';
      phases[p] = (phases[p] || 0) + 1;
    }
    return Object.entries(phases).sort((a, b) => b[1] - a[1]);
  }, [activeProjects]);

  // Type distribution
  const typeSummary = useMemo(() => {
    const types: Record<string, number> = {};
    for (const wi of activeProjects) {
      const t = wi.workItemType || 'Other';
      types[t] = (types[t] || 0) + 1;
    }
    return Object.entries(types).sort((a, b) => b[1] - a[1]);
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
      const rag = wi.overallRAG || calculateRAG({
        goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
        status: wi.status, overallRAG: wi.overallRAG,
      });
      return rag === 'RED' || rag === 'AMBER';
    }).map((wi: any) => ({
      ...wi,
      rag: wi.overallRAG || calculateRAG({
        goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
        status: wi.status, overallRAG: wi.overallRAG,
      }),
    }));
  }, [activeProjects]);

  // Completed projects
  const completedCount = workItems.filter((wi: any) => wi.status === 'Complete' || wi.status === 'Completed').length;

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
      title: 'Status', key: 'rag', width: 90, align: 'center' as const,
      render: (_: any, r: any) => {
        const rag = r.overallRAG || calculateRAG({
          goLiveDate: r.goLiveDate, deploymentPct: r.deploymentPct || 0,
          status: r.status, overallRAG: r.overallRAG,
        });
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
      ) : '—',
    },
    {
      title: 'Progress', key: 'progress', width: 140,
      render: (_: any, r: any) => (
        <Progress percent={r.deploymentPct || 0} size="small" strokeColor={
          RAG_COLORS[r.overallRAG || 'GREEN']
        } />
      ),
    },
    {
      title: 'Owner', dataIndex: 'businessOwner', key: 'owner', width: 130, ellipsis: true,
      render: (t: string) => t || '—',
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
              <FundOutlined /> Executive Portfolio View
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, display: 'block' }}>
              Welcome, <strong>{user?.name || 'Executive'}</strong> — High-level portfolio health across all modules
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <div style={{ textAlign: 'center', padding: '4px 16px' }}>
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                  {activeProjects.length}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Active Projects</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px 16px' }}>
                <div style={{ color: '#52c41a', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
                  {completedCount}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Completed</div>
              </div>
              {atRiskProjects.length > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 16px' }}>
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

      {/* Portfolio Health Cards */}
      <Row gutter={[12, 12]}>
        <Col xs={8} lg={4}>
          <Card size="small">
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>On Track</Text>}
              value={ragSummary.GREEN}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small">
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>At Risk</Text>}
              value={ragSummary.AMBER}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small">
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Critical</Text>}
              value={ragSummary.RED}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small">
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
          <Card size="small">
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Test Pass Rate</Text>}
              value={testSummary.rate}
              suffix="%"
              valueStyle={{ color: testSummary.rate >= 80 ? '#52c41a' : testSummary.rate >= 50 ? '#faad14' : '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={8} lg={4}>
          <Card size="small">
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Modules</Text>}
              value={allModules.length}
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
          <Row gutter={24}>
            {phaseSummary.map(([phase, count]) => (
              <Col key={phase}>
                <Text type="secondary" style={{ fontSize: 11 }}>{phase}:</Text>{' '}
                <Text strong style={{ fontSize: 13 }}>{count}</Text>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* Project Portfolio Table + Go-Lives */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title={<Space><ProjectOutlined /> Active Projects</Space>}
            size="small"
            extra={<a onClick={() => navigate('/tracker')}>View All →</a>}
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
                scroll={{ x: 800 }}
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
                      <Text strong style={{ fontSize: 12 }}>{wi.workItemName}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {wi.goLiveDate} — <Tag color={wi.daysLeft <= 7 ? 'red' : wi.daysLeft <= 14 ? 'orange' : 'blue'} style={{ fontSize: 10 }}>{wi.daysLeft}d</Tag>
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
                dataSource={atRiskProjects.slice(0, 5)}
                renderItem={(wi: any) => (
                  <List.Item style={{ cursor: 'pointer', padding: '6px 0' }} onClick={() => navigate(`/workitem/${wi.ID}`)}>
                    <Space size={4}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: RAG_COLORS[wi.rag],
                      }} />
                      <Text style={{ fontSize: 12 }}>{wi.workItemName}</Text>
                      {wi.goLiveDate && <Tag style={{ fontSize: 10 }}>{daysFromNow(wi.goLiveDate)}d</Tag>}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* Type Distribution */}
          <Card title={<Space><ProjectOutlined /> By Type</Space>} size="small" style={{ marginTop: 16 }}>
            {typeSummary.map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <Text style={{ fontSize: 12 }}>{type}</Text>
                <Space size={4}>
                  <Progress percent={Math.round((count / (activeProjects.length || 1)) * 100)} size="small" style={{ width: 80 }} showInfo={false} />
                  <Text strong style={{ fontSize: 12, width: 20, textAlign: 'right' }}>{count}</Text>
                </Space>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ExecutiveDashboard;
