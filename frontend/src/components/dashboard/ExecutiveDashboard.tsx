import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, ConfigProvider, theme, Tooltip, Space,
  DatePicker, Button, Empty, Table, Tag
} from 'antd';
import {
  FilterOutlined, CaretUpOutlined, CaretDownOutlined, InfoCircleOutlined,
  ApartmentOutlined, ShoppingCartOutlined, MedicineBoxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import '../../styles/dashboard-dark.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  text: 'rgba(255,255,255,0.87)', textSec: 'rgba(255,255,255,0.45)',
  accent: '#58a6ff', green: '#3fb950', red: '#f85149', amber: '#d29922',
  orange: '#ff8c00', purple: '#bc8cff', cyan: '#39d2c0', pink: '#f778ba',
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

const ExecutiveDashboard: React.FC = () => {
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

  const availableApps = ['SAP', 'Coupa', 'Commercial'].filter(a => allowedApps.includes(a));

  // Project table columns
  const tableCols = [
    {
      title: 'Application', dataIndex: 'application', key: 'app', width: 110,
      render: (app: string) => <Tag style={{ color: APP_COLORS[app], borderColor: APP_COLORS[app], background: 'transparent' }} icon={APP_ICONS[app]}>{app}</Tag>,
    },
    {
      title: 'Project', dataIndex: 'workItemName', key: 'name', ellipsis: true,
      render: (t: string, r: any) => <a style={{ color: C.accent }} onClick={() => navigate(`/workitem/${r.ID}`)}>{t}</a>,
    },
    {
      title: 'Type', dataIndex: 'workItemType', key: 'type', width: 120,
      render: (t: string) => <Tag style={{ background: 'transparent', borderColor: C.border, color: C.textSec }}>{t}</Tag>,
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
      render: (d: string) => d ? <Text style={{ color: C.textSec, fontSize: 12 }}>{d} ({daysFromNow(d)}d)</Text> : <Text style={{ color: C.textSec }}>—</Text>,
    },
    {
      title: 'Progress', dataIndex: 'deploymentPct', key: 'pct', width: 90,
      render: (pct: number) => <Text style={{ color: C.text }}>{pct || 0}%</Text>,
    },
  ];

  const darkTheme = {
    algorithm: theme.darkAlgorithm,
    token: { colorBgContainer: C.card, colorBorderSecondary: C.border, borderRadius: 8, colorPrimary: C.accent },
  };

  return (
    <ConfigProvider theme={darkTheme}>
      <div className="eramind-dashboard">
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: C.textSec, fontSize: 13 }}>
            Dashboards / <Text style={{ color: C.text, fontSize: 13 }}>Executive Overview</Text>
          </Text>
        </div>

        <div className="eramind-filter-bar">
          <RangePicker size="middle" onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
          <Select placeholder="Application" allowClear value={filterApp} onChange={setFilterApp}
            style={{ width: 160 }} options={availableApps.map(a => ({ value: a, label: a }))} />
          <Button icon={<FilterOutlined />}>Filters</Button>
        </div>

        {/* KPI Cards */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi" onClick={() => navigate('/tracker?app=all')} style={{ cursor: 'pointer' }}>
              <div className="kpi-label">Active Projects</div>
              <div className="kpi-value">{activeProjects.length}</div>
              <div className="kpi-delta positive"><CaretUpOutlined /> {ragDist.GREEN} on track</div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
              <div className="kpi-label">Completed</div>
              <div className="kpi-value" style={{ color: C.green }}>{completedCount}</div>
              <div className="kpi-delta neutral">Across all applications</div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
              <div className="kpi-label">Avg Progress</div>
              <div className="kpi-value">{avgDeployment}<span style={{ fontSize: 18, opacity: 0.5 }}>%</span></div>
              <div className="kpi-delta neutral">Test pass: {testSummary.rate}%</div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
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

        {/* Overall Trends */}
        <div className="eramind-chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-title">Portfolio overview</div>
          <Row gutter={24}>
            <Col xs={24} lg={14}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Projects by application &amp; health</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>Cross-platform portfolio distribution</Text>
              </div>
              <Space size={16} style={{ marginBottom: 12 }}>
                {[['On Track', C.green], ['At Risk', C.amber], ['Critical', C.red]].map(([label, color]) => (
                  <Space key={label as string} size={4}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: color as string }} />
                    <Text style={{ color: C.textSec, fontSize: 12 }}>{label}</Text>
                  </Space>
                ))}
              </Space>
              {appChartData.length > 0 ? (
                <Column data={appChartData} xField="app" yField="count" colorField="status"
                  stack={true} height={280} theme="classicDark"
                  scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                  style={{ maxWidth: 60, radiusTopLeft: 4, radiusTopRight: 4 }}
                  axis={{
                    x: { title: false, labelFill: C.textSec, line: null, tick: null },
                    y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] },
                  }}
                  legend={false} />
              ) : (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />
                </div>
              )}
            </Col>
            <Col xs={24} lg={10}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Health distribution</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>RAG status across all projects</Text>
              </div>
              {ragDonutData.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <Pie data={ragDonutData} angleField="value" colorField="status"
                    innerRadius={0.65} height={280} theme="classicDark"
                    scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                    label={false} legend={false} />
                  <div className="donut-center-label">
                    <div className="donut-value">{activeProjects.length}</div>
                    <div className="donut-sub">Active</div>
                  </div>
                  <div style={{ position: 'absolute', right: 0, top: 24 }}>
                    <div className="eramind-legend">
                      {ragDonutData.map(({ status, value }) => (
                        <div key={status} className="eramind-legend-item">
                          <div className="eramind-legend-dot" style={{ background: status === 'On Track' ? C.green : status === 'At Risk' ? C.amber : C.red }} />
                          <span>{status}: {value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />
                </div>
              )}
            </Col>
          </Row>
        </div>

        {/* Application Comparison */}
        <div className="eramind-chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-title">Application comparison</div>
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Progress by application</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>Average deployment % per platform</Text>
              </div>
              {appProgressData.length > 0 ? (
                <Bar data={appProgressData} xField="app" yField="progress"
                  height={Math.max(180, appProgressData.length * 56)} theme="classicDark"
                  style={{ fill: C.orange, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false, labelFill: C.textSec }, y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] } }}
                  label={{ text: (d: any) => `${d.progress}%`, fill: C.text, fontSize: 11 }} legend={false} />
              ) : <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />}
            </Col>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Risk score by application</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>Average risk per platform</Text>
              </div>
              {appRiskData.length > 0 ? (
                <Bar data={appRiskData} xField="app" yField="riskScore"
                  height={Math.max(180, appRiskData.length * 56)} theme="classicDark"
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false, labelFill: C.textSec }, y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] } }}
                  label={{ text: 'riskScore', fill: C.text, fontSize: 11 }} legend={false} />
              ) : <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />}
            </Col>
          </Row>
        </div>

        {/* All Projects Table */}
        <div className="eramind-chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="chart-title" style={{ marginBottom: 0 }}>All active projects</div>
            <Button type="link" style={{ color: C.accent, padding: 0 }} onClick={() => navigate('/tracker?app=all')}>
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
            locale={{ emptyText: <Empty description={<Text style={{ color: C.textSec }}>No active projects</Text>} /> }}
          />
        </div>
      </div>
    </ConfigProvider>
  );
};

export default ExecutiveDashboard;
