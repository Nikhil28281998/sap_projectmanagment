import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Empty,
  Timeline, Tooltip, Alert
} from 'antd';
import {
  MedicineBoxOutlined, RocketOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
  TeamOutlined, FundOutlined, AuditOutlined, GlobalOutlined,
  ExperimentOutlined, DashboardOutlined, FileProtectOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule } from '../../contexts/ModuleContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS: Record<string, string> = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };

/**
 * Commercial Life Sciences Dashboard
 *
 * Life Sciences commercial operations in pharma/biotech typically include:
 *
 * 1. **Product Launch Management**
 *    - Pre-launch planning, launch readiness, post-launch monitoring
 *    - Cross-functional coordination (Medical, Regulatory, Commercial, Supply Chain)
 *    - KOL (Key Opinion Leader) engagement planning
 *
 * 2. **Campaign Management**
 *    - HCP (Healthcare Provider) engagement campaigns
 *    - DTC (Direct-to-Consumer) campaigns (US/NZ only — other markets prohibit)
 *    - Multi-channel marketing (digital, field force, congress/symposium)
 *
 * 3. **Compliance & Regulatory**
 *    - PhRMA Code / EFPIA Code adherence
 *    - Sunshine Act / Open Payments reporting (aggregate spend tracking)
 *    - Adverse event reporting
 *    - MLR (Medical Legal Regulatory) review cycles for promotional materials
 *
 * 4. **Field Force Operations**
 *    - Territory management & alignment
 *    - Call planning & physician targeting
 *    - Sales force effectiveness metrics (TRx, NRx, market share)
 *    - CRM (typically Veeva CRM) management
 *
 * 5. **Market Access**
 *    - Formulary positioning & payer strategy
 *    - Pricing & reimbursement
 *    - Patient support programs
 *
 * Sources: PhRMA Code on Interactions with Healthcare Professionals (2008),
 * FDA OPDP guidelines, Pharmaceutical Marketing (Wikipedia), McKinsey Life Sciences
 */
