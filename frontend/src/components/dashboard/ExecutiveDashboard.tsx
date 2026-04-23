import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, Tooltip, Space,
  DatePicker, Button, Table, Tag, Progress
} from 'antd';
import {
  ApartmentOutlined, ShoppingCartOutlined, MedicineBoxOutlined,
  CheckCircleOutlined, TrophyOutlined, WarningOutlined,
  BugOutlined, DeploymentUnitOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems, useTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import '../../styles/dashboard-analytics.css';
import type { WorkItem, Transport } from '@/types';
import { StatCard, EmptyState, ChartFrame } from '../../design/components';
import { tokenAxisConfig, tokenChartInteraction, tokenChartLabel } from '../../design/chart-theme';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const C = {
  accent: '#1677ff',
  green: 'var(--color-status-risk-low)',
  amber: 'var(--color-status-risk-medium)',
  red: 'var(--color-status-risk-high)',
  orange: '#fa8c16',
  purple: '#722ed1',
};

const APP_COLORS: Record<string, string> = { SAP: C.accent, Coupa: C.orange, Commercial: C.purple };
const APP_ICONS: Record<string, React.ReactNode> = {
  SAP: <ApartmentOutlined />, Coupa: <ShoppingCartOutlined />, Commercial: <MedicineBoxOutlined />,
};

function getRAG(wi: WorkItem): string {
  return wi.overallRAG || calculateRAG({
    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
    status: wi.status, overallRAG: wi.overallRAG,
  });
}

const RAG_LABELS: Record<string, string> = { GREEN: 'On Track', AMBER: 'At Risk', RED: 'Critical' };

const ExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { allowedApps } = useAuth();
  const { data: allWorkItems = [], isLoading } = useWorkItems();
  const { data: transports = [] } = useTransports();

  const pipeline = useMemo(() => ({
    dev: transports.filter((t: Transport) => t.currentSystem === 'DEV').length,
    qas: transports.filter((t: Transport) => t.currentSystem === 'QAS').length,
    prd: transports.filter((t: Transport) => t.currentSystem === 'PRD').length,
    total: transports.length,
  }), [transports]);

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterApp, setFilterApp] = useState<string | undefined>();

  const workItems = useMemo(() => {
    let items = allWorkItems.filter((wi: WorkItem) => !wi.application || allowedApps.includes(wi.application));
    if (filterApp) items = items.filter((wi: WorkItem) => wi.application === filterApp);
    if (dateRange) {
      items = items.filter((wi: WorkItem) => {
        if (!wi.goLiveDate) return true;
        const d = dayjs(wi.goLiveDate);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    return items;
  }, [allWorkItems, allowedApps, filterApp, dateRange]);

  const activeProjects = workItems.filter((wi: WorkItem) => wi.status === 'Active');
  const completedCount = workItems.filter((wi: WorkItem) => ['Complete', 'Completed', 'Done'].includes(wi.status)).length;

  const ragDist = useMemo(() => {
    const d = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const wi of activeProjects) {
      const r = getRAG(wi); if (r in d) d[r as keyof typeof d]++; else d.GREEN++;
    }
    return d;
  }, [activeProjects]);

  const avgDeployment = useMemo(() => {
    if (activeProjects.length === 0) return 0;
    return Math.round(activeProjects.reduce((s: number, wi: any) => s + (wi.deploymentPct || 0), 0) / activeProjects.length);
  }, [activeProjects]);

  const testSummary = useMemo(() => {
    let passed = 0, total = 0;
    for (const wi of activeProjects) { passed += wi.testPassed || 0; total += wi.testTotal || 0; }
    return { passed, total, rate: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }, [activeProjects]);

  const totalRiskScore = useMemo(() =>
    activeProjects.reduce((s: number, wi: any) => s + (wi.riskScore || 0), 0), [activeProjects]);

  // Upcoming Go-Lives
  const upcomingGoLives = useMemo(() =>
    activeProjects
      .filter((wi: WorkItem) => wi.goLiveDate && daysFromNow(wi.goLiveDate) >= 0 && daysFromNow(wi.goLiveDate) <= 90)
      .sort((a: any, b: any) => dayjs(a.goLiveDate).diff(dayjs(b.goLiveDate)))
      .slice(0, 5),
    [activeProjects]);

  // Chart: By Application & Health
  const appChartData = useMemo(() => {
    const apps = ['SAP', 'Coupa', 'Commercial'];
    const data: { app: string; count: number; status: string }[] = [];
    for (const app of apps) {
      const appItems = activeProjects.filter((wi: WorkItem) => wi.application === app);
      for (const [ragKey, label] of [['GREEN', 'On Track'], ['AMBER', 'At Risk'], ['RED', 'Critical']] as const) {
        const count = appItems.filter((wi: WorkItem) => getRAG(wi) === ragKey).length;
        if (count > 0) data.push({ app, count, status: label });
      }
    }
    return data;
  }, [activeProjects]);

  // Donut: RAG distribution
  const ragDonutData = useMemo(() => {
    const data: { status: string; value: number }[] = [];
    if (ragDist.GREEN > 0) data.push({ status: 'On Track', value: ragDist.GREEN });
    if (ragDist.AMBER > 0) data.push({ status: 'At Risk', value: ragDist.AMBER });
    if (ragDist.RED > 0) data.push({ status: 'Critical', value: ragDist.RED });
    return data;
  }, [ragDist]);

  // Bar: Progress by App
  const appProgressData = useMemo(() => {
    return ['SAP', 'Coupa', 'Commercial'].map(app => {
      const items = activeProjects.filter((wi: WorkItem) => wi.application === app);
      const avg = items.length > 0 ? Math.round(items.reduce((s: number, w: any) => s + (w.deploymentPct || 0), 0) / items.length) : 0;
      return { app, progress: avg };
    }).filter(d => d.progress > 0);
  }, [activeProjects]);

  // Bar: Risk by App
  const appRiskData = useMemo(() => {
    return ['SAP', 'Coupa', 'Commercial'].map(app => {
      const items = activeProjects.filter((wi: WorkItem) => wi.application === app);
      const avg = items.length > 0 ? Math.round(items.reduce((s: number, w: any) => s + (w.riskScore || 0), 0) / items.length) : 0;
      return { app, riskScore: avg };
    }).filter(d => d.riskScore > 0);
  }, [activeProjects]);

  // Per-app counts
  const appBreakdown = useMemo(() => {
    return ['SAP', 'Coupa', 'Commercial'].map(app => {
      const items = activeProjects.filter((wi: WorkItem) => wi.application === app);
      const completed = workItems.filter((wi: WorkItem) => wi.application === app && ['Complete', 'Completed', 'Done'].includes(wi.status)).length;
      return { app, active: items.length, completed, total: items.length + completed };
    });
  }, [activeProjects, workItems]);

  // Priority chart across all apps
  const priorityData = useMemo(() => {
    const pr: Record<string, number> = {};
    for (const wi of activeProjects) pr[wi.priority || 'N/A'] = (pr[wi.priority || 'N/A'] || 0) + 1;
    return Object.entries(pr).map(([priority, count]) => ({ priority, count }));
  }, [activeProjects]);

  const availableApps = ['SAP', 'Coupa', 'Commercial'].filter(a => allowedApps.includes(a));

  // Project table columns
  const tableCols = [
    {
      title: 'Application', dataIndex: 'application', key: 'app', width: 110,
      render: (app: string) => <Tag style={{ color: APP_COLORS[app], borderColor: APP_COLORS[app] }} icon={APP_ICONS[app]}>{app}</Tag>,
    },
    {
      title: 'Project', dataIndex: 'workItemName', key: 'name', ellipsis: true,
      render: (t: string, r: any) => <a onClick={() => navigate(`/workitem/${r.ID}`)}>{t}</a>,
    },
    {
      title: 'Type', dataIndex: 'workItemType', key: 'type', width: 120,
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: 'Health', key: 'rag', width: 70, align: 'center' as const,
      render: (_: any, r: any) => {
        const rag = getRAG(r);
        return <Tooltip title={RAG_LABELS[rag]}><div className={`rag-dot rag-dot-${rag.toLowerCase()}`} /></Tooltip>;
      },
    },
    {
      title: 'Go-Live', dataIndex: 'goLiveDate', key: 'gl', width: 120,
      render: (d: string) => d ? <Text type="secondary" className="fs-12">{d} ({daysFromNow(d)}d)</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Progress', dataIndex: 'deploymentPct', key: 'pct', width: 140,
      render: (pct: number) => {
        const v = pct || 0;
        const stroke =
          v >= 80 ? 'var(--color-status-risk-low)' :
          v >= 40 ? 'var(--color-status-risk-medium)' :
                    'var(--color-status-risk-high)';
        return (
          <Progress
            percent={v}
            size="small"
            strokeColor={stroke}
            trailColor="transparent"
            format={(p) => <span style={{ fontWeight: 600 }}>{p}%</span>}
          />
        );
      },
    },
  ];

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-view-toggle">
        <div>
          <Text className="dashboard-breadcrumb">
            SAP PM Command Center / <Text strong className="dashboard-breadcrumb-active">Executive Portfolio Analytics</Text>
          </Text>
        </div>
      </div>

      <div className="analytics-filter-bar">
        <RangePicker size="middle" onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
        <Select placeholder="Application" allowClear value={filterApp} onChange={setFilterApp}
          className="filter-select-lg" options={availableApps.map(a => ({ value: a, label: a }))} />
      </div>

      {/* KPI Cards — uniform grid, all tiles the same size */}
      <div className="kpi-grid">
        <StatCard
          loading={isLoading}
          icon={<TrophyOutlined />}
          label="Active Projects"
          value={activeProjects.length}
          delta={{ direction: 'up', text: `${ragDist.GREEN} on track` }}
          tone="info"
          onClick={() => navigate('/tracker?app=all')}
        />
        <StatCard
          loading={isLoading}
          icon={<CheckCircleOutlined />}
          label="Completed"
          value={completedCount}
          caption="Across all applications"
          tone="success"
          onClick={() => navigate('/tracker?app=all&status=Complete')}
        />
        <StatCard
          loading={isLoading}
          label="Avg Progress"
          value={avgDeployment}
          unit="%"
          caption={`Test pass: ${testSummary.rate}%`}
          tone="info"
          onClick={() => navigate('/tracker?app=all&status=Active')}
        />
        <StatCard
          loading={isLoading}
          label="Portfolio Health"
          value={activeProjects.length}
          caption={`${ragDist.GREEN} · ${ragDist.AMBER} · ${ragDist.RED}`}
          tone={ragDist.RED > 0 ? 'danger' : ragDist.AMBER > 0 ? 'warning' : 'success'}
          onClick={() => navigate('/tracker?app=all&status=Active')}
        />
        {appBreakdown.map(({ app, active, completed }) => (
          <StatCard
            key={app}
            loading={isLoading}
            icon={APP_ICONS[app]}
            label={app}
            value={active}
            caption={`Active: ${active} · Done: ${completed}`}
            tone="info"
            onClick={() => navigate(`/tracker?app=${app.toLowerCase()}`)}
          />
        ))}
        <StatCard
          loading={isLoading}
          icon={<BugOutlined />}
          label="Test Pass Rate"
          value={testSummary.rate}
          unit="%"
          caption={`${testSummary.passed}/${testSummary.total} passed`}
          tone={testSummary.rate >= 80 ? 'success' : testSummary.rate >= 50 ? 'warning' : 'danger'}
          onClick={() => navigate('/tracker?app=all&status=Active')}
        />
        <StatCard
          loading={isLoading}
          icon={<WarningOutlined />}
          label="Critical"
          value={ragDist.RED}
          caption="need attention"
          tone="danger"
          onClick={() => navigate('/tracker?app=all&status=Active&rag=RED')}
        />
        <StatCard
          loading={isLoading}
          label="At Risk"
          value={ragDist.AMBER}
          caption="being monitored"
          tone="warning"
          onClick={() => navigate('/tracker?app=all&status=Active&rag=AMBER')}
        />
        <StatCard
          loading={isLoading}
          label="Risk Score"
          value={totalRiskScore}
          caption="aggregate"
          tone={totalRiskScore > 200 ? 'danger' : 'warning'}
          onClick={() => navigate('/tracker?app=all&status=Active')}
        />
        <StatCard
          loading={isLoading}
          icon={<DeploymentUnitOutlined />}
          label="Transports"
          value={pipeline.total}
          caption={`${pipeline.prd} in PRD`}
          tone="info"
          onClick={() => navigate('/pipeline')}
        />
        <StatCard
          loading={isLoading}
          label="Go-Lives ≤90d"
          value={upcomingGoLives.length}
          caption="upcoming"
          tone="info"
          onClick={() => navigate('/tracker?app=all&status=Active')}
        />
      </div>

      {/* Portfolio Overview */}
      <div className="analytics-chart-card chart-card-mb">
        <div className="chart-title">Portfolio Overview</div>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <div className="chart-section-header">
              <Text strong className="fs-14">Projects by Application & Health</Text>
              <br /><Text type="secondary" className="fs-12">Cross-platform portfolio distribution</Text>
            </div>
            <Space size={16} className="mb-12">
              {[['On Track', C.green], ['At Risk', C.amber], ['Critical', C.red]].map(([label, color]) => (
                <Space key={label as string} size={4}>
                  <div className="legend-swatch" style={{ background: color as string }} />
                  <Text type="secondary" className="fs-12">{label}</Text>
                </Space>
              ))}
            </Space>
            <ChartFrame
              loading={isLoading}
              height={280}
              summary={`Projects by application and health. ${ragDist.GREEN} on track, ${ragDist.AMBER} at risk, ${ragDist.RED} critical across ${activeProjects.length} active projects.`}
            >
              {appChartData.length > 0 ? (
                <Column data={appChartData} xField="app" yField="count" colorField="status"
                  stack={true} height={280} theme="classic"
                  scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                  style={{ maxWidth: 60, radiusTopLeft: 4, radiusTopRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  legend={false} />
              ) : (
                <div className="chart-empty-placeholder">
                  <EmptyState title="No data" />
                </div>
              )}
            </ChartFrame>
          </Col>
          <Col xs={24} lg={10}>
            <div className="chart-section-header">
              <Text strong className="fs-14">Health Distribution</Text>
              <br /><Text type="secondary" className="fs-12">RAG status across all projects</Text>
            </div>
            <ChartFrame
              loading={isLoading}
              height={280}
              summary={`Health distribution donut. ${ragDist.GREEN} on track, ${ragDist.AMBER} at risk, ${ragDist.RED} critical.`}
            >
            {ragDonutData.length > 0 ? (
              <div className="donut-chart-wrapper">
                <Pie data={ragDonutData} angleField="value" colorField="status"
                  innerRadius={0.65} height={280} theme="classic"
                  scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                  label={false} legend={false} interaction={tokenChartInteraction} />
                <div className="donut-center-label">
                  <div className="donut-value">{activeProjects.length}</div>
                  <div className="donut-sub">Active</div>
                </div>
                <div className="donut-legend-right">
                  <div className="analytics-legend">
                    {ragDonutData.map(({ status, value }) => (
                      <div key={status} className="analytics-legend-item">
                        <div className="analytics-legend-dot" style={{ background: status === 'On Track' ? C.green : status === 'At Risk' ? C.amber : C.red }} />
                        <span>{status}: {value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="chart-empty-placeholder">
                <EmptyState title="No data" />
              </div>
            )}
            </ChartFrame>
          </Col>
        </Row>
      </div>

      {/* Application Comparison */}
      <div className="analytics-chart-card chart-card-mb">
        <div className="chart-title">Application Comparison</div>
        <Row gutter={24}>
          <Col xs={24} lg={8}>
            <div className="chart-section-header">
              <Text strong className="fs-14">Progress by Application</Text>
              <br /><Text type="secondary" className="fs-12">Average deployment % per platform</Text>
            </div>
            <ChartFrame loading={isLoading} height={200} summary={`Average deployment progress per application across ${appProgressData.length} platforms.`}>
              {appProgressData.length > 0 ? (
                <Bar data={appProgressData} xField="app" yField="progress"
                  height={Math.max(180, appProgressData.length * 56)} theme="classic"
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: (d: any) => `${d.progress}%` })} legend={false} />
              ) : <EmptyState title="No data" />}
            </ChartFrame>
          </Col>
          <Col xs={24} lg={8}>
            <div className="chart-section-header">
              <Text strong className="fs-14">Risk by Application</Text>
              <br /><Text type="secondary" className="fs-12">Average risk per platform</Text>
            </div>
            <ChartFrame loading={isLoading} height={200} summary={`Average risk score per application across ${appRiskData.length} platforms.`}>
              {appRiskData.length > 0 ? (
                <Bar data={appRiskData} xField="app" yField="riskScore"
                  height={Math.max(180, appRiskData.length * 56)} theme="classic"
                  style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'riskScore' })} legend={false} />
              ) : <EmptyState title="No data" />}
            </ChartFrame>
          </Col>
          <Col xs={24} lg={8}>
            <div className="chart-section-header">
              <Text strong className="fs-14">Priority Distribution</Text>
              <br /><Text type="secondary" className="fs-12">All active projects by priority</Text>
            </div>
            <ChartFrame loading={isLoading} height={200} summary={`Priority distribution across ${priorityData.length} categories of active projects.`}>
              {priorityData.length > 0 ? (
                <Bar data={priorityData} xField="priority" yField="count"
                  height={Math.max(180, priorityData.length * 48)} theme="classic"
                  style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false} />
              ) : <EmptyState title="No data" />}
            </ChartFrame>
          </Col>
        </Row>
      </div>

      {/* All Projects Table */}
      <div className="analytics-chart-card">
        <div className="chart-header-actions">
          <div className="chart-title">All Active Projects</div>
          <Button type="link" className="p-0" onClick={() => navigate('/tracker?app=all')}>
            View All →
          </Button>
        </div>
        <Table
          dataSource={activeProjects}
          columns={tableCols}
          rowKey="ID"
          size="small"
          pagination={{ pageSize: 8, size: 'small' }}
          scroll={{ x: 700 }}
          loading={isLoading}
          locale={{ emptyText: <EmptyState title="No active projects" /> }}
        />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
