import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Descriptions, Timeline, Table, Button, Space,
  Typography, Progress, Tooltip, Divider, Spin, Empty, Modal, Input, InputNumber, Select, message,
  DatePicker, Popconfirm
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, EditOutlined, SyncOutlined, LinkOutlined,
  FileExcelOutlined, ExperimentOutlined, BarChartOutlined,
  PlusOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useWorkItem, useTransports, useMethodologies } from '../../hooks/useData';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRAG, daysFromNow, WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';
import { workItemApi, testStatusApi, milestoneApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const WorkItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: workItem, isLoading: wiLoading, refetch: refetchWI } = useWorkItem(id!);
  const { data: allTransports = [] } = useTransports();
  const { data: methodologies = [] } = useMethodologies();
  const { canWrite } = useAuth();
  const [veevaModalOpen, setVeevaModalOpen] = useState(false);
  const [veevaCC, setVeevaCC] = useState('');
  const [spModalOpen, setSpModalOpen] = useState(false);
  const [spUrl, setSpUrl] = useState('');
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testData, setTestData] = useState({ testTotal: 0, testPassed: 0, testFailed: 0, testBlocked: 0, testTBD: 0, testSkipped: 0 });
  // Editable field state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Milestone add state
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ milestoneName: '', milestoneDate: '' });

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

  const rag = workItem.overallRAG || calculateRAG(workItem);
  const ragColors: Record<string, string> = { RED: '#ff4d4f', AMBER: '#faad14', GREEN: '#52c41a' };

  // Filter transports linked to this work item
  const linkedTransports = allTransports.filter(
    (t: any) => t.workItem_ID === workItem.ID
  );

  const totalTR = linkedTransports.length || workItem.estimatedTRCount || 0;
  const prodTR = linkedTransports.filter((t: any) => t.currentSystem === 'PRD').length;
  const progressPct = workItem.deploymentPct || (totalTR > 0 ? Math.round((prodTR / totalTR) * 100) : 0);

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

  const handleUpdateTestStatus = async () => {
    try {
      const result = await testStatusApi.update(workItem.ID, testData);
      message.success(result.message || 'Test status updated');
      setTestModalOpen(false);
    } catch {
      message.error('Failed to update test status');
    }
  };

  const handleMethodologyChange = async (value: string) => {
    try {
      await workItemApi.update(workItem.ID, { methodology: value || null });
      message.success(`Methodology updated to ${value || 'None'}`);
      refetchWI();
    } catch {
      message.error('Failed to update methodology');
    }
  };

  // ── Inline field edit handler (for owner fields etc.) ──
  const handleFieldSave = async (fieldName: string) => {
    try {
      await workItemApi.update(workItem.ID, { [fieldName]: editValue || null });
      message.success(`${fieldName} updated`);
      setEditingField(null);
      refetchWI();
    } catch {
      message.error(`Failed to update ${fieldName}`);
    }
  };

  // Renders editable or read-only field based on canWrite
  const editableField = (fieldName: string, value: string | undefined) => {
    if (!canWrite) return <Text>{value || '—'}</Text>;
    if (editingField === fieldName) {
      return (
        <Space size={4}>
          <Input size="small" value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ width: 160 }}
            onPressEnter={() => handleFieldSave(fieldName)} autoFocus />
          <Button type="link" size="small" onClick={() => handleFieldSave(fieldName)}>Save</Button>
          <Button type="link" size="small" onClick={() => setEditingField(null)}>Cancel</Button>
        </Space>
      );
    }
    return (
      <Space size={4}>
        <Text>{value || '—'}</Text>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingField(fieldName); setEditValue(value || ''); }} />
      </Space>
    );
  };

  // ── Milestone CRUD ──
  const handleAddMilestone = async () => {
    if (!newMilestone.milestoneName.trim()) { message.warning('Milestone name is required'); return; }
    try {
      await milestoneApi.create({
        workItem_ID: workItem.ID,
        milestoneName: newMilestone.milestoneName,
        milestoneDate: newMilestone.milestoneDate || null,
        milestoneOrder: (workItem.milestones?.length || 0) + 1,
        autoGenerated: false,
        status: 'Pending',
      });
      message.success('Milestone added');
      setAddMilestoneOpen(false);
      setNewMilestone({ milestoneName: '', milestoneDate: '' });
      refetchWI();
    } catch {
      message.error('Failed to add milestone');
    }
  };

  const handleDeleteMilestone = async (msId: string) => {
    try {
      await milestoneApi.remove(msId);
      message.success('Milestone removed');
      refetchWI();
    } catch {
      message.error('Failed to delete milestone');
    }
  };

  const handleToggleMilestoneComplete = async (ms: any) => {
    try {
      const newStatus = ms.status === 'Complete' ? 'Pending' : 'Complete';
      await milestoneApi.update(ms.ID, {
        status: newStatus,
        completedDate: newStatus === 'Complete' ? new Date().toISOString().split('T')[0] : null,
      });
      message.success(`Milestone ${newStatus === 'Complete' ? 'completed' : 'reopened'}`);
      refetchWI();
    } catch {
      message.error('Failed to update milestone');
    }
  };

  // Build methodology options from backend + empty
  const methodologyOptions = [
    { value: '', label: '— None —' },
    ...(Array.isArray(methodologies) ? methodologies : (methodologies as any)?.value || []).map((m: any) => ({
      value: m.methodologyKey || m.name,
      label: m.name,
    })),
  ];

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
            <Title level={3} style={{ margin: 0 }}>{workItem.workItemName}</Title>
            <Tag color={WORK_TYPE_COLORS[workItem.workItemType] || 'default'}>
              {WORK_TYPE_MAP[workItem.workItemType] || workItem.workItemType}
            </Tag>
            <Tag color={workItem.status === 'Active' ? 'processing' : 'default'}>
              {workItem.status}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Progress
            type="circle"
            percent={Math.round(progressPct)}
            size={60}
            format={() => `${Math.round(progressPct)}%`}
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
                <Tag>{workItem.sapModule}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Business Owner">{editableField('businessOwner', workItem.businessOwner)}</Descriptions.Item>
              <Descriptions.Item label="System Owner">{editableField('systemOwner', workItem.systemOwner)}</Descriptions.Item>
              <Descriptions.Item label="Lead Developer">{editableField('leadDeveloper', workItem.leadDeveloper)}</Descriptions.Item>
              <Descriptions.Item label="Functional Lead">{editableField('functionalLead', workItem.functionalLead)}</Descriptions.Item>
              <Descriptions.Item label="QA Lead">{editableField('qaLead', workItem.qaLead)}</Descriptions.Item>
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
                {workItem.kickoffDate ? new Date(workItem.kickoffDate).toLocaleDateString() : '—'}
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
              <Descriptions.Item label="Deployment %">{workItem.deploymentPct || 0}%</Descriptions.Item>
              <Descriptions.Item label="Phase">{workItem.currentPhase || '—'}</Descriptions.Item>
              <Descriptions.Item label="Methodology">
                {canWrite ? (
                  <Select
                    value={workItem.methodology || ''}
                    onChange={handleMethodologyChange}
                    options={methodologyOptions}
                    style={{ width: 180 }}
                    size="small"
                    placeholder="Select methodology"
                  />
                ) : (
                  workItem.methodology ? <Tag color="purple">{workItem.methodology}</Tag> : '—'
                )}
              </Descriptions.Item>
            </Descriptions>
            {workItem.notes && (
              <>
                <Divider />
                <Paragraph>{workItem.notes}</Paragraph>
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

        {/* Right: Test Progress + Milestones */}
        <Col xs={24} lg={8}>
          {/* UAT / Test Progress Card */}
          <Card
            title={<Space><ExperimentOutlined />UAT / Test Progress</Space>}
            size="small"
            style={{ marginBottom: 16 }}
            extra={
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setTestData({
                    testTotal: workItem.testTotal || 0,
                    testPassed: workItem.testPassed || 0,
                    testFailed: workItem.testFailed || 0,
                    testBlocked: workItem.testBlocked || 0,
                    testTBD: workItem.testTBD || 0,
                    testSkipped: workItem.testSkipped || 0,
                  });
                  setTestModalOpen(true);
                }}
              >
                Update
              </Button>
            }
          >
            {(workItem.testTotal || 0) > 0 ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <Progress
                    type="dashboard"
                    percent={workItem.testCompletionPct || 0}
                    size={120}
                    strokeColor={{
                      '0%': '#52c41a',
                      '50%': '#faad14',
                      '100%': '#52c41a',
                    }}
                    format={(pct) => (
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 'bold' }}>{pct}%</div>
                        <div style={{ fontSize: 11, color: '#888' }}>Executed</div>
                      </div>
                    )}
                  />
                </div>
                <Tag color={
                  workItem.uatStatus === 'Passed' ? 'success' :
                  workItem.uatStatus === 'Failed' ? 'error' :
                  workItem.uatStatus === 'Blocked' ? 'warning' :
                  workItem.uatStatus === 'In Progress' ? 'processing' : 'default'
                } style={{ marginBottom: 8 }}>
                  UAT: {workItem.uatStatus || 'Not Started'}
                </Tag>
                {workItem.methodology && (
                  <Tag color="purple" style={{ marginBottom: 8 }}>{workItem.methodology}</Tag>
                )}
                <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
                  <Descriptions.Item label="Total">{workItem.testTotal}</Descriptions.Item>
                  <Descriptions.Item label={<Text type="success">Passed</Text>}>{workItem.testPassed || 0}</Descriptions.Item>
                  <Descriptions.Item label={<Text type="danger">Failed</Text>}>{workItem.testFailed || 0}</Descriptions.Item>
                  <Descriptions.Item label={<Text type="warning">Blocked</Text>}>{workItem.testBlocked || 0}</Descriptions.Item>
                  <Descriptions.Item label="TBD">{workItem.testTBD || 0}</Descriptions.Item>
                  <Descriptions.Item label="Skipped">{workItem.testSkipped || 0}</Descriptions.Item>
                </Descriptions>
                {/* Stacked bar visual */}
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 8 }}>
                  {workItem.testPassed > 0 && (
                    <Tooltip title={`Passed: ${workItem.testPassed}`}>
                      <div style={{ width: `${(workItem.testPassed / workItem.testTotal) * 100}%`, background: '#52c41a' }} />
                    </Tooltip>
                  )}
                  {workItem.testFailed > 0 && (
                    <Tooltip title={`Failed: ${workItem.testFailed}`}>
                      <div style={{ width: `${(workItem.testFailed / workItem.testTotal) * 100}%`, background: '#ff4d4f' }} />
                    </Tooltip>
                  )}
                  {workItem.testBlocked > 0 && (
                    <Tooltip title={`Blocked: ${workItem.testBlocked}`}>
                      <div style={{ width: `${(workItem.testBlocked / workItem.testTotal) * 100}%`, background: '#faad14' }} />
                    </Tooltip>
                  )}
                  {workItem.testTBD > 0 && (
                    <Tooltip title={`TBD: ${workItem.testTBD}`}>
                      <div style={{ width: `${(workItem.testTBD / workItem.testTotal) * 100}%`, background: '#d9d9d9' }} />
                    </Tooltip>
                  )}
                  {workItem.testSkipped > 0 && (
                    <Tooltip title={`Skipped: ${workItem.testSkipped}`}>
                      <div style={{ width: `${(workItem.testSkipped / workItem.testTotal) * 100}%`, background: '#bfbfbf' }} />
                    </Tooltip>
                  )}
                </div>
              </>
            ) : (
              <Empty
                description="No test data yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="dashed"
                  size="small"
                  icon={<BarChartOutlined />}
                  onClick={() => {
                    setTestData({ testTotal: 0, testPassed: 0, testFailed: 0, testBlocked: 0, testTBD: 0, testSkipped: 0 });
                    setTestModalOpen(true);
                  }}
                >
                  Enter Test Data
                </Button>
              </Empty>
            )}
          </Card>

          <Card title="Milestones" size="small"
            extra={canWrite && (
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setAddMilestoneOpen(true)}>Add</Button>
            )}>
            {milestones.length === 0 ? (
              <Empty description="No milestones" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                {canWrite && <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setAddMilestoneOpen(true)}>Add Milestone</Button>}
              </Empty>
            ) : (
              <Timeline
                items={milestones.map((m: any) => ({
                  color: m.status === 'Complete' ? 'green' : m.milestoneDate && daysFromNow(new Date(m.milestoneDate)) <= 0 ? 'red' : 'blue',
                  dot: m.status === 'Complete' ? <CheckCircleOutlined /> : m.milestoneDate && daysFromNow(new Date(m.milestoneDate)) <= 0 ? <ExclamationCircleOutlined /> : <ClockCircleOutlined />,
                  children: (
                    <div>
                      <Space size={4}>
                        <Text strong style={{ textDecoration: m.status === 'Complete' ? 'line-through' : undefined }}>{m.milestoneName}</Text>
                        {canWrite && (
                          <>
                            <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }}
                              onClick={() => handleToggleMilestoneComplete(m)}>
                              {m.status === 'Complete' ? 'Reopen' : 'Done'}
                            </Button>
                            {!m.autoGenerated && (
                              <Popconfirm title="Delete this milestone?" onConfirm={() => handleDeleteMilestone(m.ID)} okText="Delete" okButtonProps={{ danger: true }}>
                                <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 11, padding: 0 }} />
                              </Popconfirm>
                            )}
                          </>
                        )}
                      </Space>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {m.milestoneDate ? new Date(m.milestoneDate).toLocaleDateString() : 'No date'}
                        {m.status === 'Complete' && m.completedDate && ` — Done ${new Date(m.completedDate).toLocaleDateString()}`}
                        {m.autoGenerated && <Tag style={{ marginLeft: 4, fontSize: 10 }}>Auto</Tag>}
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

      {/* Test Status Modal */}
      <Modal
        title="Update UAT / Test Status"
        open={testModalOpen}
        onOk={handleUpdateTestStatus}
        onCancel={() => setTestModalOpen(false)}
        okText="Save Test Data"
        width={500}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            Enter the test case counts from your SharePoint Excel tracker.
            The app will auto-calculate completion %, UAT status, and RAG impact.
          </Text>
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <Text strong>Total Test Cases</Text>
            <InputNumber min={0} value={testData.testTotal} onChange={(v) => setTestData({ ...testData, testTotal: v || 0 })} style={{ width: '100%' }} />
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Text type="success">Passed</Text>
              <InputNumber min={0} value={testData.testPassed} onChange={(v) => setTestData({ ...testData, testPassed: v || 0 })} style={{ width: '100%' }} />
            </Col>
            <Col span={12}>
              <Text type="danger">Failed</Text>
              <InputNumber min={0} value={testData.testFailed} onChange={(v) => setTestData({ ...testData, testFailed: v || 0 })} style={{ width: '100%' }} />
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Text type="warning">Blocked</Text>
              <InputNumber min={0} value={testData.testBlocked} onChange={(v) => setTestData({ ...testData, testBlocked: v || 0 })} style={{ width: '100%' }} />
            </Col>
            <Col span={8}>
              <Text>TBD</Text>
              <InputNumber min={0} value={testData.testTBD} onChange={(v) => setTestData({ ...testData, testTBD: v || 0 })} style={{ width: '100%' }} />
            </Col>
            <Col span={8}>
              <Text type="secondary">Skipped</Text>
              <InputNumber min={0} value={testData.testSkipped} onChange={(v) => setTestData({ ...testData, testSkipped: v || 0 })} style={{ width: '100%' }} />
            </Col>
          </Row>
        </Space>
        <Divider />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Example: If your SharePoint tracker has 80 rows — 40 Pass, 10 Failed, 25 TBD, 5 Blocked —
          the app will show 62.5% executed, UAT: Failed (due to failures), and may escalate RAG to RED/AMBER.
        </Text>
      </Modal>

      {/* Add Milestone Modal */}
      <Modal
        title="Add Milestone"
        open={addMilestoneOpen}
        onOk={handleAddMilestone}
        onCancel={() => setAddMilestoneOpen(false)}
        okText="Add"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>Milestone Name *</Text>
            <Input placeholder="e.g., Code Review Complete" value={newMilestone.milestoneName}
              onChange={(e) => setNewMilestone({ ...newMilestone, milestoneName: e.target.value })} />
          </div>
          <div>
            <Text strong>Deadline Date</Text>
            <br />
            <DatePicker style={{ width: '100%' }}
              value={newMilestone.milestoneDate ? dayjs(newMilestone.milestoneDate) : null}
              onChange={(d) => setNewMilestone({ ...newMilestone, milestoneDate: d ? d.format('YYYY-MM-DD') : '' })} />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default WorkItemDetail;
