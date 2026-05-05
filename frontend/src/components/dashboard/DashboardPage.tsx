import React, { useMemo, useState } from 'react';
import {
  Row, Col, Select, Typography, Space,
  DatePicker, Button, Progress, Table, Tag
} from 'antd';
import {
  RocketOutlined, ShoppingCartOutlined,
  MedicineBoxOutlined, BugOutlined, ClockCircleOutlined, ThunderboltOutlined,
  CheckCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Column, Pie, Bar } from '@ant-design/charts';
import { useWorkItems, useTransports } from '../../hooks/useData';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';
import dayjs from 'dayjs';
import '../../styles/dashboard-analytics.css';
import type { WorkItem, Transport } from '@/types';
import { StatCard, EmptyState, ChartFrame } from '../../design/components';
import { tokenAxisConfig, tokenChartInteraction, tokenChartLabel } from '../../design/chart-theme';

const { Text } = Typography;
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
  accent: '#1677ff', green: 'var(--color-status-risk-low)', red: 'var(--color-status-risk-high)', amber: 'var(--color-status-risk-medium)',
  orange: '#fa8c16', purple: '#722ed1', cyan: '#13c2c2', pink: '#eb2f96',
  grid: '#f0f0f0',
  chartTheme: 'classic' as const,
  typeColors: ['#1677ff', 'var(--color-status-risk-low)', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', 'var(--color-status-risk-medium)', 'var(--color-status-risk-high)'],
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
  breadcrumb: string;
  /** filter predicate applied to allWorkItems */
  appFilter: (wi: WorkItem) => boolean;
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
}

const SAP_CONFIG: AppDashboardConfig = {
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
};

const COUPA_CONFIG: AppDashboardConfig = {
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
};

const COMMERCIAL_CONFIG: AppDashboardConfig = {
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
};

const CONFIGS: Record<string, AppDashboardConfig> = {
  SAP: SAP_CONFIG,
  Coupa: COUPA_CONFIG,
  Commercial: COMMERCIAL_CONFIG,
};

// ── Shared helper ────────────────────────────────────────────────────────────

