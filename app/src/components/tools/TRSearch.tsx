import React, { useState, useMemo } from 'react';
import {
  Card, Input, Table, Tag, Typography, Space, Empty, Select, Row, Col
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTransports } from '../../hooks/useData';
import { WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const TRSearch: React.FC = () => {
  const navigate = useNavigate();
  const { data: transports = [], isLoading } = useTransports();

  const [searchTerm, setSearchTerm] = useState('');
  const [systemFilter, setSystemFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const results = useMemo(() => {
    if (!searchTerm && !systemFilter && !statusFilter) return [];
    const term = searchTerm.toLowerCase();

    return transports.filter((t: any) => {
      const matchesSearch =
        !term ||
        t.trNumber?.toLowerCase().includes(term) ||
        t.trDescription?.toLowerCase().includes(term) ||
        t.trOwner?.toLowerCase().includes(term) ||
        t.ownerFullName?.toLowerCase().includes(term);
      const matchesSystem = !systemFilter || t.currentSystem === systemFilter;
      const matchesStatus = !statusFilter || t.trStatus === statusFilter;
      return matchesSearch && matchesSystem && matchesStatus;
    });
  }, [transports, searchTerm, systemFilter, statusFilter]);

  const columns = [
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
      width: 350,
    },
    {
      title: 'Type',
      dataIndex: 'workType',
      key: 'workType',
      render: (type: string) =>
        type ? (
          <Tag color={WORK_TYPE_COLORS[type] || 'default'}>{WORK_TYPE_MAP[type] || type}</Tag>
        ) : (
          <Tag>Unassigned</Tag>
        ),
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
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div>
      <Title level={3}>
        <SearchOutlined style={{ marginRight: 8 }} />
        Transport Search
      </Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Input
              placeholder="Search by TR number, description, or owner..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              size="large"
              autoFocus
            />
          </Col>
          <Col xs={12} md={6}>
            <Select
              placeholder="System"
              value={systemFilter || undefined}
              onChange={(v) => setSystemFilter(v || '')}
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
              value={statusFilter || undefined}
              onChange={(v) => setStatusFilter(v || '')}
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
        {!searchTerm && !systemFilter && !statusFilter ? (
          <Empty
            description="Enter a search term or apply filters to find transports"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            dataSource={results}
            columns={columns}
            loading={isLoading}
            rowKey="trNumber"
            pagination={{
              pageSize: 25,
              showTotal: (total) => `${total} results`,
            }}
            scroll={{ x: 1000 }}
          />
        )}
      </Card>
    </div>
  );
};

export default TRSearch;
