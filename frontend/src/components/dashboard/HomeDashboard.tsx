import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, ConfigProvider, theme, Tooltip, Space,
  DatePicker, Button, Empty
} from 'antd';
import {
  FilterOutlined, CaretUpOutlined, CaretDownOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems, useTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import '../../styles/dashboard-dark.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Eramind color palette
const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  text: 'rgba(255,255,255,0.87)', textSec: 'rgba(255,255,255,0.45)',
  accent: '#58a6ff', green: '#3fb950', red: '#f85149', amber: '#d29922',
  orange: '#ff8c00', purple: '#bc8cff', cyan: '#39d2c0', pink: '#f778ba',
};

function getRAG(wi: any): string {
  return wi.overallRAG || calculateRAG({
    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
    status: wi.status, overallRAG: wi.overallRAG,
  });
}

const HomeDashboard: React.FC = () => {
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

  // Filter option values
  const priorities = [...new Set(workItems.map((w: any) => w.priority).filter(Boolean))].sort();
  const statuses = [...new Set(workItems.map((w: any) => w.status).filter(Boolean))];
  const modules = [...new Set(workItems.map((w: any) => w.sapModule).filter(Boolean))].sort();

  const typeColors = [C.orange, C.accent, C.red, C.green, C.purple, C.cyan, C.pink];
  const typeColorMap: Record<string, string> = {};
  typeDonutData.forEach((d, i) => { typeColorMap[d.type] = typeColors[i % typeColors.length]; });

  const darkTheme = {
    algorithm: theme.darkAlgorithm,
    token: { colorBgContainer: C.card, colorBorderSecondary: C.border, borderRadius: 8, colorPrimary: C.accent },
  };

  return (
    <ConfigProvider theme={darkTheme}>
      <div className="eramind-dashboard">
        {/* ── Breadcrumb ── */}
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: C.textSec, fontSize: 13 }}>
            Dashboards / <Text style={{ color: C.text, fontSize: 13 }}>SAP Projects</Text>
          </Text>
        </div>

        {/* ── Filter Bar ── */}
        <div className="eramind-filter-bar">
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
            <div className="eramind-kpi" onClick={() => navigate('/tracker')} style={{ cursor: 'pointer' }}>
              <div className="kpi-label">Active Projects</div>
              <div className="kpi-value">{activeItems.length}</div>
              <div className="kpi-delta positive">
                <CaretUpOutlined /> {ragDist.GREEN} on track
              </div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
              <div className="kpi-label">
                Risk Score <Tooltip title="Sum of risk scores across active items"><InfoCircleOutlined style={{ fontSize: 11 }} /></Tooltip>
              </div>
              <div className="kpi-value">{totalRiskScore}</div>
              <div className={`kpi-delta ${totalRiskScore > 200 ? 'negative' : 'positive'}`}>
                {totalRiskScore > 200 ? <><CaretUpOutlined /> High risk</> : <><CaretDownOutlined /> Low risk</>}
              </div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
              <div className="kpi-label">
                Avg Deployment <Tooltip title="Average deployment % across active items"><InfoCircleOutlined style={{ fontSize: 11 }} /></Tooltip>
              </div>
              <div className="kpi-value">{avgDeployment}<span style={{ fontSize: 18, opacity: 0.5 }}>%</span></div>
              <div className="kpi-delta neutral">
                Pipeline: {pipeline.prd}/{pipeline.total} in PRD
              </div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
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

        {/* ── Overall Trends ── */}
        <div className="eramind-chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-title">Overall trends</div>
          <Row gutter={24}>
            {/* Left: Column chart - Projects by phase & health */}
            <Col xs={24} lg={14}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Projects by phase &amp; health</Text>
                <br />
                <Text style={{ color: C.textSec, fontSize: 12 }}>Active work items grouped by current phase</Text>
              </div>
              <Space size={16} style={{ marginBottom: 12 }}>
                {[['On Track', C.green], ['At Risk', C.amber], ['Critical', C.red]].map(([label, color]) => (
                  <Space key={label as string} size={4}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: color as string }} />
                    <Text style={{ color: C.textSec, fontSize: 12 }}>{label}</Text>
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
                  theme="classicDark"
                  scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                  style={{ maxWidth: 40, radiusTopLeft: 4, radiusTopRight: 4 }}
                  axis={{
                    x: { title: false, labelFill: C.textSec, line: null, tick: null },
                    y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] },
                  }}
                  legend={false}
                />
              ) : (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />
                </div>
              )}
            </Col>

            {/* Right: Donut chart - Items by type */}
            <Col xs={24} lg={10}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Items by type</Text>
                <br />
                <Text style={{ color: C.textSec, fontSize: 12 }}>Distribution across project categories</Text>
              </div>
              {typeDonutData.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <Pie
                    data={typeDonutData}
                    angleField="value"
                    colorField="type"
                    innerRadius={0.65}
                    height={280}
                    theme="classicDark"
                    scale={{ color: { range: typeDonutData.map(d => typeColorMap[d.type]) } }}
                    label={false}
                    legend={false}
                  />
                  {/* Center label */}
                  <div className="donut-center-label">
                    <div className="donut-value">{workItems.length}</div>
                    <div className="donut-sub">Items</div>
                  </div>
                  {/* Custom legend */}
                  <div style={{ position: 'absolute', right: 0, top: 24 }}>
                    <div className="eramind-legend">
                      {typeDonutData.map(({ type, value }) => (
                        <div key={type} className="eramind-legend-item">
                          <div className="eramind-legend-dot" style={{ background: typeColorMap[type] }} />
                          <span>{type}: {Math.round((value / (workItems.length || 1)) * 100)}%</span>
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

        {/* ── Module Comparison ── */}
        <div className="eramind-chart-card">
          <div className="chart-title">Module comparison</div>
          <Row gutter={24}>
            {/* Left: Items by module */}
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Items by SAP module</Text>
                <br />
                <Text style={{ color: C.textSec, fontSize: 12 }}>Active work items per functional area</Text>
              </div>
              {moduleBarData.length > 0 ? (
                <Bar
                  data={moduleBarData}
                  xField="module"
                  yField="count"
                  height={Math.max(200, moduleBarData.length * 48)}
                  theme="classicDark"
                  style={{ fill: C.orange, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{
                    x: { title: false, labelFill: C.textSec },
                    y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] },
                  }}
                  label={{ text: 'count', fill: C.text, fontSize: 11 }}
                  legend={false}
                />
              ) : (
                <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />
              )}
            </Col>
            {/* Right: Risk score by module */}
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Risk score by module</Text>
                <br />
                <Text style={{ color: C.textSec, fontSize: 12 }}>Average risk score per functional area</Text>
              </div>
              {moduleRiskData.length > 0 ? (
                <Bar
                  data={moduleRiskData}
                  xField="module"
                  yField="riskScore"
                  height={Math.max(200, moduleRiskData.length * 48)}
                  theme="classicDark"
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{
                    x: { title: false, labelFill: C.textSec },
                    y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] },
                  }}
                  label={{ text: 'riskScore', fill: C.text, fontSize: 11 }}
                  legend={false}
                />
              ) : (
                <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />
              )}
            </Col>
          </Row>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default HomeDashboard;
