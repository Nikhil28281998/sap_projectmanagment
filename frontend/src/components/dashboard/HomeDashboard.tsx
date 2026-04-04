import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, Tooltip, Space, Segmented,
  DatePicker, Button, Empty, Progress, Table, Tag
} from 'antd';
import {
  FilterOutlined, CaretUpOutlined, CaretDownOutlined, InfoCircleOutlined,
  BarChartOutlined, AppstoreOutlined, ClockCircleOutlined, ThunderboltOutlined,
  BugOutlined, RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems, useTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import HomeDashboardClassic from './HomeDashboardClassic';
import '../../styles/dashboard-analytics.css';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

// Light theme color palette
const C = {
  bg: '#f0f2f5', card: '#ffffff', border: '#e8e8e8',
  text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.45)',
  accent: '#1677ff', green: '#52c41a', red: '#ff4d4f', amber: '#faad14',
  orange: '#fa8c16', purple: '#722ed1', cyan: '#13c2c2', pink: '#eb2f96',
};

function getRAG(wi: any): string {
  return wi.overallRAG || calculateRAG({
    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
    status: wi.status, overallRAG: wi.overallRAG,
  });
}

const VIEW_KEY = 'sap_dashboard_view';
const getStoredView = () => (localStorage.getItem(VIEW_KEY) as 'analytics' | 'classic') || 'analytics';

const HomeDashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'analytics' | 'classic'>(getStoredView);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: allWorkItems = [] } = useWorkItems();
  const { data: transports = [] } = useTransports();

  // Filter state
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterModule, setFilterModule] = useState<string | undefined>();

  // Filter to SAP items
  const workItems = useMemo(() => {
    let items = allWorkItems.filter((wi: any) => wi.application === 'SAP' || !wi.application);
    if (filterPriority) items = items.filter((wi: any) => wi.priority === filterPriority);
    if (filterStatus) items = items.filter((wi: any) => wi.status === filterStatus);
    if (filterModule) items = items.filter((wi: any) => wi.sapModule === filterModule);
    if (dateRange) {
      items = items.filter((wi: any) => {
        if (!wi.goLiveDate) return true;
        const d = dayjs(wi.goLiveDate);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    return items;
  }, [allWorkItems, filterPriority, filterStatus, filterModule, dateRange]);

  const activeItems = workItems.filter((wi: any) => wi.status === 'Active');
  const completedItems = workItems.filter((wi: any) => ['Complete', 'Completed', 'Done'].includes(wi.status));

  // ── KPI Computations ──
  const totalRiskScore = useMemo(() =>
    activeItems.reduce((s: number, wi: any) => s + (wi.riskScore || 0), 0), [activeItems]);

  const avgDeployment = useMemo(() => {
    if (activeItems.length === 0) return 0;
    return Math.round(activeItems.reduce((s: number, wi: any) => s + (wi.deploymentPct || 0), 0) / activeItems.length);
  }, [activeItems]);

  const ragDist = useMemo(() => {
    const d = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const wi of activeItems) {
      const r = getRAG(wi);
      if (r in d) d[r as keyof typeof d]++;
      else d.GREEN++;
    }
    return d;
  }, [activeItems]);

  const pipeline = useMemo(() => ({
    dev: transports.filter((t: any) => t.currentSystem === 'DEV').length,
    qas: transports.filter((t: any) => t.currentSystem === 'QAS').length,
    prd: transports.filter((t: any) => t.currentSystem === 'PRD').length,
    total: transports.length,
  }), [transports]);

  // ── Test Summary ──
  const testSummary = useMemo(() => {
    let passed = 0, total = 0;
    for (const wi of activeItems) { passed += wi.testPassed || 0; total += wi.testTotal || 0; }
    return { passed, total, rate: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }, [activeItems]);

  // ── Upcoming Go-Lives ──
  const upcomingGoLives = useMemo(() =>
    activeItems
      .filter((wi: any) => wi.goLiveDate && daysFromNow(wi.goLiveDate) >= 0 && daysFromNow(wi.goLiveDate) <= 90)
      .sort((a: any, b: any) => dayjs(a.goLiveDate).diff(dayjs(b.goLiveDate)))
      .slice(0, 5),
    [activeItems]);

  // ── Chart: Projects by Phase & Health (Column) ──
  const phaseChartData = useMemo(() => {
    const phases = ['Planning', 'Development', 'Testing', 'Go-Live', 'Hypercare', 'Complete'];
    const data: { phase: string; count: number; status: string }[] = [];
    for (const phase of phases) {
      const phaseItems = activeItems.filter((wi: any) => (wi.currentPhase || 'Planning') === phase);
      for (const [ragKey, label] of [['GREEN', 'On Track'], ['AMBER', 'At Risk'], ['RED', 'Critical']] as const) {
        const count = phaseItems.filter((wi: any) => getRAG(wi) === ragKey).length;
        if (count > 0) data.push({ phase, count, status: label });
      }
    }
    return data;
  }, [activeItems]);

  // ── Chart: Items by Type (Donut) ──
  const typeDonutData = useMemo(() => {
    const types: Record<string, number> = {};
    for (const wi of workItems) {
      const t = wi.workItemType || 'Other';
      types[t] = (types[t] || 0) + 1;
    }
    return Object.entries(types).map(([type, value]) => ({ type, value }));
  }, [workItems]);

  // ── Chart: Items by Module (Horizontal Bar) ──
  const moduleBarData = useMemo(() => {
    const mods: Record<string, number> = {};
    for (const wi of activeItems) {
      const m = wi.sapModule || 'Other';
      mods[m] = (mods[m] || 0) + 1;
    }
    return Object.entries(mods).map(([module, count]) => ({ module, count })).sort((a, b) => b.count - a.count);
  }, [activeItems]);

  // ── Chart: Risk by Module (Horizontal Bar) ──
  const moduleRiskData = useMemo(() => {
    const mods: Record<string, { total: number; count: number }> = {};
    for (const wi of activeItems) {
      const m = wi.sapModule || 'Other';
      if (!mods[m]) mods[m] = { total: 0, count: 0 };
      mods[m].total += wi.riskScore || 0;
      mods[m].count++;
    }
    return Object.entries(mods)
      .map(([module, { total, count }]) => ({ module, riskScore: Math.round(total / count) }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [activeItems]);

  // ── Chart: Priority Distribution ──
  const priorityData = useMemo(() => {
    const pr: Record<string, number> = {};
    for (const wi of activeItems) pr[wi.priority || 'N/A'] = (pr[wi.priority || 'N/A'] || 0) + 1;
    return Object.entries(pr).map(([priority, count]) => ({ priority, count }));
  }, [activeItems]);

  // ── Chart: Transport Pipeline ──
  const pipelineData = useMemo(() => [
    { system: 'DEV', count: pipeline.dev },
    { system: 'QAS', count: pipeline.qas },
    { system: 'PRD', count: pipeline.prd },
  ], [pipeline]);

  // ── Go-live Table Columns ──
  const goLiveCols = [
    { title: 'Work Item', dataIndex: 'workItemName', key: 'name', ellipsis: true,
      render: (t: string, r: any) => <a onClick={() => navigate(`/workitem/${r.ID}`)}>{t}</a> },
    { title: 'Module', dataIndex: 'sapModule', key: 'mod', width: 80, render: (m: string) => <Tag>{m || '—'}</Tag> },
    { title: 'Go-Live', dataIndex: 'goLiveDate', key: 'gl', width: 140,
      render: (d: string) => <Text type="secondary">{d} ({daysFromNow(d)}d)</Text> },
    { title: 'Health', key: 'rag', width: 70, align: 'center' as const,
      render: (_: any, r: any) => {
        const rag = getRAG(r);
        const color = rag === 'GREEN' ? C.green : rag === 'AMBER' ? C.amber : C.red;
        return <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, margin: '0 auto' }} />;
      },
    },
    { title: 'Progress', dataIndex: 'deploymentPct', key: 'pct', width: 100,
      render: (pct: number) => <Progress percent={pct || 0} size="small" /> },
  ];

  // Filter option values
  const priorities = [...new Set(workItems.map((w: any) => w.priority).filter(Boolean))].sort();
  const statuses = [...new Set(workItems.map((w: any) => w.status).filter(Boolean))];
  const modules = [...new Set(workItems.map((w: any) => w.sapModule).filter(Boolean))].sort();

  const typeColors = [C.orange, C.accent, C.red, C.green, C.purple, C.cyan, C.pink];
  const typeColorMap: Record<string, string> = {};
  typeDonutData.forEach((d, i) => { typeColorMap[d.type] = typeColors[i % typeColors.length]; });

  const handleViewChange = (val: string | number) => {
    const v = val as 'analytics' | 'classic';
    setViewMode(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  // Classic view
  if (viewMode === 'classic') {
    return (
      <div>
        <div className="dashboard-view-toggle" style={{ padding: '12px 0' }}>
          <Title level={4} style={{ margin: 0 }}>SAP PM Command Center</Title>
          <Segmented
            options={[
              { label: <span><AppstoreOutlined /> Classic</span>, value: 'classic' },
              { label: <span><BarChartOutlined /> Analytics</span>, value: 'analytics' },
            ]}
            value={viewMode}
            onChange={handleViewChange}
          />
        </div>
        <HomeDashboardClassic />
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* ── Toggle & Breadcrumb ── */}
      <div className="dashboard-view-toggle">
        <div>
          <Text style={{ color: C.textSec, fontSize: 13 }}>
            SAP PM Command Center / <Text strong style={{ fontSize: 13 }}>SAP Projects Analytics</Text>
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

      {/* ── Filter Bar ── */}
      <div className="analytics-filter-bar">
        <RangePicker
          size="middle"
          onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
        />
        <Select placeholder="Priority" allowClear value={filterPriority}
          onChange={setFilterPriority} style={{ width: 120 }}
          options={priorities.map((p: string) => ({ value: p, label: p }))} />
        <Select placeholder="Status" allowClear value={filterStatus}
          onChange={setFilterStatus} style={{ width: 140 }}
          options={statuses.map((s: string) => ({ value: s, label: s }))} />
        <Select placeholder="Module" allowClear value={filterModule}
          onChange={setFilterModule} style={{ width: 140 }}
          options={modules.map((m: string) => ({ value: m, label: m }))} />
        <Button icon={<FilterOutlined />}>Filters</Button>
      </div>

      {/* ── KPI Cards ── */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi" onClick={() => navigate('/tracker')} style={{ cursor: 'pointer' }}>
            <div className="kpi-label"><RocketOutlined /> Active Work Items</div>
            <div className="kpi-value">{activeItems.length}</div>
            <div className="kpi-delta positive">
              <CaretUpOutlined /> {ragDist.GREEN} on track
            </div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">
              <ThunderboltOutlined /> Risk Score <Tooltip title="Sum of risk scores across active items"><InfoCircleOutlined style={{ fontSize: 11 }} /></Tooltip>
            </div>
            <div className="kpi-value">{totalRiskScore}</div>
            <div className={`kpi-delta ${totalRiskScore > 200 ? 'negative' : 'positive'}`}>
              {totalRiskScore > 200 ? <><CaretUpOutlined /> High risk</> : <><CaretDownOutlined /> Low risk</>}
            </div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">
              <ClockCircleOutlined /> Avg Deployment <Tooltip title="Average deployment % across active items"><InfoCircleOutlined style={{ fontSize: 11 }} /></Tooltip>
            </div>
            <div className="kpi-value">{avgDeployment}<span style={{ fontSize: 18, opacity: 0.5 }}>%</span></div>
            <div className="kpi-delta neutral">
              Transport Pipeline: {pipeline.prd}/{pipeline.total} in PRD
            </div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">Total Work Items</div>
            <div className="kpi-value">{workItems.length}</div>
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

      {/* ── Mini Stats Row ── */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}><BugOutlined /> Test Pass Rate</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{testSummary.rate}%</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{testSummary.passed}/{testSummary.total}</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>Completed</div>
            <div className="kpi-value" style={{ fontSize: 24, color: C.green }}>{completedItems.length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>of {workItems.length} total</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>Critical Items</div>
            <div className="kpi-value" style={{ fontSize: 24, color: C.red }}>{ragDist.RED}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>need attention</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>At Risk</div>
            <div className="kpi-value" style={{ fontSize: 24, color: C.amber }}>{ragDist.AMBER}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>being monitored</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>Transports</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{pipeline.total}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>DEV:{pipeline.dev} QAS:{pipeline.qas} PRD:{pipeline.prd}</Text>
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

      {/* ── Overall Trends: Phase & Type ── */}
      <div className="analytics-chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">Project Phase & Type Analysis</div>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Work Items by Phase & Health</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Active items grouped by SAP implementation phase</Text>
            </div>
            <Space size={16} style={{ marginBottom: 12 }}>
              {[['On Track', C.green], ['At Risk', C.amber], ['Critical', C.red]].map(([label, color]) => (
                <Space key={label as string} size={4}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: color as string }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
                </Space>
              ))}
            </Space>
            {phaseChartData.length > 0 ? (
              <Column
                data={phaseChartData}
                xField="phase"
                yField="count"
                colorField="status"
                stack={true}
                height={280}
                theme="classic"
                scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                style={{ maxWidth: 40, radiusTopLeft: 4, radiusTopRight: 4 }}
                axis={{
                  x: { title: false, line: null, tick: null },
                  y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] },
                }}
                legend={false}
              />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="No data" />
              </div>
            )}
          </Col>

          <Col xs={24} lg={10}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Work Items by Type</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Distribution across SAP project categories</Text>
            </div>
            {typeDonutData.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <Pie
                  data={typeDonutData}
                  angleField="value"
                  colorField="type"
                  innerRadius={0.65}
                  height={280}
                  theme="classic"
                  scale={{ color: { range: typeDonutData.map(d => typeColorMap[d.type]) } }}
                  label={false}
                  legend={false}
                />
                <div className="donut-center-label">
                  <div className="donut-value">{workItems.length}</div>
                  <div className="donut-sub">Items</div>
                </div>
                <div style={{ position: 'absolute', right: 0, top: 24 }}>
                  <div className="analytics-legend">
                    {typeDonutData.map(({ type, value }) => (
                      <div key={type} className="analytics-legend-item">
                        <div className="analytics-legend-dot" style={{ background: typeColorMap[type] }} />
                        <span>{type}: {Math.round((value / (workItems.length || 1)) * 100)}%</span>
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

      {/* ── Module Comparison ── */}
      <div className="analytics-chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">SAP Module Analysis</div>
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Items by SAP Module</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Active work items per functional area</Text>
            </div>
            {moduleBarData.length > 0 ? (
              <Bar
                data={moduleBarData}
                xField="module"
                yField="count"
                height={Math.max(200, moduleBarData.length * 48)}
                theme="classic"
                style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{
                  x: { title: false },
                  y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] },
                }}
                label={{ text: 'count', fontSize: 11 }}
                legend={false}
              />
            ) : (
              <Empty description="No data" />
            )}
          </Col>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Risk Score by Module</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Average risk score per functional area</Text>
            </div>
            {moduleRiskData.length > 0 ? (
              <Bar
                data={moduleRiskData}
                xField="module"
                yField="riskScore"
                height={Math.max(200, moduleRiskData.length * 48)}
                theme="classic"
                style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{
                  x: { title: false },
                  y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] },
                }}
                label={{ text: 'riskScore', fontSize: 11 }}
                legend={false}
              />
            ) : (
              <Empty description="No data" />
            )}
          </Col>
        </Row>
      </div>

      {/* ── Priority & Transport Analysis ── */}
      <div className="analytics-chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">Priority & Transport Pipeline</div>
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Priority Distribution</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Active work items by priority level</Text>
            </div>
            {priorityData.length > 0 ? (
              <Bar
                data={priorityData}
                xField="priority"
                yField="count"
                height={Math.max(180, priorityData.length * 48)}
                theme="classic"
                style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{
                  x: { title: false },
                  y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] },
                }}
                label={{ text: 'count', fontSize: 11 }}
                legend={false}
              />
            ) : <Empty description="No data" />}
          </Col>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Transport Pipeline</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Current transport distribution across SAP systems</Text>
            </div>
            {pipelineData.some(d => d.count > 0) ? (
              <Column
                data={pipelineData}
                xField="system"
                yField="count"
                height={220}
                theme="classic"
                style={{ maxWidth: 60, radiusTopLeft: 4, radiusTopRight: 4 }}
                scale={{ color: { range: [C.accent] } }}
                axis={{
                  x: { title: false, line: null, tick: null },
                  y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] },
                }}
                label={{ text: 'count', fontSize: 12 }}
                legend={false}
              />
            ) : <Empty description="No transports" />}
          </Col>
        </Row>
      </div>

      {/* ── Upcoming Go-Lives Table ── */}
      {upcomingGoLives.length > 0 && (
        <div className="analytics-chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="chart-title" style={{ marginBottom: 0 }}>Upcoming Go-Lives (Next 90 Days)</div>
            <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/tracker')}>
              View All →
            </Button>
          </div>
          <Table
            dataSource={upcomingGoLives}
            columns={goLiveCols}
            rowKey="ID"
            size="small"
            pagination={false}
            scroll={{ x: 600 }}
          />
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;
