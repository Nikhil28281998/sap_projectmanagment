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
import { useWorkItems } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import '../../styles/dashboard-dark.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  text: 'rgba(255,255,255,0.87)', textSec: 'rgba(255,255,255,0.45)',
  accent: '#58a6ff', green: '#3fb950', red: '#f85149', amber: '#d29922',
  orange: '#ff8c00', purple: '#bc8cff', cyan: '#39d2c0', pink: '#f778ba',
  blue: '#1f6feb',
};

function getRAG(wi: any): string {
  return wi.overallRAG || calculateRAG({
    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
    status: wi.status, overallRAG: wi.overallRAG,
  });
}

const CoupaDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: allWorkItems = [] } = useWorkItems();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const workItems = useMemo(() => {
    let items = allWorkItems.filter((wi: any) => wi.application === 'Coupa');
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

  const avgDeployment = useMemo(() => {
    if (activeItems.length === 0) return 0;
    return Math.round(activeItems.reduce((s: number, wi: any) => s + (wi.deploymentPct || 0), 0) / activeItems.length);
  }, [activeItems]);

  const ragDist = useMemo(() => {
    const d = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const wi of activeItems) {
      const r = getRAG(wi);
      if (r in d) d[r as keyof typeof d]++; else d.GREEN++;
    }
    return d;
  }, [activeItems]);

  const totalRiskScore = useMemo(() =>
    activeItems.reduce((s: number, wi: any) => s + (wi.riskScore || 0), 0), [activeItems]);

  // Chart: By Phase & Health
  const phaseChartData = useMemo(() => {
    const phases = ['Design', 'Configure', 'Build', 'Test', 'Deploy', 'Optimize'];
    const data: { phase: string; count: number; status: string }[] = [];
    for (const phase of phases) {
      const pi = activeItems.filter((wi: any) => (wi.currentPhase || 'Design') === phase);
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

  // Bar: UAT Status
  const uatBarData = useMemo(() => {
    const uat: Record<string, number> = {};
    for (const wi of activeItems) uat[wi.uatStatus || 'Not Started'] = (uat[wi.uatStatus || 'Not Started'] || 0) + 1;
    return Object.entries(uat).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  }, [activeItems]);

  const priorities = [...new Set(workItems.map((w: any) => w.priority).filter(Boolean))].sort();
  const statuses = [...new Set(workItems.map((w: any) => w.status).filter(Boolean))];

  const typeColors = [C.blue, C.green, C.orange, C.purple, C.cyan, C.pink, C.amber, C.red];
  const typeColorMap: Record<string, string> = {};
  typeDonutData.forEach((d, i) => { typeColorMap[d.type] = typeColors[i % typeColors.length]; });

  const darkTheme = {
    algorithm: theme.darkAlgorithm,
    token: { colorBgContainer: C.card, colorBorderSecondary: C.border, borderRadius: 8, colorPrimary: C.accent },
  };

  return (
    <ConfigProvider theme={darkTheme}>
      <div className="eramind-dashboard">
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: C.textSec, fontSize: 13 }}>
            Dashboards / <Text style={{ color: C.text, fontSize: 13 }}>Coupa Projects</Text>
          </Text>
        </div>

        <div className="eramind-filter-bar">
          <RangePicker size="middle" onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
          <Select placeholder="Priority" allowClear value={filterPriority}
            onChange={setFilterPriority} style={{ width: 120 }}
            options={priorities.map((p: string) => ({ value: p, label: p }))} />
          <Select placeholder="Status" allowClear value={filterStatus}
            onChange={setFilterStatus} style={{ width: 140 }}
            options={statuses.map((s: string) => ({ value: s, label: s }))} />
          <Button icon={<FilterOutlined />}>Filters</Button>
        </div>

        {/* KPI Cards */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi" onClick={() => navigate('/tracker')} style={{ cursor: 'pointer' }}>
              <div className="kpi-label">Active Deliverables</div>
              <div className="kpi-value">{activeItems.length}</div>
              <div className="kpi-delta positive"><CaretUpOutlined /> {ragDist.GREEN} on track</div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
              <div className="kpi-label">Risk Score <Tooltip title="Aggregate risk"><InfoCircleOutlined style={{ fontSize: 11 }} /></Tooltip></div>
              <div className="kpi-value">{totalRiskScore}</div>
              <div className={`kpi-delta ${totalRiskScore > 150 ? 'negative' : 'positive'}`}>
                {totalRiskScore > 150 ? <><CaretUpOutlined /> Elevated</> : <><CaretDownOutlined /> Normal</>}
              </div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
              <div className="kpi-label">Avg Progress</div>
              <div className="kpi-value">{avgDeployment}<span style={{ fontSize: 18, opacity: 0.5 }}>%</span></div>
              <div className="kpi-delta neutral">Across active deliverables</div>
            </div>
          </Col>
          <Col xs={12} lg={6}>
            <div className="eramind-kpi">
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

        {/* Overall Trends */}
        <div className="eramind-chart-card" style={{ marginBottom: 20 }}>
          <div className="chart-title">Overall trends</div>
          <Row gutter={24}>
            <Col xs={24} lg={14}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Deliverables by phase &amp; health</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>Coupa implementation lifecycle</Text>
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
                <Column data={phaseChartData} xField="phase" yField="count" colorField="status"
                  stack={true} height={280} theme="classicDark"
                  scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                  style={{ maxWidth: 40, radiusTopLeft: 4, radiusTopRight: 4 }}
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
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Items by type</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>Coupa project categories</Text>
              </div>
              {typeDonutData.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <Pie data={typeDonutData} angleField="value" colorField="type"
                    innerRadius={0.65} height={280} theme="classicDark"
                    scale={{ color: { range: typeDonutData.map(d => typeColorMap[d.type]) } }}
                    label={false} legend={false} />
                  <div className="donut-center-label">
                    <div className="donut-value">{workItems.length}</div>
                    <div className="donut-sub">Items</div>
                  </div>
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

        {/* Comparison */}
        <div className="eramind-chart-card">
          <div className="chart-title">Deliverable comparison</div>
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>Items by priority</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>Active deliverables by priority level</Text>
              </div>
              {priorityBarData.length > 0 ? (
                <Bar data={priorityBarData} xField="priority" yField="count"
                  height={Math.max(200, priorityBarData.length * 48)} theme="classicDark"
                  style={{ fill: C.orange, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false, labelFill: C.textSec }, y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fill: C.text, fontSize: 11 }} legend={false} />
              ) : <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />}
            </Col>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>UAT status breakdown</Text>
                <br /><Text style={{ color: C.textSec, fontSize: 12 }}>Testing status across active deliverables</Text>
              </div>
              {uatBarData.length > 0 ? (
                <Bar data={uatBarData} xField="status" yField="count"
                  height={Math.max(200, uatBarData.length * 48)} theme="classicDark"
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false, labelFill: C.textSec }, y: { title: false, labelFill: C.textSec, gridStroke: C.border, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fill: C.text, fontSize: 11 }} legend={false} />
              ) : <Empty description={<Text style={{ color: C.textSec }}>No data</Text>} />}
            </Col>
          </Row>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default CoupaDashboard;
