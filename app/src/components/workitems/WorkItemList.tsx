import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Table, Tag, Space, Input, Select, Button, Typography, Tooltip, Progress
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons';
import { useWorkItems } from '../../hooks/useData';
import { calculateRAG, daysFromNow, WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';

const { Title } = Typography;

const WORK_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'project', label: 'Projects' },
  { value: 'enhancement', label: 'Enhancements' },
  { value: 'break-fix', label: 'Break/Fix' },
  { value: 'general', label: 'General' },
  { value: 'basis', label: 'Basis' },
  { value: 'security', label: 'Security' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

const WorkItemList: React.FC = () => {
  const { type } = useParams<{ type?: string }>();
  const navigate = useNavigate();
  const { data: workItems = [], isLoading, refetch } = useWorkItems();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const typeFilter = type || '';

  const filteredItems = useMemo(() => {
    return workItems.filter((item: any) => {
      const matchesType = !typeFilter || item.workType === typeFilter;
      const matchesStatus = !statusFilter || item.functionalStatus === statusFilter;
      const matchesSearch =
        !searchTerm ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.functionalOwner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.snowTicket?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [workItems, typeFilter, statusFilter, searchTerm]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      render: (text: string, record: any) => (
        <Button type="link" onClick={() => navigate(`/workitem/${record.ID}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'workType',
      key: 'workType',
      render: (wt: string) => (
        <Tag color={WORK_TYPE_COLORS[wt] || 'default'}>
          {WORK_TYPE_MAP[wt] || wt}
        </Tag>
      ),
      filters: WORK_TYPE_OPTIONS.filter(o => o.value).map(o => ({
        text: o.label,
        value: o.value,
      })),
      onFilter: (value: any, record: any) => record.workType === value,
    },
    {
      title: 'RAG',
      key: 'rag',
      width: 80,
      render: (_: any, record: any) => {
        const rag = calculateRAG(record);
        const colors: Record<string, string> = { RED: '#ff4d4f', AMBER: '#faad14', GREEN: '#52c41a' };
        return (
          <Tooltip title={`RAG: ${rag}`}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
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
      dataIndex: 'functionalStatus',
      key: 'functionalStatus',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          Active: 'processing',
          'On Hold': 'warning',
          Completed: 'success',
          Cancelled: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 150,
      render: (_: any, record: any) => {
        const total = (record.totalTransports as number) || 0;
        const prod = (record.transportsProd as number) || 0;
        const pct = total > 0 ? Math.round((prod / total) * 100) : 0;
        return <Progress percent={pct} size="small" />;
      },
    },
    {
      title: 'Owner',
      dataIndex: 'functionalOwner',
      key: 'owner',
      sorter: (a: any, b: any) => (a.functionalOwner || '').localeCompare(b.functionalOwner || ''),
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
            <span style={{ color: days <= 7 ? '#ff4d4f' : days <= 14 ? '#faad14' : undefined }}>
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
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: any) => (
        <Tooltip title="View details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/workitem/${record.ID}`)}
          />
        </Tooltip>
      ),
    },
  ];

  const pageTitle = typeFilter
    ? `${WORK_TYPE_MAP[typeFilter] || typeFilter} Work Items`
    : 'All Work Items';

  return (
    <div>
      <Title level={3}>{pageTitle}</Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search name, owner, or SNOW..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          {!typeFilter && (
            <Select
              placeholder="Filter by type"
              options={WORK_TYPE_OPTIONS}
              value={typeFilter}
              onChange={(v) => v ? navigate(`/workitems/${v}`) : navigate('/workitems')}
              style={{ width: 160 }}
            />
          )}
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
          columns={columns}
          loading={isLoading}
          rowKey="ID"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} work items`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default WorkItemList;
