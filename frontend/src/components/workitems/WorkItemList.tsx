import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Table, Tag, Space, Input, Select, Button, Typography, Tooltip, Progress,
  Tabs, Row, Col, Empty, Badge
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, FileExcelOutlined,
  ProjectOutlined, CodeOutlined, BugOutlined, AppstoreOutlined,
  SwapOutlined, ThunderboltOutlined, CustomerServiceOutlined, SafetyOutlined,
  ApiOutlined, ToolOutlined, DatabaseOutlined, RiseOutlined,
  ShoppingCartOutlined, RocketOutlined, NotificationOutlined, AuditOutlined,
  FundOutlined, TeamOutlined, FileProtectOutlined, BarChartOutlined,
  CloudServerOutlined
} from '@ant-design/icons';
import { useWorkItems, useTransports } from '../../hooks/useData';
import { useModule, ModuleKey } from '../../contexts/ModuleContext';
import { calculateRAG, daysFromNow, WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';

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
    { key: 'Break-fix', label: 'Break-Fixes', icon: <BugOutlined /> },
    { key: 'Upgrade', label: 'Upgrades', icon: <SwapOutlined /> },
    { key: 'Support', label: 'Support', icon: <CustomerServiceOutlined /> },
    { key: 'Hypercare', label: 'Hypercare', icon: <SafetyOutlined /> },
    { key: 'tr-search', label: 'TR Search', icon: <SearchOutlined /> },
  ],
  coupa: [
    { key: '', label: 'All', icon: <AppstoreOutlined /> },
    { key: 'Implementation', label: 'Implementations', icon: <RocketOutlined /> },
    { key: 'Integration', label: 'Integrations', icon: <ApiOutlined /> },
    { key: 'Configuration', label: 'Configurations', icon: <ToolOutlined /> },
    { key: 'Data Migration', label: 'Data Migration', icon: <DatabaseOutlined /> },
    { key: 'Upgrade', label: 'Upgrades', icon: <SwapOutlined /> },
    { key: 'Support', label: 'Support', icon: <CustomerServiceOutlined /> },
    { key: 'Optimization', label: 'Optimization', icon: <RiseOutlined /> },
    { key: 'Supplier Enablement', label: 'Suppliers', icon: <ShoppingCartOutlined /> },
  ],
  commercial: [
    { key: '', label: 'All', icon: <AppstoreOutlined /> },
    { key: 'Product Launch', label: 'Product Launches', icon: <RocketOutlined /> },
    { key: 'Campaign', label: 'Campaigns', icon: <NotificationOutlined /> },
    { key: 'Compliance Initiative', label: 'Compliance', icon: <AuditOutlined /> },
    { key: 'Market Access', label: 'Market Access', icon: <FundOutlined /> },
    { key: 'Field Force', label: 'Field Force', icon: <TeamOutlined /> },
    { key: 'MLR Review', label: 'MLR Review', icon: <FileProtectOutlined /> },
    { key: 'Veeva Implementation', label: 'Veeva', icon: <CloudServerOutlined /> },
    { key: 'Analytics Project', label: 'Analytics', icon: <BarChartOutlined /> },
  ],
};

const WorkItemList: React.FC = () => {
  const { type } = useParams<{ type?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: allWorkItems = [], isLoading: wiLoading, refetch } = useWorkItems();
  const { data: transports = [], isLoading: trLoading } = useTransports();
  const { activeModule } = useModule();

  // Filter work items by active application module
  const APP_MAP: Record<string, string> = { sap: 'SAP', coupa: 'Coupa', commercial: 'Commercial' };
  const workItems = allWorkItems.filter((wi: any) => {
    const appKey = APP_MAP[activeModule] || 'SAP';
    return wi.application === appKey || (!wi.application && activeModule === 'sap');
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
  const filteredItems = useMemo(() => {
    const typeKey = activeTab === 'tr-search' ? '' : activeTab;
    return workItems.filter((item: any) => {
      const matchesType = !typeKey || item.workItemType === typeKey;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const matchesSearch =
        !searchTerm ||
        item.workItemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.businessOwner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.snowTicket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.leadDeveloper?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.projectCode?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [workItems, activeTab, statusFilter, searchTerm]);

  // ── TR search results ──
  const trResults = useMemo(() => {
    if (!trSearchTerm && !trSystemFilter && !trStatusFilter) return [];
    const term = trSearchTerm.toLowerCase();
    return transports.filter((t: any) => {
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
    {
      title: 'Name',
      dataIndex: 'workItemName',
      key: 'name',
      sorter: (a: any, b: any) => (a.workItemName || '').localeCompare(b.workItemName || ''),
      render: (text: string, record: any) => (
        <Button type="link" onClick={() => navigate(`/workitem/${record.ID}`)}>
          {text}
        </Button>
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
        const colors: Record<string, string> = { RED: '#ff4d4f', AMBER: '#faad14', GREEN: '#52c41a' };
        return (
          <Tooltip title={`RAG: ${rag}`}>
            <div
              style={{
                width: 18, height: 18, borderRadius: '50%',
                backgroundColor: colors[rag] || '#d9d9d9',
                margin: '0 auto',
              }}
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
          Active: 'processing', 'On Hold': 'warning', Done: 'success', Cancelled: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 140,
      render: (_: any, record: any) => <Progress percent={Math.round(record.deploymentPct || 0)} size="small" />,
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
            <span style={{ color: typeof days === 'number' && days <= 7 ? '#ff4d4f' : typeof days === 'number' && days <= 14 ? '#faad14' : undefined }}>
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
            <a href={record.sharepointUrl} target="_blank" rel="noopener noreferrer">
              <FileExcelOutlined style={{ color: '#217346', fontSize: 16 }} />
            </a>
          </Tooltip>
        ) : (
          <Tooltip title="No tracker linked">
            <FileExcelOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
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
      render: (type: string) =>
        type ? <Tag color={WORK_TYPE_COLORS[type] || 'default'}>{WORK_TYPE_MAP[type] || type}</Tag> : <Tag>Unassigned</Tag>,
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
      <Title level={3} style={{ marginBottom: 8 }}>
        <ProjectOutlined /> Tracker
      </Title>

      <Tabs
        activeKey={activeTab || ''}
        onChange={handleTabChange}
        type="card"
        style={{ marginBottom: 0 }}
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
          <Card size="small" style={{ marginBottom: 16, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
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
          <Card size="small" style={{ marginBottom: 16, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
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
    </div>
  );
};

export default WorkItemList;
