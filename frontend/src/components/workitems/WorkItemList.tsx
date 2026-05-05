import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Table, Tag, Space, Input, Select, Button, Typography, Tooltip, Progress,
  Tabs, Row, Col, Empty, Badge, Modal, Form, DatePicker, message
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, FileExcelOutlined,
  ProjectOutlined, CodeOutlined, BugOutlined, AppstoreOutlined,
  SwapOutlined, CustomerServiceOutlined, SafetyOutlined,
  PlusOutlined, DownloadOutlined, UserOutlined, WarningOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkItems, useTransports, useCreateWorkItem } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { useModule, ModuleKey } from '../../contexts/ModuleContext';
import { calculateRAG, daysFromNow, WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';
import type { WorkItem, Transport, Milestone } from '@/types';

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Done', label: 'Done' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const TAB_CONFIGS: Record<ModuleKey, { key: string; label: string; icon: React.ReactNode }[]> = {
  sap: [
    { key: '', label: 'All', icon: <AppstoreOutlined /> },
    { key: 'Project', label: 'Projects', icon: <ProjectOutlined /> },
    { key: 'Enhancement', label: 'Enhancements', icon: <CodeOutlined /> },
    { key: 'Break-fix', label: 'Break Fix / Request', icon: <BugOutlined /> },
    { key: 'Upgrade', label: 'Upgrades', icon: <SwapOutlined /> },
    { key: 'Support', label: 'Support', icon: <CustomerServiceOutlined /> },
    { key: 'Hypercare', label: 'Hypercare', icon: <SafetyOutlined /> },
    { key: 'tr-search', label: 'TR Search', icon: <SearchOutlined /> },
  ],
};

