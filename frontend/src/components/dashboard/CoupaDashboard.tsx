import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Empty,
  Timeline, Tooltip, Steps, Alert
} from 'antd';
import {
  ShoppingCartOutlined, ApiOutlined, CloudServerOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, RocketOutlined, SettingOutlined,
  DatabaseOutlined, SyncOutlined, SafetyCertificateOutlined, TeamOutlined,
  DashboardOutlined, ProjectOutlined, ToolOutlined, SwapOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule } from '../../contexts/ModuleContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS: Record<string, string> = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };

/**
 * Coupa Project Management Dashboard
 *
 * This dashboard tracks Coupa implementation PROJECTS — not Coupa's operational
 * platform features. Coupa implementations follow a four-step methodology
 * (Source: Coupa Compass, compass.coupa.com) with three delivery models:
 * Direct Delivery, Expert Services, and Co-Delivery.
 *
 * Project types tracked here:
 * - Implementation: Core Coupa module deployments (greenfield/brownfield)
 * - Integration: ERP connectors, cXML/API feeds, P-Card integration
 * - Configuration: Approval workflows, business rules, content groups
 * - Data Migration: Supplier data, catalogs, contracts, spend history
 * - Supplier Enablement: Supplier onboarding programs & portal rollouts
 * - Upgrade / Optimization: Post-go-live improvements, release upgrades
 *
 * Phases: Design → Configure → Build → Test → Deploy → Optimize
 * Environments: Sandbox (dev/config) → Staging (UAT) → Production
 *
 * Source: Coupa Compass implementation documentation (2024),
 * SAFe LPM for portfolio governance, PMI Pulse 2025
 */
const CoupaDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { moduleDef } = useModule();
  const { data: workItems = [], isLoading } = useWorkItems();

  // Filter work items by application field
  const coupaItems = workItems.filter((wi: any) => wi.application === 'Coupa');
  const activeItems = coupaItems.filter((wi: any) => wi.status === 'Active');
  const displayItems = activeItems;

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const wi of displayItems) {
      const t = wi.workItemType || 'Other';
      cats[t] = (cats[t] || 0) + 1;
    }
    return Object.entries(cats);
  }, [displayItems]);

  // Phase distribution
  const phaseDistribution = useMemo(() => {
    const phases: Record<string, number> = {};
    for (const wi of displayItems) {
      const p = wi.currentPhase || 'Design';
      phases[p] = (phases[p] || 0) + 1;
    }
    return phases;
  }, [displayItems]);

  // Upcoming go-lives
  const upcomingGoLives = useMemo(() => {
    return displayItems
      .filter((wi: any) => wi.goLiveDate)
      .map((wi: any) => ({ ...wi, daysLeft: daysFromNow(wi.goLiveDate) }))
      .filter((wi: any) => wi.daysLeft >= -7 && wi.daysLeft <= 60)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [displayItems]);

  // RAG summary
  const ragSummary = useMemo(() => {
    const dist = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const wi of displayItems) {
      const rag = wi.overallRAG || calculateRAG({
        goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
        status: wi.status, overallRAG: wi.overallRAG,
      });
      if (rag in dist) dist[rag as keyof typeof dist]++;
      else dist.GREEN++;
    }
    return dist;
  }, [displayItems]);

  // Coupa project types (matching MODULE_DEFINITIONS workItemTypes)
  const coupaProjectTypes = [
    { name: 'Implementation', icon: <ProjectOutlined />, color: '#1677ff', desc: 'Core Coupa module deployments' },
    { name: 'Integration', icon: <ApiOutlined />, color: '#52c41a', desc: 'ERP, cXML, API connectors' },
    { name: 'Configuration', icon: <SettingOutlined />, color: '#fa8c16', desc: 'Workflows, rules, approvals' },
    { name: 'Data Migration', icon: <DatabaseOutlined />, color: '#722ed1', desc: 'Suppliers, catalogs, contracts' },
    { name: 'Supplier Enablement', icon: <TeamOutlined />, color: '#13c2c2', desc: 'Onboarding & portal rollouts' },
    { name: 'Optimization', icon: <ToolOutlined />, color: '#eb2f96', desc: 'Post-go-live improvements' },
  ];

  // Phase distribution
  const phaseItems = useMemo(() => {
    const phaseLookup: Record<string, number> = {};
    for (const wi of displayItems) {
      const p = wi.currentPhase || 'Design';
      phaseLookup[p] = (phaseLookup[p] || 0) + 1;
    }
    return phaseLookup;
  }, [displayItems]);

  return (
    <div>
      {/* Banner */}
      <Card
        style={{ marginBottom: 16, background: 'linear-gradient(135deg, #0070d2 0%, #004990 100%)', border: 'none' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              <ShoppingCartOutlined /> Coupa Project Command Center
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, display: 'block' }}>
              Implementation &amp; Deployment Management — <strong>{user?.name || 'User'}</strong>
              {user?.roles && user.roles.length > 0 && <Tag color="gold" style={{ marginLeft: 8 }}>{user.roles[0]}</Tag>}
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <div style={{ textAlign: 'center', padding: '4px 16px' }}>
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{displayItems.length}</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Active Items</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px 16px' }}>
                <div style={{ color: '#52c41a', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{ragSummary.GREEN}</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>On Track</div>
              </div>
              {(ragSummary.AMBER + ragSummary.RED) > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 16px' }}>
                  <div style={{ color: '#faad14', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{ragSummary.AMBER + ragSummary.RED}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Need Attention</div>
                </div>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Project Types */}
      <Row gutter={[12, 12]}>
        {coupaProjectTypes.map((area) => {
          const count = displayItems.filter((wi: any) => wi.workItemType === area.name).length;
          return (
            <Col xs={12} sm={8} lg={4} key={area.name}>
              <Tooltip title={area.desc}>
                <Card
                  size="small" hoverable style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => navigate(`/tracker/${area.name}`)}
                >
                  <div style={{ fontSize: 24, color: area.color, marginBottom: 4 }}>{area.icon}</div>
                  <Text style={{ fontSize: 11 }}>{area.name}</Text>
                  {count > 0 && <Tag color={area.color} style={{ marginLeft: 4, fontSize: 10 }}>{count}</Tag>}
                </Card>
              </Tooltip>
            </Col>
          );
        })}
      </Row>

      {/* Deployment Pipeline: Sandbox → Staging → Production */}
      <Card
        title={<Space><CloudServerOutlined /> Deployment Pipeline</Space>}
        size="small" style={{ marginTop: 12 }}
      >
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 0' }}>
          <Steps
            current={1}
            items={[
              {
                title: 'Sandbox',
                description: `${phaseDistribution['Design'] || phaseDistribution['Configure'] || 0} items`,
                icon: <SettingOutlined />,
              },
              {
                title: 'Staging / UAT',
                description: `${phaseDistribution['Test'] || phaseDistribution['Testing'] || 0} items`,
                icon: <SyncOutlined />,
              },
              {
                title: 'Production',
                description: `${phaseDistribution['Deploy'] || phaseDistribution['Go-Live'] || phaseDistribution['Complete'] || 0} items`,
                icon: <CheckCircleOutlined />,
              },
            ]}
          />
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Environment flow: {moduleDef.terminology.environments}
          </Text>
        </div>
      </Card>

      {/* Active Items + Go-Lives */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card
            title={<Space><ShoppingCartOutlined /> Active Deliverables</Space>}
            size="small"
            extra={<a onClick={() => navigate('/tracker')}>View All →</a>}
          >
            {displayItems.length === 0 ? (
              <Empty description="No active Coupa deliverables. Create one from the Tracker page." />
            ) : (
              <List
                size="small"
                dataSource={displayItems.slice(0, 10)}
                renderItem={(wi: any) => {
                  const rag = wi.overallRAG || calculateRAG({
                    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
                    status: wi.status, overallRAG: wi.overallRAG,
                  });
                  return (
                    <List.Item
                      style={{ cursor: 'pointer', padding: '8px 0' }}
                      onClick={() => navigate(`/workitem/${wi.ID}`)}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: 12, height: 12, borderRadius: '50%', marginTop: 4,
                            background: RAG_COLORS[rag] || '#d9d9d9',
                          }} />
                        }
                        title={
                          <Space size={4}>
                            <Text strong style={{ fontSize: 13 }}>{wi.workItemName}</Text>
                            <Tag style={{ fontSize: 10 }}>{wi.workItemType}</Tag>
                          </Space>
                        }
                        description={
                          <Space size={8}>
                            <Tag color="processing" style={{ fontSize: 10 }}>{wi.currentPhase || 'Design'}</Tag>
                            <Progress percent={wi.deploymentPct || 0} size="small" style={{ width: 120 }} />
                            {wi.goLiveDate && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                🚀 {wi.goLiveDate} ({daysFromNow(wi.goLiveDate)}d)
                              </Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<Space><RocketOutlined /> Upcoming Go-Lives</Space>} size="small" style={{ marginBottom: 16 }}>
            {upcomingGoLives.length === 0 ? (
              <Empty description="No upcoming go-lives" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={upcomingGoLives.slice(0, 6).map((wi: any) => ({
                  color: wi.daysLeft <= 0 ? 'red' : wi.daysLeft <= 14 ? 'orange' : 'blue',
                  children: (
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/workitem/${wi.ID}`)}>
                      <Text strong style={{ fontSize: 12 }}>{wi.workItemName}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {wi.goLiveDate} — <Tag color={wi.daysLeft <= 7 ? 'red' : 'blue'} style={{ fontSize: 10 }}>{wi.daysLeft}d</Tag>
                      </Text>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* Category Breakdown */}
          <Card title={<Space><DashboardOutlined /> By Category</Space>} size="small">
            {categoryBreakdown.length === 0 ? (
              <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              categoryBreakdown.map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text style={{ fontSize: 12 }}>{cat}</Text>
                  <Space size={4}>
                    <Progress
                      percent={Math.round((count / (displayItems.length || 1)) * 100)}
                      size="small" style={{ width: 80 }} showInfo={false}
                    />
                    <Text strong style={{ fontSize: 12, width: 20, textAlign: 'right' }}>{count}</Text>
                  </Space>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* Phase Distribution */}
      <Card
        title={<Space><DashboardOutlined /> Phase Distribution</Space>}
        size="small" style={{ marginTop: 12 }}
      >
        {displayItems.length === 0 ? (
          <Empty description="No active deliverables" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Row gutter={[16, 8]}>
            {['Design', 'Configure', 'Build', 'Test', 'Deploy', 'Optimize'].map((phase) => {
              const count = phaseItems[phase] || 0;
              const pct = displayItems.length > 0 ? Math.round((count / displayItems.length) * 100) : 0;
              return (
                <Col xs={12} sm={8} lg={4} key={phase}>
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{phase}</Text>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{count}</div>
                    <Progress percent={pct} size="small" showInfo={false} style={{ width: '80%', margin: '0 auto' }} />
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>
    </div>
  );
};

export default CoupaDashboard;
