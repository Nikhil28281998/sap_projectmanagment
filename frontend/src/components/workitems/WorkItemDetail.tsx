import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Descriptions, Timeline, Table, Button, Space,
  Typography, Progress, Tooltip, Divider, Spin, Empty, Modal, Input, message
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, EditOutlined, SyncOutlined, LinkOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { useWorkItem, useTransports } from '../../hooks/useData';
import { calculateRAG, daysFromNow, WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';
import { workItemApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const WorkItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: workItem, isLoading: wiLoading } = useWorkItem(id!);
  const { data: allTransports = [] } = useTransports();
  const [veevaModalOpen, setVeevaModalOpen] = useState(false);
  const [veevaCC, setVeevaCC] = useState('');
  const [spModalOpen, setSpModalOpen] = useState(false);
  const [spUrl, setSpUrl] = useState('');

  if (wiLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!workItem) {
    return (
      <Empty description="Work item not found">
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </Empty>
    );
  }

  const rag = calculateRAG(workItem);
  const ragColors: Record<string, string> = { RED: '#ff4d4f', AMBER: '#faad14', GREEN: '#52c41a' };

  // Filter transports linked to this work item
  const linkedTransports = allTransports.filter(
    (t: any) => t.workItem_ID === workItem.ID
  );

  const totalTR = workItem.totalTransports || 0;
  const prodTR = workItem.transportsProd || 0;
  const progressPct = totalTR > 0 ? Math.round((prodTR / totalTR) * 100) : 0;

  const handleUpdateVeevaCC = async () => {
    if (!veevaCC.match(/^IT-CC-\d{4}$/)) {
      message.error('Veeva CC must match pattern IT-CC-XXXX');
      return;
    }
    try {
      await workItemApi.update(workItem.ID, { veevaCCNumber: veevaCC });
      message.success('Veeva CC updated');
      setVeevaModalOpen(false);
    } catch {
      message.error('Failed to update Veeva CC');
    }
  };

  const handleUpdateSharePointUrl = async () => {
    if (spUrl && !spUrl.match(/^https?:\/\/.+/)) {
      message.error('Please enter a valid URL starting with https://');
      return;
    }
    try {
      await workItemApi.update(workItem.ID, { sharepointUrl: spUrl || null });
      message.success(spUrl ? 'SharePoint link saved' : 'SharePoint link removed');
      setSpModalOpen(false);
    } catch {
      message.error('Failed to update SharePoint link');
    }
  };

  // Build milestone timeline
  const milestones = workItem.milestones || [];

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
  ];

  return (
    <div>
      {/* Header */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Back</Button>
      </Space>

      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Space align="center">
            <div
              style={{
                width: 16, height: 16, borderRadius: '50%',
                backgroundColor: ragColors[rag],
                display: 'inline-block',
              }}
            />
            <Title level={3} style={{ margin: 0 }}>{workItem.name}</Title>
            <Tag color={WORK_TYPE_COLORS[workItem.workType] || 'default'}>
              {WORK_TYPE_MAP[workItem.workType] || workItem.workType}
            </Tag>
            <Tag color={workItem.functionalStatus === 'Active' ? 'processing' : 'default'}>
              {workItem.functionalStatus}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Progress
            type="circle"
            percent={progressPct}
            size={60}
            format={() => `${prodTR}/${totalTR}`}
          />
        </Col>
      </Row>

      {/* SharePoint Tracker Link */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: workItem.sharepointUrl ? '#f6ffed' : '#fffbe6',
          borderColor: workItem.sharepointUrl ? '#b7eb8f' : '#ffe58f',
        }}
      >
        <Space>
          <FileExcelOutlined style={{ fontSize: 18, color: '#217346' }} />
          {workItem.sharepointUrl ? (
            <>
              <Text strong>SharePoint Tracker:</Text>
              <a href={workItem.sharepointUrl} target="_blank" rel="noopener noreferrer">
                <Space size={4}>
                  <LinkOutlined />
                  Open Excel Tracker
                </Space>
              </a>
              <Text type="secondary">(read-only access)</Text>
            </>
          ) : (
            <Text type="secondary">No SharePoint tracker linked to this project</Text>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSpUrl(workItem.sharepointUrl || '');
              setSpModalOpen(true);
            }}
          >
            {workItem.sharepointUrl ? 'Edit' : 'Link Tracker'}
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Left: Details */}
        <Col xs={24} lg={16}>
          <Card title="Work Item Details" size="small" style={{ marginBottom: 16 }}>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Priority">
                <Tag color={workItem.priority === 'P1' ? 'red' : workItem.priority === 'P2' ? 'orange' : 'blue'}>
                  {workItem.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Module">
                <Tag>{workItem.module}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Functional Owner">{workItem.functionalOwner || '—'}</Descriptions.Item>
              <Descriptions.Item label="Technical Lead">{workItem.technicalLead || '—'}</Descriptions.Item>
              <Descriptions.Item label="SNOW Ticket">{workItem.snowTicket || '—'}</Descriptions.Item>
              <Descriptions.Item label="Veeva CC">
                <Space>
                  {workItem.veevaCCNumber || '—'}
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setVeevaCC(workItem.veevaCCNumber || '');
                      setVeevaModalOpen(true);
                    }}
                  />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {workItem.startDate ? new Date(workItem.startDate).toLocaleDateString() : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Go-Live Date">
                {workItem.goLiveDate ? (
                  <Space>
                    {new Date(workItem.goLiveDate).toLocaleDateString()}
                    <Text type={daysFromNow(new Date(workItem.goLiveDate)) <= 7 ? 'danger' : 'secondary'}>
                      ({daysFromNow(new Date(workItem.goLiveDate))}d)
                    </Text>
                  </Space>
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Transports">{totalTR}</Descriptions.Item>
              <Descriptions.Item label="In Production">{prodTR}</Descriptions.Item>
              <Descriptions.Item label="Failed Imports">{workItem.failedImports || 0}</Descriptions.Item>
              <Descriptions.Item label="Stuck TRs">{workItem.stuckTransports || 0}</Descriptions.Item>
            </Descriptions>
            {workItem.scopeSummary && (
              <>
                <Divider />
                <Paragraph>{workItem.scopeSummary}</Paragraph>
              </>
            )}
          </Card>

          {/* Transport Table */}
          <Card
            title={<Space><SyncOutlined />Linked Transports ({linkedTransports.length})</Space>}
            size="small"
          >
            <Table
              dataSource={linkedTransports}
              columns={trColumns}
              rowKey="trNumber"
              size="small"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="No transports linked yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>

        {/* Right: Milestones */}
        <Col xs={24} lg={8}>
          <Card title="Milestones" size="small">
            {milestones.length === 0 ? (
              <Empty description="No milestones" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={milestones.map((m: any) => ({
                  color: m.completed ? 'green' : m.targetDate && daysFromNow(new Date(m.targetDate)) <= 0 ? 'red' : 'blue',
                  dot: m.completed ? <CheckCircleOutlined /> : m.targetDate && daysFromNow(new Date(m.targetDate)) <= 0 ? <ExclamationCircleOutlined /> : <ClockCircleOutlined />,
                  children: (
                    <div>
                      <Text strong>{m.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {m.targetDate ? new Date(m.targetDate).toLocaleDateString() : 'No date'}
                        {m.completed && m.completedDate && ` — Done ${new Date(m.completedDate).toLocaleDateString()}`}
                      </Text>
                      {m.evidence && (
                        <>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>{m.evidence}</Text>
                        </>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Veeva CC Modal */}
      <Modal
        title="Update Veeva Change Control"
        open={veevaModalOpen}
        onOk={handleUpdateVeevaCC}
        onCancel={() => setVeevaModalOpen(false)}
      >
        <Input
          placeholder="IT-CC-XXXX"
          value={veevaCC}
          onChange={(e) => setVeevaCC(e.target.value)}
          maxLength={11}
        />
        <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
          Must match pattern: IT-CC-XXXX (4 digits)
        </Text>
      </Modal>

      {/* SharePoint Tracker URL Modal */}
      <Modal
        title="Link SharePoint Excel Tracker"
        open={spModalOpen}
        onOk={handleUpdateSharePointUrl}
        onCancel={() => setSpModalOpen(false)}
        okText="Save Link"
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            Paste the SharePoint URL to the Excel tracker for this project.
            Users will have read-only display access to view the tracker.
          </Text>
        </div>
        <Input
          placeholder="https://company.sharepoint.com/:x:/s/SAPProjects/tracker.xlsx"
          value={spUrl}
          onChange={(e) => setSpUrl(e.target.value)}
          maxLength={500}
          prefix={<LinkOutlined />}
          allowClear
        />
        <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 12 }}>
          Tip: In SharePoint, open the file &rarr; Share &rarr; Copy link (View only)
        </Text>
      </Modal>
    </div>
  );
};

export default WorkItemDetail;
