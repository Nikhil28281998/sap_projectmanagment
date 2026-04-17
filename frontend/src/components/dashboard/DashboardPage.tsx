import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, Tooltip, Space, Segmented,
  DatePicker, Button, Empty, Progress, Table, Tag
} from 'antd';
import {
  FilterOutlined, CaretUpOutlined, CaretDownOutlined, InfoCircleOutlined,
  BarChartOutlined, AppstoreOutlined, RocketOutlined, ShoppingCartOutlined,
  MedicineBoxOutlined, BugOutlined, ClockCircleOutlined, ThunderboltOutlined,
  CheckCircleOutlined, WarningOutlined, ExperimentOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems, useTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import HomeDashboardClassic from './HomeDashboardClassic';
import CoupaDashboardClassic from './CoupaDashboardClassic';
import CommercialDashboardClassic from './CommercialDashboardClassic';
import '../../styles/dashboard-analytics.css';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

// ── Color palettes ──────────────────────────────────────────────────────────

const C_DARK = {
  textSec: 'rgba(255,255,255,0.45)',
  accent: '#58a6ff', green: '#3fb950', red: '#f85149', amber: '#d29922',
  orange: '#f0883e', purple: '#a371f7', cyan: '#39d2c0', pink: '#f778ba',
  grid: '#21262d',
  chartTheme: 'classicDark' as const,
  typeColors: ['#f0883e', '#58a6ff', '#f85149', '#3fb950', '#a371f7', '#39d2c0', '#f778ba'],
};

const C_LIGHT = {
  textSec: 'rgba(0,0,0,0.45)',
  accent: '#1677ff', green: '#52c41a', red: '#ff4d4f', amber: '#faad14',
  orange: '#fa8c16', purple: '#722ed1', cyan: '#13c2c2', pink: '#eb2f96',
  grid: '#f0f0f0',
  chartTheme: 'classic' as const,
  typeColors: ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#ff4d4f'],
};

// ── Per-app configuration ───────────────────────────────────────────────────

interface AppPalette {
  textSec: string;
  accent: string;
  green: string;
  red: string;
  amber: string;
  orange: string;
  purple: string;
  cyan: string;
  pink: string;
  grid: string;
  chartTheme: 'classicDark' | 'classic';
  typeColors: string[];
}

interface AppDashboardConfig {
  viewKey: string;
  breadcrumb: string;
  /** filter predicate applied to allWorkItems */
  appFilter: (wi: any) => boolean;
  itemLabel: string;         // 'Work Items' | 'Deliverables' | 'Initiatives'
  kpiIcon: React.ReactNode;
  riskThreshold: number;
  phases: string[];
  palette: AppPalette;
  /** lifecycle analysis section title */
  lifecycleTitle: string;
  /** subtitle under "By Phase & Health" */
  phaseSubtitle: string;
  typeSubtitle: string;
  /** title for the second chart section */
  extraSectionTitle: string;
  /** go-live table: title of first column */
  goLiveColName: string;
  /** go-live card title */
  goLiveTitle: string;
  /** classic-view header content */
  classicHeader: React.ReactNode;
  ClassicComponent: React.FC;
}

const SAP_CONFIG: AppDashboardConfig = {
  viewKey: 'sap_dashboard_view',
  breadcrumb: 'SAP Projects Analytics',
  appFilter: (wi) => wi.application === 'SAP' || !wi.application,
  itemLabel: 'Work Items',
  kpiIcon: <RocketOutlined />,
  riskThreshold: 200,
  phases: ['Planning', 'Development', 'Testing', 'Go-Live', 'Hypercare', 'Complete'],
  palette: C_DARK,
  lifecycleTitle: 'Project Phase & Type Analysis',
  phaseSubtitle: 'Active items grouped by SAP implementation phase',
  typeSubtitle: 'Distribution across SAP project categories',
  extraSectionTitle: 'SAP Module Analysis',
  goLiveColName: 'Work Item',
  goLiveTitle: 'Upcoming Go-Lives (Next 90 Days)',
  classicHeader: <Title level={4} className="m-0">SAP PM Command Center</Title>,
  ClassicComponent: HomeDashboardClassic,
};

const COUPA_CONFIG: AppDashboardConfig = {
  viewKey: 'coupa_dashboard_view',
  breadcrumb: 'Coupa Deliverables Analytics',
  appFilter: (wi) => wi.application === 'Coupa',
  itemLabel: 'Deliverables',
  kpiIcon: <ShoppingCartOutlined />,
  riskThreshold: 150,
  phases: ['Design', 'Configure', 'Build', 'Test', 'Deploy', 'Optimize'],
  palette: C_LIGHT,
  lifecycleTitle: 'Coupa Implementation Lifecycle Analysis',
  phaseSubtitle: 'Coupa implementation lifecycle status',
  typeSubtitle: 'Coupa project categories',
  extraSectionTitle: 'Deliverable Comparison & Testing',
  goLiveColName: 'Deliverable',
  goLiveTitle: 'Upcoming Coupa Go-Lives',
  classicHeader: <Title level={4} className="m-0"><ShoppingCartOutlined /> Coupa Project Management</Title>,
  ClassicComponent: CoupaDashboardClassic,
};

const COMMERCIAL_CONFIG: AppDashboardConfig = {
  viewKey: 'commercial_dashboard_view',
  breadcrumb: 'Commercial Initiatives Analytics',
  appFilter: (wi) => wi.application === 'Commercial',
  itemLabel: 'Initiatives',
  kpiIcon: <MedicineBoxOutlined />,
  riskThreshold: 150,
  phases: ['Planning', 'Pre-Launch', 'Execution', 'Monitoring', 'Close-Out'],
  palette: C_LIGHT,
  lifecycleTitle: 'Commercial Lifecycle Analysis',
  phaseSubtitle: 'Commercial lifecycle phases',
  typeSubtitle: 'Commercial initiative categories',
  extraSectionTitle: 'Initiative Breakdown',
  goLiveColName: 'Initiative',
  goLiveTitle: 'Upcoming Commercial Launches',
  classicHeader: <Title level={4} className="m-0"><MedicineBoxOutlined /> Commercial Life Sciences</Title>,
  ClassicComponent: CommercialDashboardClassic,
};

const CONFIGS: Record<string, AppDashboardConfig> = {
  SAP: SAP_CONFIG,
  Coupa: COUPA_CONFIG,
  Commercial: COMMERCIAL_CONFIG,
};

// ── Shared helper ────────────────────────────────────────────────────────────

function getRAG(wi: any): string {
  return wi.overallRAG || calculateRAG({
    goLiveDate: wi.goLiveDate, deploymentPct: wi.deploymentPct || 0,
    status: wi.status, overallRAG: wi.overallRAG,
  });
}

// ── Unified DashboardPage ────────────────────────────────────────────────────

interface DashboardPageProps {
  application: 'SAP' | 'Coupa' | 'Commercial';
}

const DashboardPage: React.FC<DashboardPageProps> = ({ application }) => {
  const cfg = CONFIGS[application];
  const C = cfg.palette;
  const { ClassicComponent } = cfg;

  const getStoredView = () =>
    (localStorage.getItem(cfg.viewKey) as 'analytics' | 'classic') || 'analytics';

  const [viewMode, setViewMode] = useState<'analytics' | 'classic'>(getStoredView);
  const navigate = useNavigate();
  const { data: allWorkItems = [] } = useWorkItems();
  // Always called — React Query deduplicates; only used by SAP config
  const { data: transports = [] } = useTransports();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterModule, setFilterModule] = useState<string | undefined>();

  // ── Filtered work items ──
  const workItems = useMemo(() => {
    let items = allWorkItems.filter(cfg.appFilter);
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

  // ── KPI computations ──
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
      if (r in d) d[r as keyof typeof d]++; else d.GREEN++;
    }
    return d;
  }, [activeItems]);

  // SAP-specific: transport pipeline
  const pipeline = useMemo(() => ({
    dev: transports.filter((t: any) => t.currentSystem === 'DEV').length,
    qas: transports.filter((t: any) => t.currentSystem === 'QAS').length,
    prd: transports.filter((t: any) => t.currentSystem === 'PRD').length,
    total: transports.length,
  }), [transports]);

  const testSummary = useMemo(() => {
    let passed = 0, total = 0;
    for (const wi of activeItems) { passed += wi.testPassed || 0; total += wi.testTotal || 0; }
    return { passed, total, rate: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }, [activeItems]);

  const upcomingGoLives = useMemo(() =>
    activeItems
      .filter((wi: any) => wi.goLiveDate && daysFromNow(wi.goLiveDate) >= 0 && daysFromNow(wi.goLiveDate) <= 90)
      .sort((a: any, b: any) => dayjs(a.goLiveDate).diff(dayjs(b.goLiveDate)))
      .slice(0, 5),
    [activeItems]);

  // ── Chart data ──
  const phaseChartData = useMemo(() => {
    const data: { phase: string; count: number; status: string }[] = [];
    for (const phase of cfg.phases) {
      const phaseItems = activeItems.filter((wi: any) => (wi.currentPhase || cfg.phases[0]) === phase);
      for (const [ragKey, label] of [['GREEN', 'On Track'], ['AMBER', 'At Risk'], ['RED', 'Critical']] as const) {
        const count = phaseItems.filter((wi: any) => getRAG(wi) === ragKey).length;
        if (count > 0) data.push({ phase, count, status: label });
      }
    }
    return data;
  }, [activeItems]);

  const typeDonutData = useMemo(() => {
    const types: Record<string, number> = {};
    for (const wi of workItems) {
      const t = wi.workItemType || 'Other';
      types[t] = (types[t] || 0) + 1;
    }
    return Object.entries(types).map(([type, value]) => ({ type, value }));
  }, [workItems]);

  const priorityBarData = useMemo(() => {
    const pr: Record<string, number> = {};
    for (const wi of activeItems) pr[wi.priority || 'N/A'] = (pr[wi.priority || 'N/A'] || 0) + 1;
    return Object.entries(pr).map(([priority, count]) => ({ priority, count })).sort((a, b) => a.priority.localeCompare(b.priority));
  }, [activeItems]);

  // SAP-only
  const moduleBarData = useMemo(() => {
    if (application !== 'SAP') return [];
    const mods: Record<string, number> = {};
    for (const wi of activeItems) { const m = wi.sapModule || 'Other'; mods[m] = (mods[m] || 0) + 1; }
    return Object.entries(mods).map(([module, count]) => ({ module, count })).sort((a, b) => b.count - a.count);
  }, [activeItems, application]);

  const moduleRiskData = useMemo(() => {
    if (application !== 'SAP') return [];
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
  }, [activeItems, application]);

  const pipelineData = useMemo(() => [
    { system: 'DEV', count: pipeline.dev },
    { system: 'QAS', count: pipeline.qas },
    { system: 'PRD', count: pipeline.prd },
  ], [pipeline]);

  // Coupa-only
  const uatBarData = useMemo(() => {
    if (application !== 'Coupa') return [];
    const uat: Record<string, number> = {};
    for (const wi of activeItems) uat[wi.uatStatus || 'Not Started'] = (uat[wi.uatStatus || 'Not Started'] || 0) + 1;
    return Object.entries(uat).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  }, [activeItems, application]);

  // Coupa + Commercial
  const complexityData = useMemo(() => {
    if (application === 'SAP') return [];
    const cx: Record<string, number> = {};
    for (const wi of activeItems) cx[wi.complexity || 'N/A'] = (cx[wi.complexity || 'N/A'] || 0) + 1;
    return Object.entries(cx).map(([complexity, count]) => ({ complexity, count })).sort((a, b) => b.count - a.count);
  }, [activeItems, application]);

  // Commercial-only
  const riskBucketData = useMemo(() => {
    if (application !== 'Commercial') return [];
    const buckets = { 'Low (0-30)': 0, 'Medium (31-60)': 0, 'High (61-80)': 0, 'Critical (81+)': 0 };
    for (const wi of activeItems) {
      const r = wi.riskScore || 0;
      if (r <= 30) buckets['Low (0-30)']++;
      else if (r <= 60) buckets['Medium (31-60)']++;
      else if (r <= 80) buckets['High (61-80)']++;
      else buckets['Critical (81+)']++;
    }
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
  }, [activeItems, application]);

  // ── Derived filter options ──
  const priorities = [...new Set(workItems.map((w: any) => w.priority).filter(Boolean))].sort() as string[];
  const statuses = [...new Set(workItems.map((w: any) => w.status).filter(Boolean))] as string[];
  const modules = [...new Set(workItems.map((w: any) => w.sapModule).filter(Boolean))].sort() as string[];

  const typeColorMap: Record<string, string> = {};
  typeDonutData.forEach((d, i) => { typeColorMap[d.type] = C.typeColors[i % C.typeColors.length]; });

  const handleViewChange = (val: string | number) => {
    const v = val as 'analytics' | 'classic';
    setViewMode(v);
    localStorage.setItem(cfg.viewKey, v);
  };

  const viewToggle = (
    <Segmented
      options={[
        { label: <span><AppstoreOutlined /> Classic</span>, value: 'classic' },
        { label: <span><BarChartOutlined /> Analytics</span>, value: 'analytics' },
      ]}
      value={viewMode}
      onChange={handleViewChange}
    />
  );

  // ── Classic view ──
  if (viewMode === 'classic') {
    return (
      <div>
        <div className="dashboard-view-toggle dashboard-toggle-classic">
          {cfg.classicHeader}
          {viewToggle}
        </div>
        <ClassicComponent />
      </div>
    );
  }

  // ── Go-Live table columns ──
  const goLiveCols = [
    {
      title: cfg.goLiveColName, dataIndex: 'workItemName', key: 'name', ellipsis: true,
      render: (t: string, r: any) => <a onClick={() => navigate(`/workitem/${r.ID}`)}>{t}</a>,
    },
    ...(application === 'SAP' ? [{
      title: 'Module', dataIndex: 'sapModule', key: 'mod', width: 80,
      render: (m: string) => <Tag>{m || '—'}</Tag>,
    }] : []),
    {
      title: 'Go-Live', dataIndex: 'goLiveDate', key: 'gl', width: 140,
      render: (d: string) => <Text type="secondary">{d} ({daysFromNow(d)}d)</Text>,
    },
    {
      title: 'Health', key: 'rag', width: 70, align: 'center' as const,
      render: (_: any, r: any) => {
        const rag = getRAG(r);
        const cls = rag === 'GREEN' ? 'rag-dot-green' : rag === 'AMBER' ? 'rag-dot-amber' : 'rag-dot-red';
        return <div className={`rag-dot ${cls}`} />;
      },
    },
    {
      title: 'Progress', dataIndex: 'deploymentPct', key: 'pct', width: 100,
      render: (pct: number) => <Progress percent={pct || 0} size="small" />,
    },
  ];

  // ── Analytics view ──
  return (
    <div className="analytics-dashboard">
      {/* ── Toggle & Breadcrumb ── */}
      <div className="dashboard-view-toggle">
        <div>
          <Text className="dashboard-breadcrumb">
            SAP PM Command Center / <Text strong className="dashboard-breadcrumb-active">{cfg.breadcrumb}</Text>
          </Text>
        </div>
        {viewToggle}
      </div>

      {/* ── Filter Bar ── */}
      <div className="analytics-filter-bar">
        <RangePicker size="middle" onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
        <Select placeholder="Priority" allowClear value={filterPriority} onChange={setFilterPriority}
          className="filter-select-sm" options={priorities.map(p => ({ value: p, label: p }))} />
        <Select placeholder="Status" allowClear value={filterStatus} onChange={setFilterStatus}
          className="filter-select-md" options={statuses.map(s => ({ value: s, label: s }))} />
        {application === 'SAP' && (
          <Select placeholder="Module" allowClear value={filterModule} onChange={setFilterModule}
            className="filter-select-md" options={modules.map(m => ({ value: m, label: m }))} />
        )}
        <Button icon={<FilterOutlined />}>Filters</Button>
      </div>

      {/* ── KPI Cards ── */}
      <Row gutter={16} className="mb-20">
        <Col xs={12} lg={6}>
          <div className="analytics-kpi analytics-kpi-clickable" onClick={() => navigate('/tracker')}>
            <div className="kpi-label">{cfg.kpiIcon} Active {cfg.itemLabel}</div>
            <div className="kpi-value">{activeItems.length}</div>
            <div className="kpi-delta positive"><CaretUpOutlined /> {ragDist.GREEN} on track</div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">
              <ThunderboltOutlined /> Risk Score <Tooltip title="Sum of risk scores across active items"><InfoCircleOutlined className="kpi-info-icon" /></Tooltip>
            </div>
            <div className="kpi-value">{totalRiskScore}</div>
            <div className={`kpi-delta ${totalRiskScore > cfg.riskThreshold ? 'negative' : 'positive'}`}>
              {totalRiskScore > cfg.riskThreshold
                ? <><CaretUpOutlined /> {application === 'SAP' ? 'High risk' : 'Elevated'}</>
                : <><CaretDownOutlined /> {application === 'SAP' ? 'Low risk' : 'Normal'}</>}
            </div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">
              <ClockCircleOutlined /> Avg {application === 'SAP' ? 'Deployment' : 'Progress'}
              <Tooltip title={`Average progress % across active ${cfg.itemLabel.toLowerCase()}`}><InfoCircleOutlined className="kpi-info-icon" /></Tooltip>
            </div>
            <div className="kpi-value">{avgDeployment}<span className="kpi-pct-suffix">%</span></div>
            <div className="kpi-delta neutral">
              {application === 'SAP'
                ? `Transport Pipeline: ${pipeline.prd}/${pipeline.total} in PRD`
                : `Across active ${cfg.itemLabel.toLowerCase()}`}
            </div>
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <div className="analytics-kpi">
            <div className="kpi-label">Total {cfg.itemLabel}</div>
            <div className="kpi-value">{workItems.length}</div>
            <div className="rag-bar">
              {ragDist.GREEN > 0 && <Tooltip title={`On Track: ${ragDist.GREEN}`}><div className="bg-green" style={{ flex: ragDist.GREEN }} /></Tooltip>}
              {ragDist.AMBER > 0 && <Tooltip title={`At Risk: ${ragDist.AMBER}`}><div className="bg-amber" style={{ flex: ragDist.AMBER }} /></Tooltip>}
              {ragDist.RED > 0 && <Tooltip title={`Critical: ${ragDist.RED}`}><div className="bg-red" style={{ flex: ragDist.RED }} /></Tooltip>}
            </div>
            <div className="rag-bar-legend">
              <span><span className="text-green">●</span> On Track</span>
              <span><span className="text-amber">●</span> At Risk</span>
              <span><span className="text-red">●</span> Critical</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* ── Mini Stats ── */}
      <Row gutter={16} className="mb-20">
        <Col xs={8} lg={4}>
          <div className="analytics-kpi analytics-kpi-mini">
            <div className="kpi-label"><BugOutlined /> Test Pass Rate</div>
            <div className="kpi-value">{testSummary.rate}%</div>
            <Text type="secondary" className="fs-11">{testSummary.passed}/{testSummary.total}</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi analytics-kpi-mini">
            <div className="kpi-label"><CheckCircleOutlined /> Completed</div>
            <div className="kpi-value text-green">{completedItems.length}</div>
            <Text type="secondary" className="fs-11">of {workItems.length} total</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi analytics-kpi-mini">
            <div className="kpi-label"><WarningOutlined /> Critical</div>
            <div className="kpi-value text-red">{ragDist.RED}</div>
            <Text type="secondary" className="fs-11">need attention</Text>
          </div>
        </Col>
        <Col xs={8} lg={4}>
          <div className="analytics-kpi analytics-kpi-mini">
            <div className="kpi-label">At Risk</div>
            <div className="kpi-value text-amber">{ragDist.AMBER}</div>
            <Text type="secondary" className="fs-11">being monitored</Text>
          </div>
        </Col>
        {application === 'SAP' ? (
          <>
            <Col xs={8} lg={4}>
              <div className="analytics-kpi analytics-kpi-mini">
                <div className="kpi-label">Transports</div>
                <div className="kpi-value">{pipeline.total}</div>
                <Text type="secondary" className="fs-11">DEV:{pipeline.dev} QAS:{pipeline.qas} PRD:{pipeline.prd}</Text>
              </div>
            </Col>
            <Col xs={8} lg={4}>
              <div className="analytics-kpi analytics-kpi-mini">
                <div className="kpi-label">Go-Lives ≤90d</div>
                <div className="kpi-value">{upcomingGoLives.length}</div>
                <Text type="secondary" className="fs-11">upcoming</Text>
              </div>
            </Col>
          </>
        ) : (
          <Col xs={16} lg={8}>
            <div className="analytics-kpi analytics-kpi-mini">
              <div className="kpi-label">Go-Lives ≤90d</div>
              <div className="kpi-value">{upcomingGoLives.length}</div>
              <Text type="secondary" className="fs-11">upcoming {application === 'Commercial' ? 'launches' : 'deployments'}</Text>
            </div>
          </Col>
        )}
      </Row>

      {/* ── Section 1: Phase & Type ── */}
      <div className="analytics-chart-card chart-card-mb">
        <div className="chart-title">{cfg.lifecycleTitle}</div>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <div className="chart-section-header">
              <Text strong className="fs-14">{cfg.itemLabel} by Phase &amp; Health</Text>
              <br /><Text type="secondary" className="fs-12">{cfg.phaseSubtitle}</Text>
            </div>
            <Space size={16} className="mb-12">
              {[['On Track', C.green], ['At Risk', C.amber], ['Critical', C.red]].map(([label, color]) => (
                <Space key={label as string} size={4}>
                  <div className="legend-swatch" style={{ background: color as string }} />
                  <Text type="secondary" className="fs-12">{label}</Text>
                </Space>
              ))}
            </Space>
            {phaseChartData.length > 0 ? (
              <Column data={phaseChartData} xField="phase" yField="count" colorField="status"
                stack={true} height={280} theme={C.chartTheme}
                scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                style={{ maxWidth: 40, radiusTopLeft: 4, radiusTopRight: 4 }}
                axis={{
                  x: { title: false, line: null, tick: null, labelFill: C.textSec },
                  y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3], labelFill: C.textSec },
                }}
                legend={false}
              />
            ) : (
              <div className="chart-empty-placeholder"><Empty description="No data" /></div>
            )}
          </Col>
          <Col xs={24} lg={10}>
            <div className="chart-section-header">
              <Text strong className="fs-14">{cfg.itemLabel} by Type</Text>
              <br /><Text type="secondary" className="fs-12">{cfg.typeSubtitle}</Text>
            </div>
            {typeDonutData.length > 0 ? (
              <div className="donut-chart-wrapper">
                <div className="donut-chart-container">
                  <Pie data={typeDonutData} angleField="value" colorField="type"
                    innerRadius={0.65} height={240} theme={C.chartTheme}
                    autoFit={true}
                    scale={{ color: { range: typeDonutData.map(d => typeColorMap[d.type]) } }}
                    label={false} legend={false}
                  />
                  <div className="donut-center-label">
                    <div className="donut-value">{workItems.length}</div>
                    <div className="donut-sub">Items</div>
                  </div>
                </div>
                <div className="donut-legend-right">
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
              <div className="chart-empty-placeholder"><Empty description="No data" /></div>
            )}
          </Col>
        </Row>
      </div>

      {/* ── Section 2: App-specific charts ── */}
      <div className="analytics-chart-card chart-card-mb">
        <div className="chart-title">{cfg.extraSectionTitle}</div>
        {application === 'SAP' && (
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Items by SAP Module</Text>
                <br /><Text type="secondary" className="fs-12">Active work items per functional area</Text>
              </div>
              {moduleBarData.length > 0 ? (
                <Bar data={moduleBarData} xField="module" yField="count"
                  height={Math.max(200, moduleBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false, labelFill: C.textSec }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3], labelFill: C.textSec } }}
                  label={{ text: 'count', fontSize: 11, fill: C.textSec }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
            <Col xs={24} lg={12}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Risk Score by Module</Text>
                <br /><Text type="secondary" className="fs-12">Average risk score per functional area</Text>
              </div>
              {moduleRiskData.length > 0 ? (
                <Bar data={moduleRiskData} xField="module" yField="riskScore"
                  height={Math.max(200, moduleRiskData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false, labelFill: C.textSec }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3], labelFill: C.textSec } }}
                  label={{ text: 'riskScore', fontSize: 11, fill: C.textSec }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
          </Row>
        )}

        {application === 'Coupa' && (
          <Row gutter={24}>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Priority Distribution</Text>
                <br /><Text type="secondary" className="fs-12">Active deliverables by priority</Text>
              </div>
              {priorityBarData.length > 0 ? (
                <Bar data={priorityBarData} xField="priority" yField="count"
                  height={Math.max(180, priorityBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.orange, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fontSize: 11 }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">UAT Status Breakdown</Text>
                <br /><Text type="secondary" className="fs-12">Testing status across deliverables</Text>
              </div>
              {uatBarData.length > 0 ? (
                <Bar data={uatBarData} xField="status" yField="count"
                  height={Math.max(180, uatBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fontSize: 11 }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Complexity Breakdown</Text>
                <br /><Text type="secondary" className="fs-12">Deliverables by complexity level</Text>
              </div>
              {complexityData.length > 0 ? (
                <Bar data={complexityData} xField="complexity" yField="count"
                  height={Math.max(180, complexityData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fontSize: 11 }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
          </Row>
        )}

        {application === 'Commercial' && (
          <Row gutter={24}>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Priority Distribution</Text>
                <br /><Text type="secondary" className="fs-12">Active items by priority level</Text>
              </div>
              {priorityBarData.length > 0 ? (
                <Bar data={priorityBarData} xField="priority" yField="count"
                  height={Math.max(180, priorityBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fontSize: 11 }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Complexity Breakdown</Text>
                <br /><Text type="secondary" className="fs-12">Active items by complexity</Text>
              </div>
              {complexityData.length > 0 ? (
                <Bar data={complexityData} xField="complexity" yField="count"
                  height={Math.max(180, complexityData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.cyan, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fontSize: 11 }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Risk Distribution</Text>
                <br /><Text type="secondary" className="fs-12">Items by risk score range</Text>
              </div>
              {riskBucketData.some(d => d.count > 0) ? (
                <Bar data={riskBucketData} xField="bucket" yField="count"
                  height={Math.max(180, riskBucketData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3] } }}
                  label={{ text: 'count', fontSize: 11 }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
          </Row>
        )}
      </div>

      {/* ── Section 3: SAP Priority & Pipeline (SAP only — others include priority in section 2) ── */}
      {application === 'SAP' && (
        <div className="analytics-chart-card chart-card-mb">
          <div className="chart-title">Priority &amp; Transport Pipeline</div>
          <Row gutter={24}>
            <Col xs={24} lg={12}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Priority Distribution</Text>
                <br /><Text type="secondary" className="fs-12">Active work items by priority level</Text>
              </div>
              {priorityBarData.length > 0 ? (
                <Bar data={priorityBarData} xField="priority" yField="count"
                  height={Math.max(180, priorityBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={{ x: { title: false, labelFill: C.textSec }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3], labelFill: C.textSec } }}
                  label={{ text: 'count', fontSize: 11, fill: C.textSec }} legend={false}
                />
              ) : <Empty description="No data" />}
            </Col>
            <Col xs={24} lg={12}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Transport Pipeline</Text>
                <br /><Text type="secondary" className="fs-12">Current transport distribution across SAP systems</Text>
              </div>
              {pipelineData.some(d => d.count > 0) ? (
                <Column data={pipelineData} xField="system" yField="count" height={220}
                  theme={C.chartTheme}
                  style={{ maxWidth: 60, radiusTopLeft: 4, radiusTopRight: 4 }}
                  scale={{ color: { range: [C.accent] } }}
                  axis={{ x: { title: false, line: null, tick: null, labelFill: C.textSec }, y: { title: false, gridStroke: C.grid, gridLineDash: [3, 3], labelFill: C.textSec } }}
                  label={{ text: 'count', fontSize: 12, fill: C.textSec }} legend={false}
                />
              ) : <Empty description="No transports" />}
            </Col>
          </Row>
        </div>
      )}

      {/* ── Upcoming Go-Lives Table ── */}
      {upcomingGoLives.length > 0 && (
        <div className="analytics-chart-card">
          <div className="chart-header-actions">
            <div className="chart-title mb-0">{cfg.goLiveTitle}</div>
            <Button type="link" className="p-0" onClick={() => navigate('/tracker')}>View All →</Button>
          </div>
          <Table dataSource={upcomingGoLives} columns={goLiveCols} rowKey="ID"
            size="small" pagination={false} scroll={{ x: application === 'SAP' ? 600 : 500 }} />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