function getRAG(wi: WorkItem): string {
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

  const navigate = useNavigate();
  const { data: allWorkItems = [], isLoading } = useWorkItems();
  // Always called — React Query deduplicates; only used by SAP config
  const { data: transports = [] } = useTransports();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterModule, setFilterModule] = useState<string | undefined>();

  // ── Filtered work items ──
  const workItems = useMemo(() => {
    let items = allWorkItems.filter(cfg.appFilter);
    if (filterPriority) items = items.filter((wi: WorkItem) => wi.priority === filterPriority);
    if (filterStatus) items = items.filter((wi: WorkItem) => wi.status === filterStatus);
    if (filterModule) items = items.filter((wi: WorkItem) => wi.sapModule === filterModule);
    if (dateRange) {
      items = items.filter((wi: WorkItem) => {
        if (!wi.goLiveDate) return true;
        const d = dayjs(wi.goLiveDate);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    return items;
  }, [allWorkItems, filterPriority, filterStatus, filterModule, dateRange]);

  const activeItems = workItems.filter((wi: WorkItem) => wi.status === 'Active');
  const completedItems = workItems.filter((wi: WorkItem) => ['Complete', 'Completed', 'Done'].includes(wi.status));

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
    dev: transports.filter((t: Transport) => t.currentSystem === 'DEV').length,
    qas: transports.filter((t: Transport) => t.currentSystem === 'QAS').length,
    prd: transports.filter((t: Transport) => t.currentSystem === 'PRD').length,
    total: transports.length,
  }), [transports]);

  const testSummary = useMemo(() => {
    let passed = 0, total = 0;
    for (const wi of activeItems) { passed += wi.testPassed || 0; total += wi.testTotal || 0; }
    return { passed, total, rate: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }, [activeItems]);

  const upcomingGoLives = useMemo(() =>
    activeItems
      .filter((wi: WorkItem) => wi.goLiveDate && daysFromNow(wi.goLiveDate) >= 0 && daysFromNow(wi.goLiveDate) <= 90)
      .sort((a: any, b: any) => dayjs(a.goLiveDate).diff(dayjs(b.goLiveDate)))
      .slice(0, 5),
    [activeItems]);

  // ── Chart data ──
  const phaseChartData = useMemo(() => {
    const data: { phase: string; count: number; status: string }[] = [];
    for (const phase of cfg.phases) {
      const phaseItems = activeItems.filter((wi: WorkItem) => (wi.currentPhase || cfg.phases[0]) === phase);
      for (const [ragKey, label] of [['GREEN', 'On Track'], ['AMBER', 'At Risk'], ['RED', 'Critical']] as const) {
        const count = phaseItems.filter((wi: WorkItem) => getRAG(wi) === ragKey).length;
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
  const priorities = [...new Set(workItems.map((w: WorkItem) => w.priority).filter(Boolean))].sort() as string[];
  const statuses = [...new Set(workItems.map((w: WorkItem) => w.status).filter(Boolean))] as string[];
  const modules = [...new Set(workItems.map((w: WorkItem) => w.sapModule).filter(Boolean))].sort() as string[];

  const typeColorMap: Record<string, string> = {};
  typeDonutData.forEach((d, i) => { typeColorMap[d.type] = C.typeColors[i % C.typeColors.length]; });

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

  // ── Analytics view ──
  return (
    <div className="analytics-dashboard">
      {/* ── Breadcrumb ── */}
      <div className="dashboard-view-toggle">
        <div>
          <Text className="dashboard-breadcrumb">
            SAP PM Command Center / <Text strong className="dashboard-breadcrumb-active">{cfg.breadcrumb}</Text>
          </Text>
        </div>
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
      </div>

      {/* ── KPI Cards — uniform grid, every tile the same size ── */}
      <div className="kpi-grid">
        <StatCard
          loading={isLoading}
          icon={cfg.kpiIcon}
          label={`Active ${cfg.itemLabel}`}
          value={activeItems.length}
          delta={{ direction: 'up', text: `${ragDist.GREEN} on track` }}
          tone="info"
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}&status=Active`)}
        />
        <StatCard
          loading={isLoading}
          icon={<ThunderboltOutlined />}
          label="Risk Score"
          value={totalRiskScore}
          delta={
            totalRiskScore > cfg.riskThreshold
              ? { direction: 'up', text: application === 'SAP' ? 'High risk' : 'Elevated' }
              : { direction: 'down', text: application === 'SAP' ? 'Low risk' : 'Normal' }
          }
          tone={totalRiskScore > cfg.riskThreshold ? 'danger' : 'success'}
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}&status=Active`)}
        />
        <StatCard
          loading={isLoading}
          icon={<ClockCircleOutlined />}
          label={`Avg ${application === 'SAP' ? 'Deployment' : 'Progress'}`}
          value={avgDeployment}
          unit="%"
          caption={
            application === 'SAP'
              ? `${pipeline.prd}/${pipeline.total} in PRD`
              : `Across active ${cfg.itemLabel.toLowerCase()}`
          }
          tone="info"
          onClick={() => application === 'SAP' ? navigate('/pipeline') : navigate(`/tracker?app=${application.toLowerCase()}&status=Active`)}
        />
        <StatCard
          loading={isLoading}
          label={`Total ${cfg.itemLabel}`}
          value={workItems.length}
          caption={`${ragDist.GREEN} · ${ragDist.AMBER} · ${ragDist.RED}`}
          tone="neutral"
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}`)}
        />
        <StatCard
          loading={isLoading}
          icon={<BugOutlined />}
          label="Test Pass Rate"
          value={testSummary.rate}
          unit="%"
          caption={`${testSummary.passed}/${testSummary.total} passed`}
          tone={testSummary.rate >= 80 ? 'success' : testSummary.rate >= 50 ? 'warning' : 'danger'}
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}&status=Active`)}
        />
        <StatCard
          loading={isLoading}
          icon={<CheckCircleOutlined />}
          label="Completed"
          value={completedItems.length}
          caption={`of ${workItems.length} total`}
          tone="success"
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}&status=Done`)}
        />
        <StatCard
          loading={isLoading}
          icon={<WarningOutlined />}
          label="Critical"
          value={ragDist.RED}
          caption="need attention"
          tone="danger"
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}&status=Active&rag=RED`)}
        />
        <StatCard
          loading={isLoading}
          label="At Risk"
          value={ragDist.AMBER}
          caption="being monitored"
          tone="warning"
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}&status=Active&rag=AMBER`)}
        />
        {application === 'SAP' && (
          <StatCard
            loading={isLoading}
            label="Transports"
            value={pipeline.total}
            caption={`${pipeline.prd} in PRD`}
            tone="info"
            onClick={() => navigate('/pipeline')}
          />
        )}
        <StatCard
          loading={isLoading}
          label="Go-Lives ≤90d"
          value={upcomingGoLives.length}
          caption={application === 'SAP' ? 'upcoming' : `upcoming ${application === 'Commercial' ? 'launches' : 'deployments'}`}
          tone="info"
          onClick={() => navigate(`/tracker?app=${application.toLowerCase()}&status=Active`)}
        />
      </div>

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
            <ChartFrame
              loading={isLoading}
              empty={phaseChartData.length === 0}
              height={280}
              summary={`${cfg.itemLabel} by phase and health — ${ragDist.GREEN} on track, ${ragDist.AMBER} at risk, ${ragDist.RED} critical.`}
            >
              <Column data={phaseChartData} xField="phase" yField="count" colorField="status"
                stack={true} height={280} theme={C.chartTheme}
                scale={{ color: { domain: ['On Track', 'At Risk', 'Critical'], range: [C.green, C.amber, C.red] } }}
                style={{ maxWidth: 40, radiusTopLeft: 4, radiusTopRight: 4 }}
                axis={tokenAxisConfig()}
                interaction={tokenChartInteraction}
                legend={false}
              />
            </ChartFrame>
          </Col>
          <Col xs={24} lg={10}>
            <div className="chart-section-header">
              <Text strong className="fs-14">{cfg.itemLabel} by Type</Text>
              <br /><Text type="secondary" className="fs-12">{cfg.typeSubtitle}</Text>
            </div>
            <ChartFrame loading={isLoading} empty={typeDonutData.length === 0} height={240} summary={`${workItems.length} ${cfg.itemLabel.toLowerCase()} grouped by type across ${typeDonutData.length} categories.`}>
              <div className="donut-chart-wrapper">
                <div className="donut-chart-container">
                  <Pie data={typeDonutData} angleField="value" colorField="type"
                    innerRadius={0.65} height={240} theme={C.chartTheme}
                    autoFit={true}
                    scale={{ color: { range: typeDonutData.map(d => typeColorMap[d.type]) } }}
                    label={false} legend={false} interaction={tokenChartInteraction}
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
            </ChartFrame>
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
              <ChartFrame loading={isLoading} empty={moduleBarData.length === 0} height={220} summary={`Work items by SAP module across ${moduleBarData.length} functional areas.`}>
                <Bar data={moduleBarData} xField="module" yField="count"
                  height={Math.max(200, moduleBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
            </Col>
            <Col xs={24} lg={12}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Risk Score by Module</Text>
                <br /><Text type="secondary" className="fs-12">Average risk score per functional area</Text>
              </div>
              <ChartFrame loading={isLoading} empty={moduleRiskData.length === 0} height={220} summary={`Average risk score per SAP module.`}>
                <Bar data={moduleRiskData} xField="module" yField="riskScore"
                  height={Math.max(200, moduleRiskData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'riskScore' })} legend={false}
                />
              </ChartFrame>
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
              <ChartFrame loading={isLoading} empty={priorityBarData.length === 0} height={200} summary={`Coupa deliverables by priority across ${priorityBarData.length} categories.`}>
                <Bar data={priorityBarData} xField="priority" yField="count"
                  height={Math.max(180, priorityBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.orange, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">UAT Status Breakdown</Text>
                <br /><Text type="secondary" className="fs-12">Testing status across deliverables</Text>
              </div>
              <ChartFrame loading={isLoading} empty={uatBarData.length === 0} height={200} summary={`UAT status breakdown across ${uatBarData.length} states.`}>
                <Bar data={uatBarData} xField="status" yField="count"
                  height={Math.max(180, uatBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.accent, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Complexity Breakdown</Text>
                <br /><Text type="secondary" className="fs-12">Deliverables by complexity level</Text>
              </div>
              <ChartFrame loading={isLoading} empty={complexityData.length === 0} height={200} summary={`Coupa complexity breakdown across ${complexityData.length} levels.`}>
                <Bar data={complexityData} xField="complexity" yField="count"
                  height={Math.max(180, complexityData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
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
              <ChartFrame loading={isLoading} empty={priorityBarData.length === 0} height={200} summary={`Commercial items by priority across ${priorityBarData.length} levels.`}>
                <Bar data={priorityBarData} xField="priority" yField="count"
                  height={Math.max(180, priorityBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Complexity Breakdown</Text>
                <br /><Text type="secondary" className="fs-12">Active items by complexity</Text>
              </div>
              <ChartFrame loading={isLoading} empty={complexityData.length === 0} height={200} summary={`Commercial items by complexity across ${complexityData.length} levels.`}>
                <Bar data={complexityData} xField="complexity" yField="count"
                  height={Math.max(180, complexityData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.cyan, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
            </Col>
            <Col xs={24} lg={8}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Risk Distribution</Text>
                <br /><Text type="secondary" className="fs-12">Items by risk score range</Text>
              </div>
              <ChartFrame loading={isLoading} empty={!riskBucketData.some(d => d.count > 0)} height={200} summary={`Commercial items by risk score range across ${riskBucketData.length} buckets.`}>
                <Bar data={riskBucketData} xField="bucket" yField="count"
                  height={Math.max(180, riskBucketData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.red, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
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
              <ChartFrame loading={isLoading} empty={priorityBarData.length === 0} height={200} summary={`SAP work items by priority across ${priorityBarData.length} levels.`}>
                <Bar data={priorityBarData} xField="priority" yField="count"
                  height={Math.max(180, priorityBarData.length * 48)} theme={C.chartTheme}
                  style={{ fill: C.purple, radiusTopRight: 4, radiusBottomRight: 4 }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count' })} legend={false}
                />
              </ChartFrame>
            </Col>
            <Col xs={24} lg={12}>
              <div className="chart-section-header">
                <Text strong className="fs-14">Transport Pipeline</Text>
                <br /><Text type="secondary" className="fs-12">Current transport distribution across SAP systems</Text>
              </div>
              <ChartFrame loading={isLoading} empty={!pipelineData.some(d => d.count > 0)} height={220} summary={`Transport pipeline: ${pipeline.dev} in DEV, ${pipeline.qas} in QAS, ${pipeline.prd} in PRD.`}>
                <Column data={pipelineData} xField="system" yField="count" height={220}
                  theme={C.chartTheme}
                  style={{ maxWidth: 60, radiusTopLeft: 4, radiusTopRight: 4 }}
                  scale={{ color: { range: [C.accent] } }}
                  axis={tokenAxisConfig()}
                  interaction={tokenChartInteraction}
                  label={tokenChartLabel({ text: 'count', position: 'top', textAlign: 'center', dx: 0, dy: -4 })} legend={false}
                />
              </ChartFrame>
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
