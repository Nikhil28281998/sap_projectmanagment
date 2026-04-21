import React, { useMemo, useState } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Tag, List, Typography, Space, Skeleton, Alert, Empty,
  Timeline, Badge, Tooltip, Table
} from 'antd';
import {
  ProjectOutlined, CodeOutlined, BugOutlined, RocketOutlined,
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExperimentOutlined, DashboardOutlined, CloudServerOutlined,
  ArrowRightOutlined, ExclamationCircleOutlined, StopOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDashboardSummary, useWorkItems, useTransports } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const RAG_COLORS: Record<string, string> = { GREEN: 'var(--color-status-risk-low)', AMBER: 'var(--color-status-risk-medium)', RED: 'var(--color-status-risk-high)' };
const RAG_ICONS: Record<string, string> = { GREEN: '🟢', AMBER: '🟡', RED: '🔴' };
const SYS_COLORS: Record<string, string> = { DEV: 'blue', QAS: 'orange', PRD: 'green' };

const HomeDashboardClassic: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useDashboardSummary('SAP');
  const { data: allWorkItems = [], isLoading: wiLoading } = useWorkItems();
  const { data: transports = [], isLoading: trLoading } = useTransports();

  // Filter to SAP-application items only
  const workItems = allWorkItems.filter((wi: any) => wi.application === 'SAP' || !wi.application);

  // Pipeline inline filter state
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null);

  const activeProjects = workItems.filter((wi: any) => wi.status === 'Active');
  const unassigned = transports.filter((tr: any) => !tr.workType);
  const stuckTRs = transports.filter((tr: any) => {
    if (tr.currentSystem === 'PRD') return false;
    const days = (Date.now() - new Date(tr.createdDate).getTime()) / 86400000;
    return days > 5;
  });
  const failedTRs = transports.filter((tr: any) => tr.importRC >= 8);
  const needAttention = stuckTRs.length + failedTRs.length;

  // 🔄 Transport Pipeline stats 🔄
  const pipeline = useMemo(() => {
    const dev = transports.filter((t: any) => t.currentSystem === 'DEV').length;
    const qas = transports.filter((t: any) => t.currentSystem === 'QAS').length;
    const prd = transports.filter((t: any) => t.currentSystem === 'PRD').length;
    const total = transports.length || 1;
    return { dev, qas, prd, total };
  }, [transports]);

  // Pipeline filtered results for inline table
  const pipelineResults = useMemo(() => {
    if (!pipelineFilter) return [];
    if (pipelineFilter === 'STUCK') return stuckTRs;
    if (pipelineFilter === 'FAILED') return failedTRs;
    return transports.filter((t: any) => t.currentSystem === pipelineFilter);
  }, [transports, pipelineFilter, stuckTRs, failedTRs]);

  // 🧪 Test Status summary (aggregated from WorkItem-level test fields) 🧪
  const testSummary = useMemo(() => {
    const activeWIs = workItems.filter((w: any) => w.status === 'Active');
    let passed = 0, failed = 0, blocked = 0, tbd = 0, skipped = 0, totalCases = 0;
    for (const wi of activeWIs) {
      passed += wi.testPassed || 0;
      failed += wi.testFailed || 0;
      blocked += wi.testBlocked || 0;
      tbd += wi.testTBD || 0;
      skipped += wi.testSkipped || 0;
      totalCases += wi.testTotal || 0;
    }
    const executed = passed + failed;
    const notRun = Math.max(0, totalCases - executed - skipped);
    const total = totalCases || 1;
    return { passed, failed, blocked, tbd, skipped, notRun, totalCases, passRate: Math.round((passed / total) * 100), executionRate: Math.round((executed / total) * 100) };
  }, [workItems]);

  // 🚀 Upcoming go-lives (within 30 days) 🚀
  const upcomingGoLives = useMemo(() => {
    return workItems
      .filter((wi: any) => wi.goLiveDate && wi.status === 'Active')
      .map((wi: any) => ({ ...wi, daysLeft: daysFromNow(wi.goLiveDate) }))
      .filter((wi: any) => wi.daysLeft >= 0 && wi.daysLeft <= 30)
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [workItems]);

  // Pending items: stuck + unassigned + failed (with navigation data)
  const pendingItems = useMemo(() => [
    ...failedTRs.map((tr: any) => ({
      icon: <ExclamationCircleOutlined className="text-red" />,
      text: `${tr.trNumber} — failed import (RC=${tr.importRC}) in ${tr.currentSystem}`,
      type: 'error', trNumber: tr.trNumber, workItem_ID: tr.workItem_ID,
    })),
    ...stuckTRs.slice(0, 10).map((tr: any) => ({
      icon: <ClockCircleOutlined className="text-amber" />,
      text: `${tr.trNumber} — stuck in ${tr.currentSystem} > 5 days (${tr.ownerFullName || tr.trOwner})`,
      type: 'warning', trNumber: tr.trNumber, workItem_ID: tr.workItem_ID,
    })),
    ...unassigned.slice(0, 5).map((tr: any) => ({
      icon: <WarningOutlined className="text-accent" />,
      text: `${tr.trNumber} — unassigned (${tr.trDescription?.substring(0, 50) || 'no description'})`,
      type: 'info', trNumber: tr.trNumber, workItem_ID: null as any,
    })),
  ], [failedTRs, stuckTRs, unassigned]);

  const completedPrd = transports.filter((tr: any) => tr.currentSystem === 'PRD' && tr.importRC === 0);

  // Pipeline inline table columns
  const pipelineTrCols = [
    { title: 'TR Number', dataIndex: 'trNumber', key: 'trNumber', render: (t: string) => <Text copyable={{ text: t }}>{t}</Text> },
    { title: 'Description', dataIndex: 'trDescription', key: 'desc', ellipsis: true, width: 260 },
    { title: 'System', dataIndex: 'currentSystem', key: 'sys', width: 80, render: (s: string) => <Tag color={SYS_COLORS[s] || 'default'}>{s}</Tag> },
    { title: 'Status', dataIndex: 'trStatus', key: 'st', width: 100, render: (s: string) => <Tag color={s === 'Released' ? 'green' : 'orange'}>{s}</Tag> },
    { title: 'RC', dataIndex: 'importRC', key: 'rc', width: 60, render: (rc: number | null) => rc == null ? '—' : rc === 0 ? <Tag color="success">0</Tag> : rc <= 4 ? <Tag color="warning">{rc}</Tag> : <Tag color="error">{rc}</Tag> },
    { title: 'Owner', dataIndex: 'ownerFullName', key: 'own', render: (t: string, r: any) => t || r.trOwner },
  ];

  if (summaryError) {
    return <Alert message="Failed to load dashboard" description={String(summaryError)} type="error" showIcon />;
  }

  // Reusable banner KPI with click (§1 aria-labels, §1 keyboard-nav)
  const bannerKpi = (label: string, value: number | string, color: string, onClick?: () => void) => (
    <Tooltip title={onClick ? `Click to view ${label}` : undefined}>
      <div className={`banner-kpi${onClick ? ' banner-kpi-clickable' : ''}`}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `${label}: ${value}. Click to view` : `${label}: ${value}`}
        onClick={onClick}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}>
        <div className="banner-kpi-value" style={{ color }}>{value}</div>
        <div className="banner-kpi-label">{label}</div>
      </div>
    </Tooltip>
  );

  // Reusable pipeline box (§1 keyboard-nav, §1 aria-labels, §2 touch-target-size)
  const pipelineBox = (sys: string, count: number, bg: string, borderColor: string, activeBg: string, textColor: string) => {
    const isActive = pipelineFilter === sys;
    const toggle = () => setPipelineFilter(isActive ? null : sys);
    return (
      <Tooltip title={`Click to view ${sys} transports`}>
        <div className="text-center flex-1 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label={`${sys}: ${count} transports${isActive ? ' (active filter)' : '. Click to filter'}`}
          aria-pressed={isActive}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
          <div className="pipeline-box"
            style={{ background: isActive ? activeBg : bg, border: `2px solid ${isActive ? activeBg : borderColor}` }}>
            <Text strong className="fs-24" style={{ color: isActive ? '#fff' : textColor }}>{count}</Text>
            <br /><Text style={{ color: isActive ? 'rgba(255,255,255,.8)' : undefined }} type={isActive ? undefined : 'secondary'}>{sys}</Text>
          </div>
        </div>
      </Tooltip>
    );
  };

  return (
    <div className="dashboard-classic">
      {/* 🎯 Welcome Banner with clickable KPIs 🎯 */}
      <Card
        className="banner-card"
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} className="banner-title">
              <DashboardOutlined /> Command Center
            </Title>
            <Text className="banner-subtitle">
              Welcome back, <strong>{user?.name || 'User'}</strong>
              {user?.roles && user.roles.length > 0 && <Tag color="gold" className="ml-8">{user.roles[0]}</Tag>}
            </Text>
          </Col>
          <Col>
            <Space size="large">
              {bannerKpi('Total Transports', transports.length, '#fff', () => navigate('/tracker/tr-search'))}
              {bannerKpi('Active Items', activeProjects.length, '#fff', () => navigate('/tracker'))}
              {needAttention > 0 &&
                bannerKpi('Need Attention', needAttention, 'var(--color-status-risk-medium)', () => {
                  document.getElementById('pending-items')?.scrollIntoView({ behavior: 'smooth' });
                })
              }
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 📊 Summary Cards 📊 */}
      <Row gutter={[12, 12]} className="mt-12 summary-cards-row">
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/tracker/Project')} size="small">
            <Statistic title="Projects" value={summaryLoading ? '-' : (summary?.activeProjects ?? workItems.filter((w: any) => w.workItemType === 'Project').length)}
              prefix={<ProjectOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/tracker/Enhancement')} size="small">
            <Statistic title="Enhancements" value={workItems.filter((w: any) => w.workItemType === 'Enhancement' && w.status === 'Active').length}
              prefix={<CodeOutlined />} valueStyle={{ color: 'var(--color-status-risk-low)' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/tracker/Break-fix')} size="small">
            <Statistic title="Break-Fixes" value={workItems.filter((w: any) => w.workItemType === 'Break-fix' && w.status === 'Active').length}
              prefix={<BugOutlined />} valueStyle={{ color: 'var(--color-status-risk-high)' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/unassigned')} size="small">
            <Statistic title="Unassigned TRs" value={summaryLoading ? '-' : (summary?.unassignedCount ?? unassigned.length)}
              prefix={<WarningOutlined />} valueStyle={{ color: unassigned.length > 0 ? 'var(--color-status-risk-medium)' : 'var(--color-status-risk-low)' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => document.getElementById('pending-items')?.scrollIntoView({ behavior: 'smooth' })} size="small">
            <Statistic title="Pending" value={pendingItems.length}
              prefix={<ClockCircleOutlined />} valueStyle={{ color: pendingItems.length > 0 ? 'var(--color-status-risk-medium)' : 'var(--color-status-risk-low)' }} />
          </Card>
        </Col>
      </Row>

      {/* 🔄 Transport Pipeline (clickable, inline results) 🔄 */}
      <Card title={<Space><CloudServerOutlined /> Transport Pipeline</Space>} size="small" className="mt-12"
        extra={pipelineFilter && <a onClick={() => setPipelineFilter(null)}>Clear filter</a>}>
        <div className="pipeline-flow">
          {pipelineBox('DEV', pipeline.dev, '#e6f4ff', '#91caff', '#1677ff', '#1677ff')}
          <ArrowRightOutlined className="fs-18 text-disabled" />
          {pipelineBox('QAS', pipeline.qas, '#fff7e6', '#ffd591', '#fa8c16', '#fa8c16')}
          <ArrowRightOutlined className="fs-18 text-disabled" />
          {pipelineBox('PRD', pipeline.prd, '#f6ffed', '#b7eb8f', 'var(--color-status-risk-low)', 'var(--color-status-risk-low)')}
          {/* Stuck / Failed quick-filters */}
          {stuckTRs.length > 0 && (
            <>
              <div className="pipeline-divider" />
              <Tooltip title="Stuck TRs (>5 days not in PRD)">
                <div className="text-center cursor-pointer min-w-64"
                  onClick={() => setPipelineFilter(pipelineFilter === 'STUCK' ? null : 'STUCK')}>
                  <div className="pipeline-box"
                    style={{ background: pipelineFilter === 'STUCK' ? 'var(--color-status-risk-medium)' : '#fffbe6', border: `2px solid ${pipelineFilter === 'STUCK' ? 'var(--color-status-risk-medium)' : '#ffe58f'}` }}>
                    <Text strong className="fs-24" style={{ color: pipelineFilter === 'STUCK' ? '#fff' : 'var(--color-status-risk-medium)' }}>{stuckTRs.length}</Text>
                    <br /><Text className="fs-12" style={{ color: pipelineFilter === 'STUCK' ? 'rgba(255,255,255,.8)' : undefined }} type={pipelineFilter === 'STUCK' ? undefined : 'secondary'}>Stuck</Text>
                  </div>
                </div>
              </Tooltip>
            </>
          )}
          {failedTRs.length > 0 && (
            <Tooltip title="Failed imports (RC >= 8)">
              <div className="text-center cursor-pointer min-w-64"
                onClick={() => setPipelineFilter(pipelineFilter === 'FAILED' ? null : 'FAILED')}>
                <div className="pipeline-box"
                  style={{ background: pipelineFilter === 'FAILED' ? 'var(--color-status-risk-high)' : '#fff2f0', border: `2px solid ${pipelineFilter === 'FAILED' ? 'var(--color-status-risk-high)' : '#ffccc7'}` }}>
                  <Text strong className="fs-24" style={{ color: pipelineFilter === 'FAILED' ? '#fff' : 'var(--color-status-risk-high)' }}>{failedTRs.length}</Text>
                  <br /><Text className="fs-12" style={{ color: pipelineFilter === 'FAILED' ? 'rgba(255,255,255,.8)' : undefined }} type={pipelineFilter === 'FAILED' ? undefined : 'secondary'}>Failed</Text>
                </div>
              </div>
            </Tooltip>
          )}
        </div>
        <div className="text-center mt-8" style={{ marginBottom: pipelineFilter ? 12 : 0 }}>
          <Progress
            percent={Math.round((pipeline.prd / pipeline.total) * 100)}
            strokeColor={{ '0%': '#1677ff', '100%': 'var(--color-status-risk-low)' }}
            format={(pct) => `${pct}% deployed`}
            className="pipeline-progress"
          />
        </div>
        {/* Inline pipeline results */}
        {pipelineFilter && (
          <div className="mt-4">
            <Text strong className="mb-8 d-block">
              {pipelineFilter === 'STUCK' ? `Stuck Transports (${pipelineResults.length})` :
               pipelineFilter === 'FAILED' ? `Failed Imports (${pipelineResults.length})` :
               `${pipelineFilter} Transports (${pipelineResults.length})`}
            </Text>
            <Table dataSource={pipelineResults} columns={pipelineTrCols} rowKey="trNumber" size="small"
              pagination={{ pageSize: 8, size: 'small' }} scroll={{ x: 800 }} loading={trLoading} />
          </div>
        )}
      </Card>

      {/* 🧪 Test Status + Upcoming Go-Lives 🧪 */}
      <Row gutter={[12, 12]} className="mt-12 equal-height-row">
        <Col xs={24} xl={14}>
          <Card title={<Space><ExperimentOutlined /> Test Status (All Active Items)</Space>} size="small">
            <Row gutter={16} align="middle">
              <Col span={6} className="text-center">
                <Progress type="circle" percent={testSummary.passRate} size={80}
                  strokeColor={testSummary.passRate >= 80 ? 'var(--color-status-risk-low)' : testSummary.passRate >= 50 ? 'var(--color-status-risk-medium)' : 'var(--color-status-risk-high)'} />
                <br /><Text type="secondary" className="fs-11">Pass Rate</Text>
              </Col>
              <Col span={6} className="text-center">
                <Progress type="circle" percent={testSummary.executionRate} size={80}
                  strokeColor="#1677ff" format={(pct) => `${pct}%`} />
                <br /><Text type="secondary" className="fs-11">Executed</Text>
              </Col>
              <Col span={12}>
                <Space direction="vertical" size={4} className="w-full">
                  <div className="flex-between">
                    <Text><CheckCircleOutlined className="text-green" /> Passed</Text>
                    <Text strong className="text-green">{testSummary.passed}</Text>
                  </div>
                  <div className="flex-between">
                    <Text><ExclamationCircleOutlined className="text-red" /> Failed</Text>
                    <Text strong style={{ color: testSummary.failed > 0 ? 'var(--color-status-risk-high)' : undefined }}>{testSummary.failed}</Text>
                  </div>
                  <div className="flex-between">
                    <Text><StopOutlined className="text-amber" /> Blocked</Text>
                    <Text strong style={{ color: testSummary.blocked > 0 ? 'var(--color-status-risk-medium)' : undefined }}>{testSummary.blocked}</Text>
                  </div>
                  <div className="flex-between">
                    <Text><ClockCircleOutlined className="text-disabled" /> TBD / Not Run</Text>
                    <Text strong>{testSummary.tbd + testSummary.notRun}</Text>
                  </div>
                  <div className="test-total-row">
                    <Text strong>Total Cases</Text>
                    <Text strong>{testSummary.totalCases}</Text>
                  </div>
                </Space>
              </Col>
            </Row>
            {/* Stacked bar */}
            {testSummary.totalCases > 0 && (
              <div className="test-stacked-bar">
                {testSummary.passed > 0 && <Tooltip title={`Passed: ${testSummary.passed}`}><div className="bg-green" style={{ width: `${(testSummary.passed / testSummary.totalCases) * 100}%` }} /></Tooltip>}
                {testSummary.failed > 0 && <Tooltip title={`Failed: ${testSummary.failed}`}><div className="bg-red" style={{ width: `${(testSummary.failed / testSummary.totalCases) * 100}%` }} /></Tooltip>}
                {testSummary.blocked > 0 && <Tooltip title={`Blocked: ${testSummary.blocked}`}><div className="bg-amber" style={{ width: `${(testSummary.blocked / testSummary.totalCases) * 100}%` }} /></Tooltip>}
                {(testSummary.tbd + testSummary.notRun) > 0 && <Tooltip title={`TBD/Not Run: ${testSummary.tbd + testSummary.notRun}`}><div className="bg-gray-light" style={{ width: `${((testSummary.tbd + testSummary.notRun) / testSummary.totalCases) * 100}%` }} /></Tooltip>}
                {testSummary.skipped > 0 && <Tooltip title={`Skipped: ${testSummary.skipped}`}><div className="bg-gray" style={{ width: `${(testSummary.skipped / testSummary.totalCases) * 100}%` }} /></Tooltip>}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title={<Space><RocketOutlined /> Upcoming Go-Lives</Space>} size="small">
            {upcomingGoLives.length === 0 ? (
              <Empty description="No go-lives in the next 30 days" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={upcomingGoLives.slice(0, 5).map((wi: any) => ({
                  color: wi.daysLeft <= 0 ? 'red' : wi.daysLeft <= 7 ? 'orange' : 'blue',
                  children: (
                    <div className="cursor-pointer" onClick={() => navigate(`/workitem/${wi.ID}`)}>
                      <Text strong>{wi.workItemName}</Text>
                      <br />
                      <Text type="secondary">{wi.goLiveDate} — <Tag color={wi.daysLeft <= 7 ? 'red' : 'blue'}>{wi.daysLeft}d left</Tag></Text>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 📋 Active Work Items 📋 */}
      <Card title={<Space><ProjectOutlined /> Active Work Items</Space>} className="mt-12 active-items-card" size="small"
        extra={<a onClick={() => navigate('/tracker')}>View All →</a>}>
        {wiLoading ? <Skeleton active /> : activeProjects.length === 0 ? (
          <Empty description="No active items" />
        ) : (
          <List
            dataSource={activeProjects.slice(0, 10)}
            renderItem={(project: any) => {
              const projectTRs = transports.filter((t: any) => t.workItem_ID === project.ID);
              const prdCount = projectTRs.filter((t: any) => t.currentSystem === 'PRD').length;
              const totalCount = projectTRs.length || project.estimatedTRCount || 1;
              const deployPct = project.deploymentPct || Math.round((prdCount / totalCount) * 100);
              const rag = project.overallRAG || calculateRAG({ goLiveDate: project.goLiveDate, deploymentPct: deployPct, status: project.status, overallRAG: project.overallRAG });
              const projectStuck = projectTRs.filter((t: any) => {
                if (t.currentSystem === 'PRD') return false;
                return (Date.now() - new Date(t.createdDate).getTime()) / 86400000 > 5;
              });
              const projectFailed = projectTRs.filter((t: any) => t.importRC >= 8);

              return (
                <List.Item className="cursor-pointer py-10 px-0" onClick={() => navigate(`/workitem/${project.ID}`)}>
                  <List.Item.Meta
                    avatar={<span className="fs-18">{RAG_ICONS[rag]}</span>}
                    title={
                      <Space size={4}>
                        <Text strong className="fs-13">{project.workItemName}</Text>
                        <Tag color={project.workItemType === 'Project' ? 'blue' : project.workItemType === 'Enhancement' ? 'cyan' : project.workItemType === 'Break-fix' ? 'red' : 'default'} className="fs-10">
                          {project.workItemType}
                        </Tag>
                        {project.goLiveDate && <Tag color={daysFromNow(project.goLiveDate) <= 7 ? 'red' : 'blue'} className="fs-10">📅 {project.goLiveDate} ({daysFromNow(project.goLiveDate)}d)</Tag>}
                      </Space>
                    }
                    description={
                      <Space size={8}>
                        <Progress percent={deployPct} size="small" className="w-160" strokeColor={RAG_COLORS[rag]} />
                        <Text type="secondary" className="fs-12">{prdCount}/{totalCount} PRD</Text>
                        {projectStuck.length > 0 && <Tag color="warning" className="fs-10">⏳ {projectStuck.length} stuck</Tag>}
                        {projectFailed.length > 0 && <Tag color="error" className="fs-10">❌ {projectFailed.length} failed</Tag>}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* ⚠️ Pending Items (clickable) ⚠️ */}
      <div id="pending-items">
        {pendingItems.length > 0 && (
          <Card title={<Space><WarningOutlined /> Pending Items ({pendingItems.length})</Space>} className="mt-12" size="small">
            <List
              size="small"
              dataSource={pendingItems}
              renderItem={(item: any) => (
                <List.Item className="cursor-pointer py-6 px-0"
                  onClick={() => {
                    if (item.workItem_ID) navigate(`/workitem/${item.workItem_ID}`);
                    else navigate(`/tracker/tr-search?q=${item.trNumber}`);
                  }}>
                  <Space>
                    {item.icon}
                    <Text className="fs-13">{item.text}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}
      </div>

      {/* ✅ Recently Deployed to PRD ✅ */}
      {completedPrd.length > 0 && (
        <Card title={<Space><CheckCircleOutlined className="text-green" /> Recently Deployed to PRD</Space>} className="mt-12" size="small">
          <List size="small" dataSource={completedPrd.slice(0, 5)}
            renderItem={(tr: any) => (
              <List.Item className="py-4 px-0">
                <Text className="fs-13">
                  <CheckCircleOutlined className="text-green mr-4" />
                  <Text copyable={{ text: tr.trNumber }} className="fs-13">{tr.trNumber}</Text> — {tr.trDescription?.substring(0, 80)}
                </Text>
              </List.Item>
            )} />
        </Card>
      )}
    </div>
  );
};

export default HomeDashboardClassic;
