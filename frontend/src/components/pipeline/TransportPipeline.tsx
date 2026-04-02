import React from 'react';
import { Card, Row, Col, Tag, Table, Statistic, Typography, Space, Empty, Skeleton } from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useTransports, usePipelineSummary } from '../../hooks/useData';
import { WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const TransportPipeline: React.FC = () => {
  const { data: transports = [], isLoading } = useTransports();
  const { data: pipeline } = usePipelineSummary('SAP');

  const devTRs = transports.filter((t: any) => t.currentSystem === 'DEV');
  const qasTRs = transports.filter((t: any) => t.currentSystem === 'QAS');
  const prdTRs = transports.filter((t: any) => t.currentSystem === 'PRD');

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
      width: 300,
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
          <Tag>Unassigned</Tag>
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
      title: 'Created',
      dataIndex: 'createdDate',
      key: 'createdDate',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '—',
    },
  ];

  const renderSystemCard = (title: string, trs: any[], color: string, icon: React.ReactNode) => (
    <Card
      title={
        <Space>
          {icon}
          <span>{title} ({trs.length})</span>
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
          scroll={{ x: 800 }}
        />
      )}
    </Card>
  );

  return (
    <div>
      <Title level={3}>Transport Pipeline</Title>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="DEV"
              value={pipeline?.devCount ?? devTRs.length}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="QAS"
              value={pipeline?.qasCount ?? qasTRs.length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="PRD"
              value={pipeline?.prdCount ?? prdTRs.length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="Stuck >5d"
              value={pipeline?.stuckCount ?? 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="Failed"
              value={pipeline?.failedCount ?? 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
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
            '#faad14',
            <ClockCircleOutlined style={{ color: '#faad14' }} />
          )}
        </Col>
        <Col xs={24} lg={8}>
          {renderSystemCard(
            'PRD',
            prdTRs,
            '#52c41a',
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          )}
        </Col>
      </Row>
    </div>
  );
};

export default TransportPipeline;
