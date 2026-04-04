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
 *    - DTC (Direct-to-Consumer) campaigns (US/NZ only G현 other markets prohibit)
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
    <div>
      {/* Banner */}
      <Card
        style={{ marginBottom: 16, background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)', border: 'none' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              <MedicineBoxOutlined /> Commercial Operations Center
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, display: 'block' }}>
              Life Sciences Commercial G현 <strong>{user?.name || 'User'}</strong>
              {user?.roles && user.roles.length > 0 && <Tag color="gold" style={{ marginLeft: 8 }}>{user.roles[0]}</Tag>}
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <div style={{ textAlign: 'center', padding: '4px 16px' }}>
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{displayItems.length}</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Active Initiatives</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px 16px' }}>
                <div style={{ color: '#b7eb8f', fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{ragSummary.GREEN}</div>
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

      {/* Commercial Capability Areas */}
      <Row gutter={[12, 12]}>
        {commercialAreas.map((area) => (
          <Col xs={12} sm={8} lg={4} key={area.name}>
            <Tooltip title={area.desc}>
              <Card size="small" hoverable style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: area.color, marginBottom: 4 }}>{area.icon}</div>
                <Text style={{ fontSize: 11 }}>{area.name}</Text>
              </Card>
            </Tooltip>
          </Col>
        ))}
      </Row>

      {/* Launch Readiness + Compliance */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
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
                            <Tag color="processing" style={{ fontSize: 10 }}>{wi.currentPhase || 'Planning'}</Tag>
                            <Progress percent={wi.deploymentPct || 0} size="small" style={{ width: 120 }} />
                            {wi.goLiveDate && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
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
                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic
                    title={<Text style={{ fontSize: 11 }}>PhRMA Code</Text>}
                    value="Compliant"
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ fontSize: 14, color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic
                    title={<Text style={{ fontSize: 11 }}>Sunshine Act</Text>}
                    value="Current"
                    prefix={<FileProtectOutlined />}
                    valueStyle={{ fontSize: 14, color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title={<Text style={{ fontSize: 11 }}>MLR Reviews</Text>}
                    value="G현"
                    prefix={<AuditOutlined />}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title={<Text style={{ fontSize: 11 }}>AE Reports</Text>}
                    value="G현"
                    prefix={<ExperimentOutlined />}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Card>
              </Col>
            </Row>
            <Alert
              style={{ marginTop: 12 }}
              message="Compliance tracking activates with Veeva Vault / CRM integration."
              type="info" showIcon
            />
          </Card>
        </Col>
      </Row>

      {/* Timeline + Category Breakdown */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
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
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<Space><ClockCircleOutlined /> Upcoming Deadlines</Space>} size="small" style={{ marginBottom: 16 }}>
            {upcomingDeadlines.length === 0 ? (
              <Empty description="No upcoming deadlines" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={upcomingDeadlines.slice(0, 6).map((wi: any) => ({
                  color: wi.daysLeft <= 0 ? 'red' : wi.daysLeft <= 14 ? 'orange' : 'blue',
                  children: (
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/workitem/${wi.ID}`)}>
                      <Text strong style={{ fontSize: 12 }}>{wi.workItemName}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {wi.goLiveDate} G현 <Tag color={wi.daysLeft <= 7 ? 'red' : 'blue'} style={{ fontSize: 10 }}>{wi.daysLeft}d</Tag>
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
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text style={{ fontSize: 12 }}>{cat}</Text>
                  <Space size={4}>
                    <Progress percent={Math.round((count / (displayItems.length || 1)) * 100)} size="small" style={{ width: 80 }} showInfo={false} />
                    <Text strong style={{ fontSize: 12, width: 20, textAlign: 'right' }}>{count}</Text>
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