const WorkItemList: React.FC = () => {
  const { type } = useParams<{ type?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: allWorkItems = [], isLoading: wiLoading, refetch } = useWorkItems();
  const { data: transports = [], isLoading: trLoading } = useTransports();
  const { activeModule } = useModule();
  const { canWrite, user } = useAuth();
  const createMutation = useCreateWorkItem();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [myItemsOnly, setMyItemsOnly] = useState(false);

  // Filter work items by active application module (or show all when ?app=all)
  const appParam = searchParams.get('app');
  const showAllApps = appParam === 'all';
  const APP_MAP: Record<string, string> = { sap: 'SAP' };
  const workItems = allWorkItems.filter((wi: WorkItem) => {
    if (showAllApps) return true; // Executive dashboard cross-app view
    if (appParam && APP_MAP[appParam]) return wi.application === APP_MAP[appParam];
    const appKey = APP_MAP[activeModule] || 'SAP';
    return wi.application === appKey || (!wi.application && activeModule === 'sap');
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const ragParam = searchParams.get('rag') || '';

  // TR Search state
  const [trSearchTerm, setTrSearchTerm] = useState(searchParams.get('q') || '');
  const [trSystemFilter, setTrSystemFilter] = useState(searchParams.get('system') || '');
  const [trStatusFilter, setTrStatusFilter] = useState('');

  const activeTab = type || '';

  const handleTabChange = (key: string) => {
    if (key === 'tr-search') {
      navigate('/tracker/tr-search');
    } else if (key) {
      navigate(`/tracker/${key}`);
    } else {
      navigate('/tracker');
    }
    setSearchTerm('');
    setStatusFilter('');
  };

  // ── Work Items table ──
  // Treat 'Complete'/'Completed'/'Done' as synonyms so drill-downs work
  // regardless of whether data comes from RFC (Complete) or local writes (Done).
  const DONE_SYNONYMS = ['complete', 'completed', 'done'];

  const isAtRisk = (item: WorkItem): boolean => {
    if (!item.goLiveDate) return false;
    const days = daysFromNow(new Date(item.goLiveDate));
    return days >= 0 && days <= 14 && (item.deploymentPct || 0) < 70;
  };

  const filteredItems = useMemo(() => {
    const typeKey = activeTab === 'tr-search' ? '' : activeTab;
    const userName = user?.name?.toLowerCase() || '';
    return workItems.filter((item: WorkItem) => {
      const matchesType = !typeKey || item.workItemType === typeKey;
      const matchesStatus = !statusFilter ||
        (DONE_SYNONYMS.includes(statusFilter.toLowerCase())
          ? DONE_SYNONYMS.includes((item.status || '').toLowerCase())
          : item.status === statusFilter);
      const matchesRag = !ragParam ||
        (item.overallRAG || calculateRAG(item)) === ragParam.toUpperCase();
      const matchesSearch =
        !searchTerm ||
        item.workItemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.businessOwner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.snowTicket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.leadDeveloper?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.projectCode?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMyItems = !myItemsOnly || !userName || (
        item.leadDeveloper?.toLowerCase().includes(userName) ||
        item.businessOwner?.toLowerCase().includes(userName) ||
        item.systemOwner?.toLowerCase().includes(userName) ||
        item.functionalLead?.toLowerCase().includes(userName) ||
        item.qaLead?.toLowerCase().includes(userName)
      );
      return matchesType && matchesStatus && matchesRag && matchesSearch && matchesMyItems;
    });
  }, [workItems, activeTab, statusFilter, ragParam, searchTerm, myItemsOnly, user]);

  const handleExportCSV = () => {
    const headers = ['Name', 'Type', 'Status', 'RAG', 'Progress %', 'Go-Live', 'Business Owner', 'Lead Developer', 'SNOW', 'Priority', 'Phase'];
    const rows = filteredItems.map((item: WorkItem) => [
      `"${(item.workItemName || '').replace(/"/g, '""')}"`,
      item.workItemType || '',
      item.status || '',
      item.overallRAG || calculateRAG(item),
      item.deploymentPct || 0,
      item.goLiveDate || '',
      `"${(item.businessOwner || '').replace(/"/g, '""')}"`,
      `"${(item.leadDeveloper || '').replace(/"/g, '""')}"`,
      item.snowTicket || '',
      item.priority || '',
      item.currentPhase || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-items-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── TR search results ──
  const trResults = useMemo(() => {
    if (!trSearchTerm && !trSystemFilter && !trStatusFilter) return [];
    const term = trSearchTerm.toLowerCase();
    return transports.filter((t: Transport) => {
      const matchesSearch =
        !term ||
        t.trNumber?.toLowerCase().includes(term) ||
        t.trDescription?.toLowerCase().includes(term) ||
        t.trOwner?.toLowerCase().includes(term) ||
        t.ownerFullName?.toLowerCase().includes(term);
      const matchesSystem = !trSystemFilter || t.currentSystem === trSystemFilter;
      const matchesStatus = !trStatusFilter || t.trStatus === trStatusFilter;
      return matchesSearch && matchesSystem && matchesStatus;
    });
  }, [transports, trSearchTerm, trSystemFilter, trStatusFilter]);

  // ── Counts for tab badges ──
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { '': workItems.length };
    for (const wi of workItems) {
      const t = wi.workItemType || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [workItems]);

  const wiColumns = [
    ...(showAllApps ? [{
      title: 'App',
      dataIndex: 'application',
      key: 'application',
      width: 100,
      filters: [
        { text: 'SAP', value: 'SAP' },
      ],
      onFilter: (v: any, r: any) => r.application === v,
      render: (app: string) => <Tag color="#1677ff">{app}</Tag>,
    }] : []),
    {
      title: 'Name',
      dataIndex: 'workItemName',
      key: 'name',
      sorter: (a: any, b: any) => (a.workItemName || '').localeCompare(b.workItemName || ''),
      render: (text: string, record: any) => (
        <Space size={4}>
          <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/workitem/${record.ID}`)}>
            {text}
          </Button>
          {isAtRisk(record) && (
            <Tooltip title="At risk: go-live in ≤14 days but deployment < 70%">
              <WarningOutlined style={{ color: '#faad14', fontSize: 14 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    ...(activeTab === '' ? [{
      title: 'Type',
      dataIndex: 'workItemType',
      key: 'workItemType',
      render: (wt: string) => (
        <Tag color={WORK_TYPE_COLORS[wt] || 'default'}>
          {WORK_TYPE_MAP[wt] || wt}
        </Tag>
      ),
    }] : []),
    {
      title: 'RAG',
      key: 'rag',
      width: 60,
      render: (_: any, record: any) => {
        const rag = record.overallRAG || calculateRAG(record);
        const colors: Record<string, string> = { RED: 'var(--color-status-risk-high)', AMBER: 'var(--color-status-risk-medium)', GREEN: 'var(--color-status-risk-low)' };
        return (
          <Tooltip title={`RAG: ${rag}`}>
            <div
              className="wi-rag-dot"
              style={{ backgroundColor: colors[rag] || '#d9d9d9' }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          Active: 'processing', 'On Hold': 'warning',
          Done: 'success', Complete: 'success', Completed: 'success',
          Cancelled: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status || '—'}</Tag>;
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 130,
      render: (_: any, record: any) => <Progress percent={Math.round(record.deploymentPct || 0)} size="small" />,
    },
    {
      title: 'Tests',
      key: 'tests',
      width: 90,
      render: (_: any, record: any) => {
        const total = record.testTotal || 0;
        if (total === 0) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        const pct = Math.round(record.testCompletionPct || 0);
        return (
          <Tooltip title={`${record.testPassed || 0} passed / ${record.testFailed || 0} failed / ${total} total`}>
            <Progress
              percent={pct}
              size="small"
              strokeColor={pct >= 80 ? '#52c41a' : pct >= 50 ? '#fa8c16' : '#ff4d4f'}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Owner',
      dataIndex: 'businessOwner',
      key: 'owner',
      sorter: (a: any, b: any) => (a.businessOwner || '').localeCompare(b.businessOwner || ''),
    },
    {
      title: 'Go-Live',
      dataIndex: 'goLiveDate',
      key: 'goLiveDate',
      sorter: (a: any, b: any) => new Date(a.goLiveDate || 0).getTime() - new Date(b.goLiveDate || 0).getTime(),
      render: (date: string) => {
        if (!date) return '—';
        const d = new Date(date);
        const days = daysFromNow(d);
        return (
          <Tooltip title={`${days} days remaining`}>
            <span className={typeof days === 'number' && days <= 7 ? 'wi-golive-urgent' : typeof days === 'number' && days <= 14 ? 'wi-golive-soon' : ''}>
              {d.toLocaleDateString()}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'SNOW',
      dataIndex: 'snowTicket',
      key: 'snowTicket',
      render: (ticket: string) => ticket || '—',
    },
    {
      title: 'SP',
      key: 'sharepoint',
      width: 50,
      render: (_: any, record: any) => (
        record.sharepointUrl ? (
          <Tooltip title="Open SharePoint Tracker">
            <a href={record.sharepointUrl} target="_blank" rel="noopener noreferrer" title="Open SharePoint Tracker">
              <FileExcelOutlined className="wi-icon-sp-linked" />
            </a>
          </Tooltip>
        ) : (
          <Tooltip title="No tracker linked">
            <FileExcelOutlined className="wi-icon-sp-none" />
          </Tooltip>
        )
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 40,
      render: (_: any, record: any) => (
        <Tooltip title="View details">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/workitem/${record.ID}`)} />
        </Tooltip>
      ),
    },
  ];

  const trColumns = [
    {
      title: 'TR Number',
      dataIndex: 'trNumber',
      key: 'trNumber',
      render: (text: string) => <Text copyable={{ text }}>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'trDescription',
      key: 'desc',
      ellipsis: true,
      width: 300,
    },
    {
      title: 'Type',
      dataIndex: 'workType',
      key: 'workType',
      render: (type: string, record: any) => {
        if (!type) return <Tag color="default">Unassigned</Tag>;
        const isManual = record.assignedBy && record.assignedBy !== 'auto-link' && record.assignedBy !== 'scheduler';
        const isAutoLinked = record.assignedBy === 'auto-link';
        const hasPrefixMatch = /^(PRJ|ENH|BRK|UPG|SUP|HYP)-(INC|CHG)\d{7}\s*\|/.test(record.trDescription || '');
        return (
          <Space size={2}>
            <Tag color={WORK_TYPE_COLORS[type] || 'default'}>{WORK_TYPE_MAP[type] || type}</Tag>
            {isManual && (
              <Tooltip title="Manually categorized">
                <Tag style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }} color="blue">M</Tag>
              </Tooltip>
            )}
            {!isManual && !hasPrefixMatch && (
              <Tooltip title={isAutoLinked ? 'Auto-linked via ticket match' : 'Keyword-based suggestion — verify'}>
                <Tag style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }} color={isAutoLinked ? 'cyan' : 'orange'}>
                  {isAutoLinked ? 'A' : '?'}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'System',
      dataIndex: 'currentSystem',
      key: 'system',
      render: (sys: string) => {
        const colors: Record<string, string> = { DEV: 'blue', QAS: 'orange', PRD: 'green' };
        return <Tag color={colors[sys] || 'default'}>{sys}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'trStatus',
      key: 'status',
      render: (s: string) => <Tag color={s === 'Released' ? 'green' : 'orange'}>{s}</Tag>,
    },
    {
      title: 'Import RC',
      dataIndex: 'importRC',
      key: 'rc',
      render: (rc: number | null) => {
        if (rc === null || rc === undefined) return '—';
        if (rc === 0) return <Tag color="success">RC=0</Tag>;
        if (rc === 4) return <Tag color="warning">RC=4</Tag>;
        return <Tag color="error">RC={rc}</Tag>;
      },
    },
    {
      title: 'Owner',
      dataIndex: 'ownerFullName',
      key: 'owner',
      render: (text: string, record: any) => text || record.trOwner,
    },
    {
      title: 'Work Item',
      dataIndex: 'workItemName',
      key: 'wi',
      render: (name: string, record: any) =>
        record.workItem_ID ? (
          <a onClick={() => navigate(`/workitem/${record.workItem_ID}`)}>{name || 'View'}</a>
        ) : '—',
    },
  ];

  return (
    <div>
      <Title level={3} className="tracker-title">
        <ProjectOutlined /> Tracker
      </Title>

      <Tabs
        activeKey={activeTab || ''}
        onChange={handleTabChange}
        type="card"
        className="tracker-tabs"
        items={(TAB_CONFIGS[activeModule] || TAB_CONFIGS.sap).map(tab => ({
          key: tab.key,
          label: (
            <Space size={4}>
              {tab.icon}
              {tab.label}
              {tab.key !== 'tr-search' && typeCounts[tab.key] !== undefined && (
                <Badge
                  count={typeCounts[tab.key]}
                  style={{ backgroundColor: tab.key === '' ? '#1677ff' : '#8c8c8c', fontSize: 10 }}
                  size="small"
                  overflowCount={999}
                />
              )}
            </Space>
          ),
        }))}
      />

      {activeTab === 'tr-search' ? (
        /* ── TR Search Tab ── */
        <>
          <Card size="small" className="tab-card-body">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Input
                  placeholder="Search by TR number, description, or owner..."
                  prefix={<SearchOutlined />}
                  value={trSearchTerm}
                  onChange={(e) => setTrSearchTerm(e.target.value)}
                  allowClear
                  size="large"
                  autoFocus
                />
              </Col>
              <Col xs={12} md={6}>
                <Select
                  placeholder="System"
                  value={trSystemFilter || undefined}
                  onChange={(v) => setTrSystemFilter(v || '')}
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { value: 'DEV', label: 'DEV' },
                    { value: 'QAS', label: 'QAS' },
                    { value: 'PRD', label: 'PRD' },
                  ]}
                />
              </Col>
              <Col xs={12} md={6}>
                <Select
                  placeholder="Status"
                  value={trStatusFilter || undefined}
                  onChange={(v) => setTrStatusFilter(v || '')}
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { value: 'Released', label: 'Released' },
                    { value: 'Modifiable', label: 'Modifiable' },
                  ]}
                />
              </Col>
            </Row>
          </Card>
          <Card>
            {!trSearchTerm && !trSystemFilter && !trStatusFilter ? (
              <Empty description="Enter a search term or apply filters to find transports" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                dataSource={trResults}
                columns={trColumns}
                loading={trLoading}
                rowKey="trNumber"
                pagination={{ pageSize: 25, showTotal: (total) => `${total} results` }}
                scroll={{ x: 1000 }}
              />
            )}
          </Card>
        </>
      ) : (
        /* ── Work Items Table ── */
        <>
          <Card size="small" className="tab-card-body">
            <Space wrap>
              <Input
                placeholder="Search name, owner, SNOW, developer..."
                prefix={<SearchOutlined />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
              <Select
                placeholder="Filter by status"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 160 }}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                Refresh
              </Button>
              <Button
                icon={<UserOutlined />}
                type={myItemsOnly ? 'primary' : 'default'}
                onClick={() => setMyItemsOnly(v => !v)}
              >
                My Items
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                Export CSV
              </Button>
              {canWrite && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                  createForm.resetFields();
                  setCreateModalOpen(true);
                }}>
                  Create Work Item
                </Button>
              )}
            </Space>
          </Card>

          <Card>
            <Table
              dataSource={filteredItems}
              columns={wiColumns}
              loading={wiLoading}
              rowKey="ID"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `${total} items`,
              }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </>
      )}

      {/* Create Work Item Modal */}
      <Modal
        title="Create Work Item"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        okText="Create"
        confirmLoading={createMutation.isPending}
        onOk={() => {
          createForm.validateFields().then(values => {
            const APP_MAP_REV: Record<string, string> = { sap: 'SAP' };
            createMutation.mutate({
              ...values,
              application: APP_MAP_REV[activeModule] || 'SAP',
              goLiveDate: values.goLiveDate ? values.goLiveDate.format('YYYY-MM-DD') : undefined,
            }, {
              onSuccess: (res) => {
                message.success(res.message);
                setCreateModalOpen(false);
                refetch();
              },
              onError: (err: any) => message.error(err.message || 'Failed to create'),
            });
          });
        }}
        width={560}
      >
        <Form form={createForm} layout="vertical" initialValues={{ priority: 'P2', complexity: 'Medium', workItemType: 'Project', currentPhase: 'Planning' }}>
          <Form.Item name="workItemName" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g., FICO GL Upgrade Phase 2" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="workItemType" label="Type">
                <Select options={(TAB_CONFIGS[activeModule] || TAB_CONFIGS.sap).filter(t => t.key && t.key !== 'tr-search').map(t => ({ value: t.key, label: t.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select options={[{ value: 'P1', label: 'P1 - Critical' }, { value: 'P2', label: 'P2 - High' }, { value: 'P3', label: 'P3 - Medium' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="complexity" label="Complexity">
                <Select options={[{ value: 'Low', label: 'Low' }, { value: 'Medium', label: 'Medium' }, { value: 'High', label: 'High' }, { value: 'Critical', label: 'Critical' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="goLiveDate" label="Go-Live Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="businessOwner" label="Business Owner">
            <Input placeholder="e.g., John Smith" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Additional context..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkItemList;
