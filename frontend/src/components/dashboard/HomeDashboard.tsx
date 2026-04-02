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

const RAG_COLORS: Record<string, string> = { GREEN: '#52c41a', AMBER: '#faad14', RED: '#ff4d4f' };
const RAG_ICONS: Record<string, string> = { GREEN: '🟢', AMBER: '🟡', RED: '🔴' };
const SYS_COLORS: Record<string, string> = { DEV: 'blue', QAS: 'orange', PRD: 'green' };

const HomeDashboard: React.FC = () => {
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

  // ── Transport Pipeline stats ──
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

  // ── Test Status summary (aggregated from WorkItem-level test fields) ──
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

  // ── Upcoming go-lives (within 30 days) ──
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
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      text: `${tr.trNumber} — failed import (RC=${tr.importRC}) in ${tr.currentSystem}`,
      type: 'error', trNumber: tr.trNumber, workItem_ID: tr.workItem_ID,
    })),
    ...stuckTRs.slice(0, 10).map((tr: any) => ({
      icon: <ClockCircleOutlined style={{ color: '#faad14' }} />,
      text: `${tr.trNumber} — stuck in ${tr.currentSystem} > 5 days (${tr.ownerFullName || tr.trOwner})`,
      type: 'warning', trNumber: tr.trNumber, workItem_ID: tr.workItem_ID,
    })),
    ...unassigned.slice(0, 5).map((tr: any) => ({
      icon: <WarningOutlined style={{ color: '#1677ff' }} />,
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

  // Reusable banner KPI with click
  const bannerKpi = (label: string, value: number | string, color: string, onClick?: () => void) => (
    <Tooltip title={onClick ? `Click to view ${label}` : undefined}>
      <div style={{ textAlign: 'center', cursor: onClick ? 'pointer' : 'default', padding: '4px 16px', borderRadius: 8, transition: 'background 0.2s' }}
        onClick={onClick}
        onMouseEnter={(e) => onClick && (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
        <div style={{ color, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{label}</div>
      </div>
    </Tooltip>
  );

  // Reusable pipeline box
  const pipelineBox = (sys: string, count: number, bg: string, borderColor: string, activeBg: string, textColor: string) => {
    const isActive = pipelineFilter === sys;
    return (
      <Tooltip title={`Click to view ${sys} transports`}>
        <div style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }}
          onClick={() => setPipelineFilter(isActive ? null : sys)}>
          <div style={{
            background: isActive ? activeBg : bg, borderRadius: 8, padding: '12px 8px',
            border: `2px solid ${isActive ? activeBg : borderColor}`, transition: 'all 0.2s',
          }}>
            <Text strong style={{ fontSize: 24, color: isActive ? '#fff' : textColor }}>{count}</Text>
            <br /><Text style={{ color: isActive ? 'rgba(255,255,255,.8)' : undefined }} type={isActive ? undefined : 'secondary'}>{sys}</Text>
          </div>
        </div>
      </Tooltip>
    );
  };

  return (
    <div>
      {/* ── Welcome Banner with clickable KPIs ── */}
      <Card
        style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)', border: 'none' }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              <DashboardOutlined /> Command Center
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, display: 'block' }}>
              Welcome back, <strong>{user?.name || 'User'}</strong>
              {user?.roles && user.roles.length > 0 && <Tag color="gold" style={{ marginLeft: 8 }}>{user.roles[0]}</Tag>}
            </Text>
          </Col>
          <Col>
            <Space size="large">
              {bannerKpi('Total Transports', transports.length, '#fff', () => navigate('/tracker/tr-search'))}
              {bannerKpi('Active Items', activeProjects.length, '#fff', () => navigate('/tracker'))}
              {needAttention > 0 &&
                bannerKpi('Need Attention', needAttention, '#faad14', () => {
                  document.getElementById('pending-items')?.scrollIntoView({ behavior: 'smooth' });
                })
              }
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Summary Cards ── */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/tracker/Project')} size="small">
            <Statistic title="Projects" value={summaryLoading ? '-' : (summary?.activeProjects ?? workItems.filter((w: any) => w.workItemType === 'Project').length)}
              prefix={<ProjectOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/tracker/Enhancement')} size="small">
            <Statistic title="Enhancements" value={workItems.filter((w: any) => w.workItemType === 'Enhancement' && w.status === 'Active').length}
              prefix={<CodeOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/tracker/Break-fix')} size="small">
            <Statistic title="Break-Fixes" value={workItems.filter((w: any) => w.workItemType === 'Break-fix' && w.status === 'Active').length}
              prefix={<BugOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card hoverable onClick={() => navigate('/unassigned')} size="small">
            <Statistic title="Unassigned TRs" value={summaryLoading ? '-' : (summary?.unassignedCount ?? unassigned.length)}
              prefix={<WarningOutlined />} valueStyle={{ color: unassigned.length > 0 ? '#faad14' : '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => document.getElementById('pending-items')?.scrollIntoView({ behavior: 'smooth' })} size="small">
            <Statistic title="Pending" value={pendingItems.length}
              prefix={<ClockCircleOutlined />} valueStyle={{ color: pendingItems.length > 0 ? '#faad14' : '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* ── Transport Pipeline (clickable, inline results) ── */}
      <Card title={<Space><CloudServerOutlined /> Transport Pipeline</Space>} size="small" style={{ marginTop: 12 }}
        extra={pipelineFilter && <a onClick={() => setPipelineFilter(null)}>Clear filter</a>}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
          {pipelineBox('DEV', pipeline.dev, '#e6f4ff', '#91caff', '#1677ff', '#1677ff')}
          <ArrowRightOutlined style={{ fontSize: 18, color: '#bbb' }} />
          {pipelineBox('QAS', pipeline.qas, '#fff7e6', '#ffd591', '#fa8c16', '#fa8c16')}
          <ArrowRightOutlined style={{ fontSize: 18, color: '#bbb' }} />
          {pipelineBox('PRD', pipeline.prd, '#f6ffed', '#b7eb8f', '#52c41a', '#52c41a')}
          {/* Stuck / Failed quick-filters */}
          {stuckTRs.length > 0 && (
            <>
              <div style={{ width: 1, height: 40, background: '#f0f0f0', margin: '0 4px' }} />
              <Tooltip title="Stuck TRs (>5 days not in PRD)">
                <div style={{ textAlign: 'center', cursor: 'pointer', minWidth: 64 }}
                  onClick={() => setPipelineFilter(pipelineFilter === 'STUCK' ? null : 'STUCK')}>
                  <div style={{
                    background: pipelineFilter === 'STUCK' ? '#faad14' : '#fffbe6', borderRadius: 8, padding: '12px 8px',
                    border: `2px solid ${pipelineFilter === 'STUCK' ? '#faad14' : '#ffe58f'}`, transition: 'all 0.2s',
                  }}>
                    <Text strong style={{ fontSize: 24, color: pipelineFilter === 'STUCK' ? '#fff' : '#faad14' }}>{stuckTRs.length}</Text>
                    <br /><Text style={{ color: pipelineFilter === 'STUCK' ? 'rgba(255,255,255,.8)' : undefined, fontSize: 12 }} type={pipelineFilter === 'STUCK' ? undefined : 'secondary'}>Stuck</Text>
                  </div>
                </div>
              </Tooltip>
            </>
          )}
          {failedTRs.length > 0 && (
            <Tooltip title="Failed imports (RC >= 8)">
              <div style={{ textAlign: 'center', cursor: 'pointer', minWidth: 64 }}
                onClick={() => setPipelineFilter(pipelineFilter === 'FAILED' ? null : 'FAILED')}>
                <div style={{
                  background: pipelineFilter === 'FAILED' ? '#ff4d4f' : '#fff2f0', borderRadius: 8, padding: '12px 8px',
                  border: `2px solid ${pipelineFilter === 'FAILED' ? '#ff4d4f' : '#ffccc7'}`, transition: 'all 0.2s',
                }}>
                  <Text strong style={{ fontSize: 24, color: pipelineFilter === 'FAILED' ? '#fff' : '#ff4d4f' }}>{failedTRs.length}</Text>
                  <br /><Text style={{ color: pipelineFilter === 'FAILED' ? 'rgba(255,255,255,.8)' : undefined, fontSize: 12 }} type={pipelineFilter === 'FAILED' ? undefined : 'secondary'}>Failed</Text>
                </div>
              </div>
            </Tooltip>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, marginBottom: pipelineFilter ? 12 : 0 }}>
          <Progress
            percent={Math.round((pipeline.prd / pipeline.total) * 100)}
            strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
            format={(pct) => `${pct}% deployed`}
            style={{ maxWidth: 400, margin: '0 auto' }}
          />
        </div>
        {/* Inline pipeline results */}
        {pipelineFilter && (
          <div style={{ marginTop: 4 }}>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>
              {pipelineFilter === 'STUCK' ? `Stuck Transports (${pipelineResults.length})` :
               pipelineFilter === 'FAILED' ? `Failed Imports (${pipelineResults.length})` :
               `${pipelineFilter} Transports (${pipelineResults.length})`}
            </Text>
            <Table dataSource={pipelineResults} columns={pipelineTrCols} rowKey="trNumber" size="small"
              pagination={{ pageSize: 8, size: 'small' }} scroll={{ x: 800 }} loading={trLoading} />
          </div>
        )}
      </Card>

      {/* ── Test Status + Upcoming Go-Lives ── */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card title={<Space><ExperimentOutlined /> Test Status (All Active Items)</Space>} size="small">
            <Row gutter={16} align="middle">
              <Col span={6} style={{ textAlign: 'center' }}>
                <Progress type="circle" percent={testSummary.passRate} size={80}
                  strokeColor={testSummary.passRate >= 80 ? '#52c41a' : testSummary.passRate >= 50 ? '#faad14' : '#ff4d4f'} />
                <br /><Text type="secondary" style={{ fontSize: 11 }}>Pass Rate</Text>
              </Col>
              <Col span={6} style={{ textAlign: 'center' }}>
                <Progress type="circle" percent={testSummary.executionRate} size={80}
                  strokeColor="#1677ff" format={(pct) => `${pct}%`} />
                <br /><Text type="secondary" style={{ fontSize: 11 }}>Executed</Text>
              </Col>
              <Col span={12}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text><CheckCircleOutlined style={{ color: '#52c41a' }} /> Passed</Text>
                    <Text strong style={{ color: '#52c41a' }}>{testSummary.passed}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> Failed</Text>
                    <Text strong style={{ color: testSummary.failed > 0 ? '#ff4d4f' : undefined }}>{testSummary.failed}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text><StopOutlined style={{ color: '#faad14' }} /> Blocked</Text>
                    <Text strong style={{ color: testSummary.blocked > 0 ? '#faad14' : undefined }}>{testSummary.blocked}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text><ClockCircleOutlined style={{ color: '#bbb' }} /> TBD / Not Run</Text>
                    <Text strong>{testSummary.tbd + testSummary.notRun}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', paddingTop: 4 }}>
                    <Text strong>Total Cases</Text>
                    <Text strong>{testSummary.totalCases}</Text>
                  </div>
                </Space>
              </Col>
            </Row>
            {/* Stacked bar */}
            {testSummary.totalCases > 0 && (
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 12 }}>
                {testSummary.passed > 0 && <Tooltip title={`Passed: ${testSummary.passed}`}><div style={{ width: `${(testSummary.passed / testSummary.totalCases) * 100}%`, background: '#52c41a' }} /></Tooltip>}
                {testSummary.failed > 0 && <Tooltip title={`Failed: ${testSummary.failed}`}><div style={{ width: `${(testSummary.failed / testSummary.totalCases) * 100}%`, background: '#ff4d4f' }} /></Tooltip>}
                {testSummary.blocked > 0 && <Tooltip title={`Blocked: ${testSummary.blocked}`}><div style={{ width: `${(testSummary.blocked / testSummary.totalCases) * 100}%`, background: '#faad14' }} /></Tooltip>}
                {(testSummary.tbd + testSummary.notRun) > 0 && <Tooltip title={`TBD/Not Run: ${testSummary.tbd + testSummary.notRun}`}><div style={{ width: `${((testSummary.tbd + testSummary.notRun) / testSummary.totalCases) * 100}%`, background: '#d9d9d9' }} /></Tooltip>}
                {testSummary.skipped > 0 && <Tooltip title={`Skipped: ${testSummary.skipped}`}><div style={{ width: `${(testSummary.skipped / testSummary.totalCases) * 100}%`, background: '#bfbfbf' }} /></Tooltip>}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<Space><RocketOutlined /> Upcoming Go-Lives</Space>} size="small">
            {upcomingGoLives.length === 0 ? (
              <Empty description="No go-lives in the next 30 days" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={upcomingGoLives.slice(0, 5).map((wi: any) => ({
                  color: wi.daysLeft <= 0 ? 'red' : wi.daysLeft <= 7 ? 'orange' : 'blue',
                  children: (
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/workitem/${wi.ID}`)}>
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

      {/* ── Active Work Items ── */}
      <Card title={<Space><ProjectOutlined /> Active Work Items</Space>} style={{ marginTop: 12 }} size="small"
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
                <List.Item style={{ cursor: 'pointer', padding: '10px 0' }} onClick={() => navigate(`/workitem/${project.ID}`)}>
                  <List.Item.Meta
                    avatar={<span style={{ fontSize: 18 }}>{RAG_ICONS[rag]}</span>}
                    title={
                      <Space size={4}>
                        <Text strong style={{ fontSize: 13 }}>{project.workItemName}</Text>
                        <Tag color={project.workItemType === 'Project' ? 'blue' : project.workItemType === 'Enhancement' ? 'cyan' : project.workItemType === 'Break-fix' ? 'red' : 'default'} style={{ fontSize: 10 }}>
                          {project.workItemType}
                        </Tag>
                        {project.goLiveDate && <Tag color={daysFromNow(project.goLiveDate) <= 7 ? 'red' : 'blue'} style={{ fontSize: 10 }}>🚀 {project.goLiveDate} ({daysFromNow(project.goLiveDate)}d)</Tag>}
                      </Space>
                    }
                    description={
                      <Space size={8}>
                        <Progress percent={deployPct} size="small" style={{ width: 160 }} strokeColor={RAG_COLORS[rag]} />
                        <Text type="secondary" style={{ fontSize: 12 }}>{prdCount}/{totalCount} PRD</Text>
                        {projectStuck.length > 0 && <Tag color="warning" style={{ fontSize: 10 }}>⚠ {projectStuck.length} stuck</Tag>}
                        {projectFailed.length > 0 && <Tag color="error" style={{ fontSize: 10 }}>❌ {projectFailed.length} failed</Tag>}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* ── Pending Items (clickable) ── */}
      <div id="pending-items">
        {pendingItems.length > 0 && (
          <Card title={<Space><WarningOutlined /> Pending Items ({pendingItems.length})</Space>} style={{ marginTop: 12 }} size="small">
            <List
              size="small"
              dataSource={pendingItems}
              renderItem={(item: any) => (
                <List.Item style={{ cursor: 'pointer', padding: '6px 0' }}
                  onClick={() => {
                    if (item.workItem_ID) navigate(`/workitem/${item.workItem_ID}`);
                    else navigate(`/tracker/tr-search?q=${item.trNumber}`);
                  }}>
                  <Space>
                    {item.icon}
                    <Text style={{ fontSize: 13 }}>{item.text}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}
      </div>

      {/* ── Recently Deployed to PRD ── */}
      {completedPrd.length > 0 && (
        <Card title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /> Recently Deployed to PRD</Space>} style={{ marginTop: 12 }} size="small">
          <List size="small" dataSource={completedPrd.slice(0, 5)}
            renderItem={(tr: any) => (
              <List.Item style={{ padding: '4px 0' }}>
                <Text style={{ fontSize: 13 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                  <Text copyable={{ text: tr.trNumber }} style={{ fontSize: 13 }}>{tr.trNumber}</Text> — {tr.trDescription?.substring(0, 80)}
                </Text>
              </List.Item>
            )} />
        </Card>
      )}
    </div>
  );
};

export default HomeDashboard;
