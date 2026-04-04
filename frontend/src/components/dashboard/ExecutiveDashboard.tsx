import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, Tooltip, Space, Segmented,
  DatePicker, Button, Empty, Table, Tag, Progress
} from 'antd';
import {
  FilterOutlined, CaretUpOutlined, CaretDownOutlined, InfoCircleOutlined,
  BarChartOutlined, AppstoreOutlined,
  ApartmentOutlined, ShoppingCartOutlined, MedicineBoxOutlined,
  CheckCircleOutlined, TrophyOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import ExecutiveDashboardClassic from './ExecutiveDashboardClassic';
import '../../styles/dashboard-analytics.css';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const C = {
  bg: '#f0f2f5', card: '#ffffff', border: '#e8e8e8',
  text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.45)',
  accent: '#1677ff', green: '#52c41a', red: '#ff4d4f', amber: '#faad14',
  orange: '#fa8c16', purple: '#722ed1', cyan: '#13c2c2', pink: '#eb2f96',
};

const APP_COLORS: Record<string, string> = { SAP: C.accent, Coupa: C.orange, Commercial: C.purple };
const APP_ICONS: Record<string, React.ReactNode> = {
  SAP: <ApartmentOutlined />, Coupa: <ShoppingCartOutlined />, Commercial: <MedicineBoxOutlined />,
};

function getRAG(wi: any): string {
  return wi.overallRAG || calculateRAG({
    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
    status: wi.status, overallRAG: wi.overallRAG,
  });
}

const RAG_LABELS: Record<string, string> = { GREEN: 'On Track', AMBER: 'At Risk', RED: 'Critical' };
const RAG_COLORS: Record<string, string> = { GREEN: C.green, AMBER: C.amber, RED: C.red };

const VIEW_KEY = 'exec_dashboard_view';
const getStoredView = () => (localStorage.getItem(VIEW_KEY) as 'analytics' | 'classic') || 'analytics';

const ExecutiveDashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'analytics' | 'classic'>(getStoredView);
  const navigate = useNavigate();
  const { user, allowedApps } = useAuth();
  const { data: allWorkItems = [], isLoading } = useWorkItems();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterApp, setFilterApp] = useState<string | undefined>();

  const workItems = useMemo(() => {
    let items = allWorkItems.filter((wi: any) => !wi.application || allowedApps.includes(wi.application));
    if (filterApp) items = items.filter((wi: any) => wi.application === filterApp);
    if (dateRange) {
      items = items.filter((wi: any) => {
        if (!wi.goLiveDate) return true;
        const d = dayjs(wi.goLiveDate);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    return items;
  }, [allWorkItems, allowedApps, filterApp, dateRange]);

  const activeProjects = workItems.filter((wi: any) => wi.status === 'Active');
  const completedCount = workItems.filter((wi: any) => ['Complete', 'Completed', 'Done'].includes(wi.status)).length;

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
      .filter((wi: any) => wi.goLiveDate && daysFromNow(wi.goLiveDate) >= 0 && daysFromNow(wi.goLiveDate) <= 90)
      .sort((a: any, b: any) => dayjs(a.goLiveDate).diff(dayjs(b.goLiveDate)))
      .slice(0, 5),
    [activeProjects]);

  // Chart: By Application & Health
  const appChartData = useMemo(() => {
    const apps = ['SAP', 'Coupa', 'Commercial'];
    const data: { app: string; count: number; status: string }[] = [];
    for (const app of apps) {
      const appItems = activeProjects.filter((wi: any) => wi.application === app);
      for (const [ragKey, label] of [['GREEN', 'On Track'], ['AMBER', 'At Risk'], ['RED', 'Critical']] as const) {
        const count = appItems.filter((wi: any) => getRAG(wi) === ragKey).length;
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
      const items = activeProjects.filter((wi: any) => wi.application === app);
      const avg = items.length > 0 ? Math.round(items.reduce((s: number, w: any) => s + (w.deploymentPct || 0), 0) / items.length) : 0;
      return { app, progress: avg };
    }).filter(d => d.progress > 0);
  }, [activeProjects]);

  // Bar: Risk by App
  const appRiskData = useMemo(() => {
    return ['SAP', 'Coupa', 'Commercial'].map(app => {
      const items = activeProjects.filter((wi: any) => wi.application === app);
      const avg = items.length > 0 ? Math.round(items.reduce((s: number, w: any) => s + (w.riskScore || 0), 0) / items.length) : 0;
      return { app, riskScore: avg };
    }).filter(d => d.riskScore > 0);
  }, [activeProjects]);

  // Per-app counts
  const appBreakdown = useMemo(() => {
    return ['SAP', 'Coupa', 'Commercial'].map(app => {
      const items = activeProjects.filter((wi: any) => wi.application === app);
      const completed = workItems.filter((wi: any) => wi.application === app && ['Complete', 'Completed', 'Done'].includes(wi.status)).length;
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
        return <Tooltip title={RAG_LABELS[rag]}><div style={{ width: 12, height: 12, borderRadius: '50%', background: RAG_COLORS[rag], margin: '0 auto' }} /></Tooltip>;
      },
    },
    {
      title: 'Go-Live', dataIndex: 'goLiveDate', key: 'gl', width: 120,
      render: (d: string) => d ? <Text type="secondary" style={{ fontSize: 12 }}>{d} ({daysFromNow(d)}d)</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Progress', dataIndex: 'deploymentPct', key: 'pct', width: 120,
      render: (pct: number) => <Progress percent={pct || 0} size="small" />,
    },
  ];

  const handleViewChange = (val: string | number) => {
    const v = val as 'analytics' | 'classic';
    setViewMode(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  if (viewMode === 'classic') {
    return (
      <div>
        <div className="dashboard-view-toggle" style={{ padding: '12px 0' }}>
          <Title level={4} style={{ margin: 0 }}><TrophyOutlined /> Executive Overview</Title>
          <Segmented
            options={[
              { label: <span><AppstoreOutlined /> Classic</span>, value: 'classic' },
              { label: <span><BarChartOutlined /> Analytics</span>, value: 'analytics' },
            ]}
            value={viewMode}
            onChange={handleViewChange}
          />
        </div>
        <ExecutiveDashboardClassic />
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-view-toggle">
        <div>
          <Text style={{ color: C.textSec, fontSize: 13 }}>
            SAP PM Command Center / <Text strong style={{ fontSize: 13 }}>Executive Portfolio Analytics</Text>
          </Text>
        </div>
        <Segmented
          options={[
            { label: <span><AppstoreOutlined /> Classic</span>, value: 'classic' },
            { label: <span><BarChartOutlined /> Analytics</span>, value: 'analytics' },
          ]}
          value={viewMode}
          onChange={handleViewChange}
        />
      </div>

      <div className="analytics-filter-bar">
        <RangePicker size="middle" onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
        <Select placeholder="Application" allowClear value={filterApp} onChange={setFilterApp}
          style={{ width: 160 }} options={availableApps.map(a => ({ value: a, label: a }))} />
        <Button icon={<FilterOutlined />}>Filters</Button>
      </div>

      {/* KPI Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi" onClick={() => navigate('/tracker?app=all')} style={{ cursor: 'pointer' }}>
            <div className="kpi-label"><TrophyOutlined /> Active Projects</div>
            <div className="kpi-value">{activeProjects.length}</div>
            <div className="kpi-delta positive"><CaretUpOutlined /> {ragDist.GREEN} on track</div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label"><CheckCircleOutlined /> Completed</div>
            <div className="kpi-value" style={{ color: C.green }}>{completedCount}</div>
            <div className="kpi-delta neutral">Across all applications</div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">Avg Progress</div>
            <div className="kpi-value">{avgDeployment}<span style={{ fontSize: 18, opacity: 0.5 }}>%</span></div>
            <div className="kpi-delta neutral">Test pass: {testSummary.rate}%</div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">Portfolio Health</div>
            <div className="kpi-value">{activeProjects.length}</div>
            <div className="rag-bar">
              {ragDist.GREEN > 0 && <Tooltip title={`On Track: ${ragDist.GREEN}`}><div style={{ flex: ragDist.GREEN, background: C.green }} /></Tooltip>}
              {ragDist.AMBER > 0 && <Tooltip title={`At Risk: ${ragDist.AMBER}`}><div style={{ flex: ragDist.AMBER, background: C.amber }} /></Tooltip>}
              {ragDist.RED > 0 && <Tooltip title={`Critical: ${ragDist.RED}`}><div style={{ flex: ragDist.RED, background: C.red }} /></Tooltip>}
            </div>
            <div className="rag-bar-legend">
              <span><span style={{ color: C.green }}>●</span> On Track</span>
              <span><span style={{ color: C.amber }}>●</span> At Risk</span>
              <span><span style={{ color: C.red }}>●</span> Critical</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* Mini Stats: Per-App Breakdown */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {appBreakdown.map(({ app, active, completed, total }) => (
          <Col xs={8} lg={8} key={app}>
            <div className="analytics-kpi" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, color: APP_COLORS[app] }}>{APP_ICONS[app]}</div>
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 14 }}>{app}</Text>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Active: <Text strong>{active}</Text></Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>Done: <Text strong style={{ color: C.green }}>{completed}</Text></Text>
                </div>
              </div>
            </div>
          </Col>
        ))}
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}><WarningOutlined /> Critical</div>
            <div className="kpi-value" style={{ fontSize: 24, color: C.red }}>{ragDist.RED}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>need attention</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>Risk Score</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{totalRiskScore}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>aggregate</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>Go-Lives ≤90d</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{upcomingGoLives.length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>upcoming</Text>
          </div>
        </Col>
      </Row>

      {/* Portfolio Overview */}
      <div className="analytics-chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">Portfolio Overview</div>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Projects by Application & Health</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Cross-platform portfolio distribution</Text>
            </div>
            <Space size={16} style={{ marginBottom: 12 }}>
              {[['On Track', C.green], ['At Risk', C.amber], ['Critical', C.red]].map(([label, color]) => (
                <Space key={label as string} size={4}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: color as string }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
                </Space>
              ))}
            </Space>
            {appChartData.length > 0 ? (
              <Column data={appChartData} xField="app" yField="count" colorField="status"
                stack={true} height={280} theme="classic"
                scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                style={{ maxWidth: 60, radiusTopLeft: 4, radiusTopRight: 4 }}
                axis={{ x: { title: false, line: null, tick: null }, y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] } }}
                legend={false} />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="No data" />
              </div>
            )}
          </Col>
          <Col xs={24} lg={10}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Health Distribution</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>RAG status across all projects</Text>
            </div>
            {ragDonutData.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <Pie data={ragDonutData} angleField="value" colorField="status"
                  innerRadius={0.65} height={280} theme="classic"
                  scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                  label={false} legend={false} />
                <div className="donut-center-label">
                  <div className="donut-value">{activeProjects.length}</div>
                  <div className="donut-sub">Active</div>
                </div>
                <div style={{ position: 'absolute', right: 0, top: 24 }}>
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
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="No data" />
              </div>
            )}
          </Col>
        </Row>
      </div>

      {/* Application Comparison */}
      <div className="analytics-chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">Application Comparison</div>
        <Row gutter={24}>
          <Col xs={24} lg={8}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Progress by Application</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Average deployment % per platform</Text>
            </div>
            {appProgressData.length > 0 ? (
              <Bar data={appProgressData} xField="app" yField="progress"
                height={Math.max(180, appProgressData.length * 56)} theme="classic"
                style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{ x: { title: false }, y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] } }}
                label={{ text: (d: any) => `${d.progress}%`, fontSize: 11 }} legend={false} />
            ) : <Empty description="No data" />}
          </Col>
          <Col xs={24} lg={8}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Risk by Application</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Average risk per platform</Text>
            </div>
            {appRiskData.length > 0 ? (
              <Bar data={appRiskData} xField="app" yField="riskScore"
                height={Math.max(180, appRiskData.length * 56)} theme="classic"
                style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{ x: { title: false }, y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] } }}
                label={{ text: 'riskScore', fontSize: 11 }} legend={false} />
            ) : <Empty description="No data" />}
          </Col>
          <Col xs={24} lg={8}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Priority Distribution</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>All active projects by priority</Text>
            </div>
            {priorityData.length > 0 ? (
              <Bar data={priorityData} xField="priority" yField="count"
                height={Math.max(180, priorityData.length * 48)} theme="classic"
                style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{ x: { title: false }, y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] } }}
                label={{ text: 'count', fontSize: 11 }} legend={false} />
            ) : <Empty description="No data" />}
          </Col>
        </Row>
      </div>

      {/* All Projects Table */}
      <div className="analytics-chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>All Active Projects</div>
          <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/tracker?app=all')}>
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
          locale={{ emptyText: <Empty description="No active projects" /> }}
        />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
