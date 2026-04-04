import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, Tooltip, Space, Segmented,
  DatePicker, Button, Empty, Progress, Table, Tag
} from 'antd';
import {
  FilterOutlined, CaretUpOutlined, CaretDownOutlined, InfoCircleOutlined,
  BarChartOutlined, AppstoreOutlined, MedicineBoxOutlined, CheckCircleOutlined,
  WarningOutlined, ExperimentOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import CommercialDashboardClassic from './CommercialDashboardClassic';
import '../../styles/dashboard-analytics.css';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

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

const VIEW_KEY = 'commercial_dashboard_view';
const getStoredView = () => (localStorage.getItem(VIEW_KEY) as 'analytics' | 'classic') || 'analytics';

const CommercialDashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'analytics' | 'classic'>(getStoredView);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: allWorkItems = [] } = useWorkItems();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const workItems = useMemo(() => {
    let items = allWorkItems.filter((wi: any) => wi.application === 'Commercial');
    if (filterPriority) items = items.filter((wi: any) => wi.priority === filterPriority);
    if (filterStatus) items = items.filter((wi: any) => wi.status === filterStatus);
    if (dateRange) {
      items = items.filter((wi: any) => {
        if (!wi.goLiveDate) return true;
        const d = dayjs(wi.goLiveDate);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    return items;
  }, [allWorkItems, filterPriority, filterStatus, dateRange]);

  const activeItems = workItems.filter((wi: any) => wi.status === 'Active');
  const completedItems = workItems.filter((wi: any) => ['Complete', 'Completed', 'Done'].includes(wi.status));

  const avgDeployment = useMemo(() => {
    if (activeItems.length === 0) return 0;
    return Math.round(activeItems.reduce((s: number, wi: any) => s + (wi.deploymentPct || 0), 0) / activeItems.length);
  }, [activeItems]);

  const ragDist = useMemo(() => {
    const d = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const wi of activeItems) {
      const r = getRAG(wi); if (r in d) d[r as keyof typeof d]++; else d.GREEN++;
    }
    return d;
  }, [activeItems]);

  const totalRiskScore = useMemo(() =>
    activeItems.reduce((s: number, wi: any) => s + (wi.riskScore || 0), 0), [activeItems]);

  // Test Summary
  const testSummary = useMemo(() => {
    let passed = 0, total = 0;
    for (const wi of activeItems) { passed += wi.testPassed || 0; total += wi.testTotal || 0; }
    return { passed, total, rate: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }, [activeItems]);

  // Upcoming Go-Lives
  const upcomingGoLives = useMemo(() =>
    activeItems
      .filter((wi: any) => wi.goLiveDate && daysFromNow(wi.goLiveDate) >= 0 && daysFromNow(wi.goLiveDate) <= 90)
      .sort((a: any, b: any) => dayjs(a.goLiveDate).diff(dayjs(b.goLiveDate)))
      .slice(0, 5),
    [activeItems]);

  // Chart: By Phase
  const phaseChartData = useMemo(() => {
    const phases = ['Planning', 'Pre-Launch', 'Execution', 'Monitoring', 'Close-Out'];
    const data: { phase: string; count: number; status: string }[] = [];
    for (const phase of phases) {
      const pi = activeItems.filter((wi: any) => (wi.currentPhase || 'Planning') === phase);
      for (const [ragKey, label] of [['GREEN', 'On Track'], ['AMBER', 'At Risk'], ['RED', 'Critical']] as const) {
        const count = pi.filter((wi: any) => getRAG(wi) === ragKey).length;
        if (count > 0) data.push({ phase, count, status: label });
      }
    }
    return data;
  }, [activeItems]);

  // Donut: By Type
  const typeDonutData = useMemo(() => {
    const types: Record<string, number> = {};
    for (const wi of workItems) types[wi.workItemType || 'Other'] = (types[wi.workItemType || 'Other'] || 0) + 1;
    return Object.entries(types).map(([type, value]) => ({ type, value }));
  }, [workItems]);

  // Bar: By Priority
  const priorityBarData = useMemo(() => {
    const pr: Record<string, number> = {};
    for (const wi of activeItems) pr[wi.priority || 'N/A'] = (pr[wi.priority || 'N/A'] || 0) + 1;
    return Object.entries(pr).map(([priority, count]) => ({ priority, count })).sort((a, b) => a.priority.localeCompare(b.priority));
  }, [activeItems]);

  // Bar: Complexity
  const complexityBarData = useMemo(() => {
    const cx: Record<string, number> = {};
    for (const wi of activeItems) cx[wi.complexity || 'N/A'] = (cx[wi.complexity || 'N/A'] || 0) + 1;
    return Object.entries(cx).map(([complexity, count]) => ({ complexity, count })).sort((a, b) => b.count - a.count);
  }, [activeItems]);

  // Risk distribution
  const riskBucketData = useMemo(() => {
    const buckets = { 'Low (0-30)': 0, 'Medium (31-60)': 0, 'High (61-80)': 0, 'Critical (81+)': 0 };
    for (const wi of activeItems) {
      const r = wi.riskScore || 0;
      if (r <= 30) buckets['Low (0-30)']++;
      else if (r <= 60) buckets['Medium (31-60)']++;
      else if (r <= 80) buckets['High (61-80)']++;
      else buckets['Critical (81+)']++;
    }
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
  }, [activeItems]);

  // Go-Live table columns
  const goLiveCols = [
    { title: 'Initiative', dataIndex: 'workItemName', key: 'name', ellipsis: true,
      render: (t: string, r: any) => <a onClick={() => navigate(`/workitem/${r.ID}`)}>{t}</a> },
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

  const priorities = [...new Set(workItems.map((w: any) => w.priority).filter(Boolean))].sort();
  const statuses = [...new Set(workItems.map((w: any) => w.status).filter(Boolean))];

  const typeColors = [C.purple, C.accent, C.green, C.orange, C.cyan, C.pink, C.amber, C.red];
  const typeColorMap: Record<string, string> = {};
  typeDonutData.forEach((d, i) => { typeColorMap[d.type] = typeColors[i % typeColors.length]; });

  const handleViewChange = (val: string | number) => {
    const v = val as 'analytics' | 'classic';
    setViewMode(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  if (viewMode === 'classic') {
    return (
      <div>
        <div className="dashboard-view-toggle" style={{ padding: '12px 0' }}>
          <Title level={4} style={{ margin: 0 }}><MedicineBoxOutlined /> Commercial Life Sciences</Title>
          <Segmented
            options={[
              { label: <span><AppstoreOutlined /> Classic</span>, value: 'classic' },
              { label: <span><BarChartOutlined /> Analytics</span>, value: 'analytics' },
            ]}
            value={viewMode}
            onChange={handleViewChange}
          />
        </div>
        <CommercialDashboardClassic />
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-view-toggle">
        <div>
          <Text style={{ color: C.textSec, fontSize: 13 }}>
            SAP PM Command Center / <Text strong style={{ fontSize: 13 }}>Commercial Initiatives Analytics</Text>
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
        <Select placeholder="Priority" allowClear value={filterPriority} onChange={setFilterPriority}
          style={{ width: 120 }} options={priorities.map((p: string) => ({ value: p, label: p }))} />
        <Select placeholder="Status" allowClear value={filterStatus} onChange={setFilterStatus}
          style={{ width: 140 }} options={statuses.map((s: string) => ({ value: s, label: s }))} />
        <Button icon={<FilterOutlined />}>Filters</Button>
      </div>

      {/* KPI Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi" onClick={() => navigate('/tracker')} style={{ cursor: 'pointer' }}>
            <div className="kpi-label"><MedicineBoxOutlined /> Active Initiatives</div>
            <div className="kpi-value">{activeItems.length}</div>
            <div className="kpi-delta positive"><CaretUpOutlined /> {ragDist.GREEN} on track</div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">Risk Score <Tooltip title="Aggregate risk"><InfoCircleOutlined style={{ fontSize: 11 }} /></Tooltip></div>
            <div className="kpi-value">{totalRiskScore}</div>
            <div className={`kpi-delta ${totalRiskScore > 150 ? 'negative' : 'positive'}`}>
              {totalRiskScore > 150 ? <><CaretUpOutlined /> Elevated</> : <><CaretDownOutlined /> Normal</>}
            </div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">Avg Progress</div>
            <div className="kpi-value">{avgDeployment}<span style={{ fontSize: 18, opacity: 0.5 }}>%</span></div>
            <div className="kpi-delta neutral">Across active initiatives</div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">Total Items</div>
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

      {/* Mini Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}><ExperimentOutlined /> Test Pass</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{testSummary.rate}%</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{testSummary.passed}/{testSummary.total}</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}><CheckCircleOutlined /> Completed</div>
            <div className="kpi-value" style={{ fontSize: 24, color: C.green }}>{completedItems.length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>of {workItems.length}</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}><WarningOutlined /> Critical</div>
            <div className="kpi-value" style={{ fontSize: 24, color: C.red }}>{ragDist.RED}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>need attention</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>At Risk</div>
            <div className="kpi-value" style={{ fontSize: 24, color: C.amber }}>{ragDist.AMBER}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>monitored</Text>
          </div>
        </Col>
        <Col xs={16} lg={8}>
          <div className="analytics-kpi" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div className="kpi-label" style={{ justifyContent: 'center' }}>Go-Lives ≤90d</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{upcomingGoLives.length}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>upcoming launches</Text>
          </div>
        </Col>
      </Row>

      {/* Overall Trends */}
      <div className="analytics-chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">Commercial Lifecycle Analysis</div>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Initiatives by Phase & Health</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Commercial lifecycle phases</Text>
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
              <Column data={phaseChartData} xField="phase" yField="count" colorField="status"
                stack={true} height={280} theme="classic"
                scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                style={{ maxWidth: 40, radiusTopLeft: 4, radiusTopRight: 4 }}
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
              <Text strong style={{ fontSize: 14 }}>Initiatives by Type</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Commercial initiative categories</Text>
            </div>
            {typeDonutData.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <Pie data={typeDonutData} angleField="value" colorField="type"
                  innerRadius={0.65} height={280} theme="classic"
                  scale={{ color: { range: typeDonutData.map(d => typeColorMap[d.type]) } }}
                  label={false} legend={false} />
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

      {/* Comparison */}
      <div className="analytics-chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title">Initiative Breakdown</div>
        <Row gutter={24}>
          <Col xs={24} lg={8}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Priority Distribution</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Active items by priority level</Text>
            </div>
            {priorityBarData.length > 0 ? (
              <Bar data={priorityBarData} xField="priority" yField="count"
                height={Math.max(180, priorityBarData.length * 48)} theme="classic"
                style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{ x: { title: false }, y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] } }}
                label={{ text: 'count', fontSize: 11 }} legend={false} />
            ) : <Empty description="No data" />}
          </Col>
          <Col xs={24} lg={8}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Complexity Breakdown</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Active items by complexity</Text>
            </div>
            {complexityBarData.length > 0 ? (
              <Bar data={complexityBarData} xField="complexity" yField="count"
                height={Math.max(180, complexityBarData.length * 48)} theme="classic"
                style={{ fill: C.cyan, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{ x: { title: false }, y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] } }}
                label={{ text: 'count', fontSize: 11 }} legend={false} />
            ) : <Empty description="No data" />}
          </Col>
          <Col xs={24} lg={8}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Risk Distribution</Text>
              <br /><Text type="secondary" style={{ fontSize: 12 }}>Items by risk score range</Text>
            </div>
            {riskBucketData.some(d => d.count > 0) ? (
              <Bar data={riskBucketData} xField="bucket" yField="count"
                height={Math.max(180, riskBucketData.length * 48)} theme="classic"
                style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                axis={{ x: { title: false }, y: { title: false, gridStroke: '#f0f0f0', gridLineDash: [3, 3] } }}
                label={{ text: 'count', fontSize: 11 }} legend={false} />
            ) : <Empty description="No data" />}
          </Col>
        </Row>
      </div>

      {/* Upcoming Go-Lives */}
      {upcomingGoLives.length > 0 && (
        <div className="analytics-chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="chart-title" style={{ marginBottom: 0 }}>Upcoming Commercial Launches</div>
            <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/tracker')}>View All →</Button>
          </div>
          <Table dataSource={upcomingGoLives} columns={goLiveCols} rowKey="ID" size="small" pagination={false} scroll={{ x: 500 }} />
        </div>
      )}
    </div>
  );
};

export default CommercialDashboard;
