import React, { useMemo } from 'react';
import { Card, Row, Col, Tag, Table, Statistic, Typography, Space, Empty, Skeleton, Tooltip } from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, WarningOutlined, LinkOutlined, DisconnectOutlined
} from '@ant-design/icons';
import { useTransports, usePipelineSummary } from '../../hooks/useData';
import { WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';
import type { Transport } from '@/types';

const { Title, Text } = Typography;

const ageDays = (date: string | null | undefined): number => {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
};

const isStuck = (t: Transport): boolean =>
  t.currentSystem !== 'PRD' && t.trStatus !== 'Released' && ageDays(t.createdDate) > 5;

const TransportPipeline: React.FC = () => {
  const { data: transports = [], isLoading } = useTransports();
  const { data: pipeline } = usePipelineSummary('SAP');

  const devTRs = transports.filter((t: Transport) => t.currentSystem === 'DEV');
  const qasTRs = transports.filter((t: Transport) => t.currentSystem === 'QAS');
  const prdTRs = transports.filter((t: Transport) => t.currentSystem === 'PRD');
  const unassignedCount = useMemo(() => transports.filter((t: Transport) => !t.workItem_ID).length, [transports]);

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
      key: 'trDescription',
      ellipsis: true,
      width: 280,
    },
    {
      title: 'Owner',
      dataIndex: 'ownerFullName',
      key: 'owner',
      render: (text: string, record: any) => text || record.trOwner,
    },
    {
      title: 'Type',
      dataIndex: 'workType',
      key: 'workType',
      render: (type: string) =>
        type ? (
          <Tag color={WORK_TYPE_COLORS[type] || 'default'}>
            {WORK_TYPE_MAP[type] || type}
          </Tag>
        ) : (
          <Tag color="default">Unassigned</Tag>
        ),
    },
    {
      title: 'Linked',
      dataIndex: 'workItem_ID',
      key: 'linked',
      width: 70,
      render: (wiId: string | null) =>
        wiId ? (
          <Tooltip title="Linked to work item"><LinkOutlined style={{ color: '#52c41a' }} /></Tooltip>
        ) : (
          <Tooltip title="Not linked — needs categorization"><DisconnectOutlined style={{ color: '#d9d9d9' }} /></Tooltip>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'trStatus',
      key: 'trStatus',
      render: (status: string) => (
        <Tag color={status === 'Released' ? 'green' : 'orange'}>{status}</Tag>
      ),
    },
    {
      title: 'Import RC',
      dataIndex: 'importRC',
      key: 'importRC',
      render: (rc: number | null) => {
        if (rc === null || rc === undefined) return <Text type="secondary">—</Text>;
        if (rc === 0) return <Tag color="success">RC=0 ✓</Tag>;
        if (rc === 4) return <Tag color="warning">RC=4 ⚠</Tag>;
        return <Tag color="error">RC={rc} ❌</Tag>;
      },
    },
    {
      title: 'Age',
      dataIndex: 'createdDate',
      key: 'age',
      sorter: (a: any, b: any) => ageDays(b.createdDate) - ageDays(a.createdDate),
      render: (date: string, record: Transport) => {
        const days = ageDays(date);
        const stuck = isStuck(record);
        return (
          <Tooltip title={date ? new Date(date).toLocaleDateString() : '—'}>
            <Text style={{ color: stuck ? 'var(--color-status-risk-medium)' : undefined }}>
              {stuck && <WarningOutlined style={{ marginRight: 4 }} />}
              {days}d
            </Text>
          </Tooltip>
        );
      },
    },
  ];

  const renderSystemCard = (title: string, trs: any[], color: string, icon: React.ReactNode) => {
    const stuckCount = trs.filter(isStuck).length;
    return (
      <Card
        title={
          <Space>
            {icon}
            <span>{title} ({trs.length})</span>
            {stuckCount > 0 && (
              <Tag color="warning" style={{ marginLeft: 4 }}>{stuckCount} stuck</Tag>
            )}
          </Space>
        }
        size="small"
        style={{ height: '100%' }}
      >
        {isLoading ? (
          <Skeleton active />
        ) : trs.length === 0 ? (
          <Empty description={`No TRs in ${title}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            dataSource={trs}
            columns={columns}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            rowKey="trNumber"
            scroll={{ x: 860 }}
            rowClassName={(record: Transport) => isStuck(record) ? 'tr-row-stuck' : ''}
          />
        )}
      </Card>
    );
  };

  return (
    <div>
      <Title level={3}>Transport Pipeline</Title>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="DEV"
              value={pipeline?.devCount ?? devTRs.length}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="QAS"
              value={pipeline?.qasCount ?? qasTRs.length}
              valueStyle={{ color: 'var(--color-status-risk-medium)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="PRD"
              value={pipeline?.prdCount ?? prdTRs.length}
              valueStyle={{ color: 'var(--color-status-risk-low)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="Stuck >5d"
              value={pipeline?.stuckCount ?? 0}
              valueStyle={{ color: 'var(--color-status-risk-medium)' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="Failed"
              value={pipeline?.failedCount ?? 0}
              valueStyle={{ color: 'var(--color-status-risk-high)' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="Unassigned"
              value={unassignedCount}
              valueStyle={{ color: unassignedCount > 0 ? 'var(--color-status-risk-medium)' : undefined }}
              prefix={<DisconnectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="Total"
              value={transports.length}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Pipeline Columns: DEV → QAS → PRD */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          {renderSystemCard(
            'DEV',
            devTRs,
            '#1677ff',
            <ExclamationCircleOutlined style={{ color: '#1677ff' }} />
          )}
        </Col>
        <Col xs={24} lg={8}>
          {renderSystemCard(
            'QAS',
            qasTRs,
            'var(--color-status-risk-medium)',
            <ClockCircleOutlined style={{ color: 'var(--color-status-risk-medium)' }} />
          )}
        </Col>
        <Col xs={24} lg={8}>
          {renderSystemCard(
            'PRD',
            prdTRs,
            'var(--color-status-risk-low)',
            <CheckCircleOutlined style={{ color: 'var(--color-status-risk-low)' }} />
          )}
        </Col>
      </Row>
    </div>
  );
};

export default TransportPipeline;
