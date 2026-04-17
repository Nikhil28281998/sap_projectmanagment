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
const CoupaDashboardClassic: React.FC = () => {
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
    <div className="dashboard-classic">
      {/* Banner */}
      <Card
        className="mb-16 coupa-banner border-none"
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} className="banner-title">
              <ShoppingCartOutlined /> Coupa Project Command Center
            </Title>
            <Text className="banner-subtitle">
              Implementation &amp; Deployment Management — <strong>{user?.name || 'User'}</strong>
              {user?.roles && user.roles.length > 0 && <Tag color="gold" className="ml-8">{user.roles[0]}</Tag>}
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <div className="banner-kpi">
                <div className="banner-kpi-value text-white">{displayItems.length}</div>
                <div className="banner-kpi-label">Active Items</div>
              </div>
              <div className="banner-kpi">
                <div className="banner-kpi-value text-green">{ragSummary.GREEN}</div>
                <div className="banner-kpi-label">On Track</div>
              </div>
              {(ragSummary.AMBER + ragSummary.RED) > 0 && (
                <div className="banner-kpi">
                  <div className="banner-kpi-value text-amber">{ragSummary.AMBER + ragSummary.RED}</div>
                  <div className="banner-kpi-label">Need Attention</div>
                </div>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Project Types */}
      <Row gutter={[12, 12]} className="summary-cards-row">
        {coupaProjectTypes.map((area) => {
          const count = displayItems.filter((wi: any) => wi.workItemType === area.name).length;
          return (
            <Col xs={12} sm={8} lg={4} key={area.name}>
              <Tooltip title={area.desc}>
                <Card
                  size="small" hoverable className="text-center cursor-pointer"
                  onClick={() => navigate(`/tracker/${area.name}`)}
                >
                  <div className="fs-24 mb-4" style={{ color: area.color }}>{area.icon}</div>
                  <Text className="fs-11">{area.name}</Text>
                  {count > 0 && <Tag color={area.color} className="fs-10 ml-4">{count}</Tag>}
                </Card>
              </Tooltip>
            </Col>
          );
        })}
      </Row>

      {/* Deployment Pipeline: Sandbox → Staging → Production */}
      <Card
        title={<Space><CloudServerOutlined /> Deployment Pipeline</Space>}
        size="small" className="mt-12"
      >
        <div className="steps-container">
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
        <div className="text-center mt-8">
          <Text type="secondary" className="fs-12">
            Environment flow: {moduleDef.terminology.environments}
          </Text>
        </div>
      </Card>

      {/* Active Items + Go-Lives */}
      <Row gutter={[12, 12]} className="mt-12 equal-height-row">
        <Col xs={24} xl={14}>
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
                      className="cursor-pointer py-8"
                      onClick={() => navigate(`/workitem/${wi.ID}`)}
                    >
                      <List.Item.Meta
                        avatar={
                          <div
                            className="rag-dot mt-4"
                            style={{ background: RAG_COLORS[rag] || '#d9d9d9' }}
                          />
                        }
                        title={
                          <Space size={4}>
                            <Text strong className="fs-13">{wi.workItemName}</Text>
                            <Tag className="fs-10">{wi.workItemType}</Tag>
                          </Space>
                        }
                        description={
                          <Space size={8}>
                            <Tag color="processing" className="fs-10">{wi.currentPhase || 'Design'}</Tag>
                            <Progress percent={wi.deploymentPct || 0} size="small" className="w-120" />
                            {wi.goLiveDate && (
                              <Text type="secondary" className="fs-11">
                                → {wi.goLiveDate} ({daysFromNow(wi.goLiveDate)}d)
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
        <Col xs={24} xl={10}>
          <Card title={<Space><RocketOutlined /> Upcoming Go-Lives</Space>} size="small" className="mb-16">
            {upcomingGoLives.length === 0 ? (
              <Empty description="No upcoming go-lives" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={upcomingGoLives.slice(0, 6).map((wi: any) => ({
                  color: wi.daysLeft <= 0 ? 'red' : wi.daysLeft <= 14 ? 'orange' : 'blue',
                  children: (
                    <div className="cursor-pointer" onClick={() => navigate(`/workitem/${wi.ID}`)}>
                      <Text strong className="fs-12">{wi.workItemName}</Text>
                      <br />
                      <Text type="secondary" className="fs-11">
                        {wi.goLiveDate} — <Tag color={wi.daysLeft <= 7 ? 'red' : 'blue'} className="fs-10">{wi.daysLeft}d</Tag>
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
                <div key={cat} className="flex-between py-4">
                  <Text className="fs-12">{cat}</Text>
                  <Space size={4}>
                    <Progress
                      percent={Math.round((count / (displayItems.length || 1)) * 100)}
                      size="small" className="w-80" showInfo={false}
                    />
                    <Text strong className="fs-12 text-right w-20">{count}</Text>
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
        size="small" className="mt-12"
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
                  <div className="text-center py-8">
                    <Text className="fs-11 text-sec">{phase}</Text>
                    <div className="fs-20 fw-600">{count}</div>
                    <Progress percent={pct} size="small" showInfo={false} className="w-80pct-center" />
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

export default CoupaDashboardClassic;
