import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Empty,
  Timeline, Tooltip, Steps, Alert
} from 'antd';
import {
  ShoppingCartOutlined, ApiOutlined, CloudServerOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, RocketOutlined, SettingOutlined,
  DatabaseOutlined, SyncOutlined, SafetyCertificateOutlined, TeamOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule } from '../../contexts/ModuleContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS: Record<string, string> = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };

/**
 * Coupa BSM Dashboard
 *
 * Coupa is a cloud-based Business Spend Management (BSM) platform covering:
 * - Procurement (Procure-to-Pay / P2P)
 * - Invoicing & Payments
 * - Strategic Sourcing
 * - Contract Management
 * - Supplier Management
 * - Travel & Expense
 * - Supply Chain Design & Collaboration
 *
 * Implementation typically follows: Design → Configure → Build → Test → Deploy → Optimize
 * Environments: Sandbox (dev/config) → Staging (UAT) → Production
 *
 * Unlike SAP transports, Coupa changes are configuration-based:
 * - Lookup values, approval chains, content groups
 * - Integration connectors (ERP, P-Card, cXML, CSV loaders)
 * - Business rules & workflows
 * - Supplier enablement & onboarding
 * - Data migrations (suppliers, catalogs, contracts)
 *
 * Source: Coupa Compass implementation documentation, Coupa community best practices
 */
const CoupaDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { moduleDef } = useModule();
  const { data: workItems = [], isLoading } = useWorkItems();

  // Filter work items for Coupa module types
  const coupaTypes = moduleDef.workItemTypes;
  const coupaItems = workItems.filter((wi: any) => coupaTypes.includes(wi.workItemType));
  const activeItems = coupaItems.filter((wi: any) => wi.status === 'Active');
  const allActiveItems = workItems.filter((wi: any) => wi.status === 'Active');

  // Use all active items if no Coupa-specific items exist (demo mode)
  const displayItems = activeItems.length > 0 ? activeItems : allActiveItems;
  const isDemoMode = activeItems.length === 0 && allActiveItems.length > 0;

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

  // Coupa implementation areas (typical modules to deploy)
  const coupaAreas = [
    { name: 'Procurement (P2P)', icon: <ShoppingCartOutlined />, color: '#1677ff' },
    { name: 'Invoicing', icon: <DatabaseOutlined />, color: '#52c41a' },
    { name: 'Sourcing', icon: <SyncOutlined />, color: '#fa8c16' },
    { name: 'Contracts', icon: <SafetyCertificateOutlined />, color: '#722ed1' },
    { name: 'Suppliers', icon: <TeamOutlined />, color: '#13c2c2' },
    { name: 'Integrations', icon: <ApiOutlined />, color: '#eb2f96' },
  ];

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
              <ShoppingCartOutlined /> Coupa BSM Command Center
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, display: 'block' }}>
              Business Spend Management — <strong>{user?.name || 'User'}</strong>
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

      {isDemoMode && (
        <Alert
          message="Demo Mode"
          description="Showing all work items. Create Coupa-specific items (Implementation, Integration, Configuration, etc.) to see filtered data."
          type="info" showIcon closable style={{ marginBottom: 16 }}
        />
      )}

      {/* Coupa Module Areas */}
      <Row gutter={[12, 12]}>
        {coupaAreas.map((area) => (
          <Col xs={12} sm={8} lg={4} key={area.name}>
            <Card size="small" hoverable style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, color: area.color, marginBottom: 4 }}>{area.icon}</div>
              <Text style={{ fontSize: 11 }}>{area.name}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Deployment Pipeline: Sandbox → Staging → Production */}
      <Card
        title={<Space><CloudServerOutlined /> Deployment Pipeline</Space>}
        size="small" style={{ marginTop: 16 }}
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
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
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

      {/* Integration Status Card */}
      <Card
        title={<Space><ApiOutlined /> Integration Status</Space>}
        size="small" style={{ marginTop: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="ERP Connectors"
              value="—"
              prefix={<DatabaseOutlined />}
              valueStyle={{ fontSize: 18, color: '#1677ff' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="cXML/CSV Feeds"
              value="—"
              prefix={<SyncOutlined />}
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Supplier APIs"
              value="—"
              prefix={<ApiOutlined />}
              valueStyle={{ fontSize: 18, color: '#fa8c16' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="SSO / Auth"
              value="—"
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ fontSize: 18, color: '#722ed1' }}
            />
          </Col>
        </Row>
        <Alert
          style={{ marginTop: 12 }}
          message="Integration monitoring will activate when Coupa API credentials are configured in Settings."
          type="info" showIcon
        />
      </Card>
    </div>
  );
};

export default CoupaDashboard;