const CommercialDashboardClassic: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { moduleDef } = useModule();
  const { data: workItems = [], isLoading } = useWorkItems();

  // Filter work items by application field
  const commercialItems = workItems.filter((wi: any) => wi.application === 'Commercial');
  const activeItems = commercialItems.filter((wi: any) => wi.status === 'Active');
  const displayItems = activeItems;

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

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const wi of displayItems) {
      const t = wi.workItemType || 'Other';
      cats[t] = (cats[t] || 0) + 1;
    }
    return Object.entries(cats);
  }, [displayItems]);

  // Upcoming launches/deadlines
  const upcomingDeadlines = useMemo(() => {
    return displayItems
      .filter((wi: any) => wi.goLiveDate)
      .map((wi: any) => ({ ...wi, daysLeft: daysFromNow(wi.goLiveDate) }))
      .filter((wi: any) => wi.daysLeft >= -7 && wi.daysLeft <= 90)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [displayItems]);

  // Commercial capability areas
  const commercialAreas = [
    { name: 'Product Launch', icon: <RocketOutlined />, color: '#722ed1', desc: 'Launch readiness & go-to-market' },
    { name: 'Campaigns', icon: <FundOutlined />, color: '#1677ff', desc: 'HCP & DTC engagement' },
    { name: 'Compliance', icon: <SafetyCertificateOutlined />, color: '#52c41a', desc: 'PhRMA Code, Sunshine Act, AE reporting' },
    { name: 'Market Access', icon: <GlobalOutlined />, color: '#fa8c16', desc: 'Formulary, pricing, payer strategy' },
    { name: 'Field Force', icon: <TeamOutlined />, color: '#13c2c2', desc: 'Territory mgmt, call planning, CRM' },
    { name: 'MLR Review', icon: <AuditOutlined />, color: '#eb2f96', desc: 'Medical Legal Regulatory review' },
  ];

  return (
    <div className="dashboard-classic">
      {/* Banner */}
      <Card
        className="mb-16 commercial-banner border-none"
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} className="banner-title">
              <MedicineBoxOutlined /> Commercial Operations Center
            </Title>
            <Text className="banner-subtitle">
              Life Sciences Commercial — <strong>{user?.name || 'User'}</strong>
              {user?.roles && user.roles.length > 0 && <Tag color="gold" className="ml-8">{user.roles[0]}</Tag>}
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <div className="banner-kpi">
                <div className="text-white banner-kpi-value">{displayItems.length}</div>
                <div className="banner-kpi-label">Active Initiatives</div>
              </div>
              <div className="banner-kpi">
                <div className="text-green-light banner-kpi-value">{ragSummary.GREEN}</div>
                <div className="banner-kpi-label">On Track</div>
              </div>
              {(ragSummary.AMBER + ragSummary.RED) > 0 && (
                <div className="banner-kpi">
                  <div className="text-amber banner-kpi-value">{ragSummary.AMBER + ragSummary.RED}</div>
                  <div className="banner-kpi-label">Need Attention</div>
                </div>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Commercial Capability Areas */}
      <Row gutter={[12, 12]} className="summary-cards-row">
        {commercialAreas.map((area) => (
          <Col xs={12} sm={8} lg={4} key={area.name}>
            <Tooltip title={area.desc}>
              <Card size="small" hoverable className="text-center">
                <div className="fs-24 mb-4" style={{ color: area.color }}>{area.icon}</div>
                <Text className="fs-11">{area.name}</Text>
              </Card>
            </Tooltip>
          </Col>
        ))}
      </Row>

      {/* Launch Readiness + Compliance */}
      <Row gutter={[12, 12]} className="mt-12">
        <Col xs={24} lg={12}>
          <Card title={<Space><RocketOutlined /> Launch & Initiative Tracker</Space>} size="small">
            {displayItems.length === 0 ? (
              <Empty description="No active initiatives. Create one from the Tracker page." />
            ) : (
              <List
                size="small"
                dataSource={displayItems.slice(0, 8)}
                renderItem={(wi: any) => {
                  const rag = wi.overallRAG || calculateRAG({
                    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
                    status: wi.status, overallRAG: wi.overallRAG,
                  });
                  return (
                    <List.Item
                      className="cursor-pointer py-8 px-0"
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
                            <Tag color="processing" className="fs-10">{wi.currentPhase || 'Planning'}</Tag>
                            <Progress percent={wi.deploymentPct || 0} size="small" className="w-120" />
                            {wi.goLiveDate && (
                              <Text type="secondary" className="fs-11">
                                {wi.goLiveDate} ({daysFromNow(wi.goLiveDate)}d)
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
        <Col xs={24} lg={12}>
          <Card
            title={<Space><SafetyCertificateOutlined /> Compliance & Regulatory Status</Space>}
            size="small"
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" className="card-success-light">
                  <Statistic
                    title={<Text className="fs-11">PhRMA Code</Text>}
                    value="Compliant"
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ fontSize: 14, color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" className="card-success-light">
                  <Statistic
                    title={<Text className="fs-11">Sunshine Act</Text>}
                    value="Current"
                    prefix={<FileProtectOutlined />}
                    valueStyle={{ fontSize: 14, color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title={<Text className="fs-11">MLR Reviews</Text>}
                    value="—"
                    prefix={<AuditOutlined />}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title={<Text className="fs-11">AE Reports</Text>}
                    value="—"
                    prefix={<ExperimentOutlined />}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Card>
              </Col>
            </Row>
            <Alert
              className="mt-12"
              message="Compliance tracking activates with Veeva Vault / CRM integration."
              type="info" showIcon
            />
          </Card>
        </Col>
      </Row>

      {/* Timeline + Category Breakdown */}
      <Row gutter={[12, 12]} className="mt-12 equal-height-row">
        <Col xs={24} xl={14}>
          {/* Phase Distribution */}
          <Card title={<Space><DashboardOutlined /> Phase Distribution</Space>} size="small">
            {displayItems.length === 0 ? (
              <Empty description="No active initiatives" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Row gutter={[16, 8]}>
                {['Planning', 'Pre-Launch', 'Execution', 'Monitoring', 'Close-Out'].map((phase) => {
                  const count = displayItems.filter((wi: any) => (wi.currentPhase || 'Planning') === phase).length;
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
        </Col>
        <Col xs={24} xl={10}>
          <Card title={<Space><ClockCircleOutlined /> Upcoming Deadlines</Space>} size="small" className="mb-16">
            {upcomingDeadlines.length === 0 ? (
              <Empty description="No upcoming deadlines" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={upcomingDeadlines.slice(0, 6).map((wi: any) => ({
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

          <Card title={<Space><DashboardOutlined /> By Initiative Type</Space>} size="small">
            {categoryBreakdown.length === 0 ? (
              <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              categoryBreakdown.map(([cat, count]) => (
                <div key={cat} className="flex-between py-4">
                  <Text className="fs-12">{cat}</Text>
                  <Space size={4}>
                    <Progress percent={Math.round((count / (displayItems.length || 1)) * 100)} size="small" className="w-80" showInfo={false} />
                    <Text strong className="fs-12 w-20 text-right">{count}</Text>
                  </Space>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CommercialDashboardClassic;
