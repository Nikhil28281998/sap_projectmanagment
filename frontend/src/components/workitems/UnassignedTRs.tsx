import React, { useState, useMemo } from 'react';
import {
  Card, Table, Tag, Button, Space, Typography, Select, message as antMessage,
  Modal, Tooltip, Alert, Divider, Badge, Collapse, Form, Input, Spin, Row, Col
} from 'antd';
import {
  TagOutlined, TagsOutlined, InboxOutlined, RobotOutlined,
  CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined,
  LinkOutlined, PlusOutlined, ReloadOutlined
} from '@ant-design/icons';
import {
  useTransports, useCategorizeTransport, useBulkCategorize,
  useSuggestWorkItemsForTRs, useAutoLinkTickets, useCreateWorkItem, useWorkItems
} from '../../hooks/useData';
import { parseTRDescription, WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';
import type { Transport } from '@/types';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const WORK_TYPES = [
  { value: 'project', label: 'Project' },
  { value: 'enhancement', label: 'Enhancement' },
  { value: 'break-fix', label: 'Break/Fix' },
  { value: 'general', label: 'General' },
  { value: 'basis', label: 'Basis' },
  { value: 'security', label: 'Security' },
];

const CONFIDENCE_COLORS: Record<string, string> = { HIGH: 'green', MEDIUM: 'orange', LOW: 'red' };
const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  link: <LinkOutlined />,
  create: <PlusOutlined />,
  unknown: <QuestionCircleOutlined />,
};

interface AISuggestion {
  trId: string;
  trNumber: string;
  suggestion: 'link' | 'create' | 'unknown';
  workItemId?: string;
  workItemName?: string;
  suggestedName?: string;
  suggestedType?: string;
  suggestedModule?: string;
  suggestedPriority?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  questions?: string[];
}

const UnassignedTRs: React.FC = () => {
  const { data: transports = [], isLoading, refetch } = useTransports();
  const { data: workItems = [] } = useWorkItems();
  const categorize = useCategorizeTransport();
  const bulkCategorize = useBulkCategorize();
  const suggestMutation = useSuggestWorkItemsForTRs();
  const autoLinkMutation = useAutoLinkTickets();
  const createWorkItem = useCreateWorkItem();

  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [bulkType, setBulkType] = useState<string>('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkWorkItemId, setBulkWorkItemId] = useState<string>('');

  // AI suggestion state
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [dismissedTrIds, setDismissedTrIds] = useState<Set<string>>(new Set());
  const [acceptedTrIds, setAcceptedTrIds] = useState<Set<string>>(new Set());
  const [editingCreate, setEditingCreate] = useState<Record<string, Partial<AISuggestion>>>({});
  const [adminAnswers, setAdminAnswers] = useState<Record<string, string[]>>({});
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);

  const unassigned = transports.filter((t: Transport) => !t.workItem_ID);

  const activeSuggestions = useMemo(() =>
    suggestions.filter(s => !dismissedTrIds.has(s.trId) && !acceptedTrIds.has(s.trId)),
    [suggestions, dismissedTrIds, acceptedTrIds]
  );

  const handleCategorize = async (trNumber: string, workType: string) => {
    try {
      await categorize.mutateAsync({ trNumber, workType });
      antMessage.success(`${trNumber} categorized as ${WORK_TYPE_MAP[workType]}`);
    } catch {
      antMessage.error('Failed to categorize transport');
    }
  };

  const handleBulkCategorize = async () => {
    if (!bulkType) { antMessage.warning('Select a work type'); return; }
    try {
      await bulkCategorize.mutateAsync(
        selectedRows.map((r: any) => ({ trNumber: r.trNumber, workType: bulkType, workItemId: bulkWorkItemId || undefined }))
      );
      antMessage.success(`${selectedRows.length} transports categorized`);
      setSelectedRows([]);
      setBulkModalOpen(false);
    } catch {
      antMessage.error('Bulk categorization failed');
    }
  };

  const handleAutoLink = async () => {
    try {
      const res = await autoLinkMutation.mutateAsync(undefined);
      antMessage.success(res.message || 'Auto-link complete');
      refetch();
    } catch {
      antMessage.error('Auto-link failed');
    }
  };

  const handleAskAI = async (specificTrIds?: string[]) => {
    const ids = specificTrIds
      ?? (selectedRows.length > 0 ? selectedRows.map((r: any) => r.ID) : unassigned.map((t: any) => t.ID));

    if (ids.length === 0) { antMessage.warning('No TRs to analyse'); return; }

    try {
      const res = await suggestMutation.mutateAsync(ids);
      if (!res.success) { antMessage.error(res.message); return; }
      const parsed: AISuggestion[] = JSON.parse(res.suggestions || '[]');
      setSuggestions(parsed);
      setDismissedTrIds(new Set());
      setAcceptedTrIds(new Set());
      setEditingCreate({});
      setAdminAnswers({});
      setShowSuggestionsPanel(true);
      antMessage.success(res.message);
    } catch (err: any) {
      antMessage.error(`AI analysis failed: ${err.message}`);
    }
  };

  const handleAcceptLink = async (s: AISuggestion) => {
    if (!s.workItemId) return;
    try {
      await categorize.mutateAsync({ trNumber: s.trNumber, workType: 'project', workItemId: s.workItemId });
      setAcceptedTrIds(prev => new Set([...prev, s.trId]));
      antMessage.success(`${s.trNumber} linked to "${s.workItemName}"`);
    } catch {
      antMessage.error('Failed to link transport');
    }
  };

  const handleAcceptCreate = async (s: AISuggestion) => {
    const override = editingCreate[s.trId] || {};
    const name = override.suggestedName ?? s.suggestedName ?? `Work Item from ${s.trNumber}`;
    const type = override.suggestedType ?? s.suggestedType ?? 'enhancement';
    const priority = override.suggestedPriority ?? s.suggestedPriority ?? 'P2';
    try {
      const created = await createWorkItem.mutateAsync({
        workItemName: name,
        workItemType: type,
        application: 'SAP',
        priority,
        complexity: 'Medium',
        currentPhase: 'Planning',
        notes: `Created from unassigned TR ${s.trNumber}. AI reason: ${s.reason}`,
      });
      // Link the TR to the new work item
      if (created?.workItemId) {
        await categorize.mutateAsync({ trNumber: s.trNumber, workType: type, workItemId: created.workItemId });
      }
      setAcceptedTrIds(prev => new Set([...prev, s.trId]));
      antMessage.success(`Work item "${name}" created and ${s.trNumber} linked`);
    } catch {
      antMessage.error('Failed to create work item');
    }
  };

  const handleDismiss = (trId: string) => {
    setDismissedTrIds(prev => new Set([...prev, trId]));
  };

  const workItemOptions = useMemo(() =>
    (workItems as any[])
      .filter(wi => wi.status !== 'Done')
      .map(wi => ({ value: wi.ID, label: `${wi.projectCode} — ${wi.workItemName}` })),
    [workItems]
  );

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
      width: 340,
    },
    {
      title: 'Suggested Type',
      key: 'suggestion',
      width: 160,
      render: (_: any, record: any) => {
        const parsed = parseTRDescription(record.trDescription || '');
        const s = suggestions.find(x => x.trId === record.ID);
        if (s && !dismissedTrIds.has(s.trId) && !acceptedTrIds.has(s.trId)) {
          return (
            <Tooltip title={s.reason}>
              <Tag color={CONFIDENCE_COLORS[s.confidence]} icon={SUGGESTION_ICONS[s.suggestion]}>
                AI: {s.suggestion === 'link' ? 'Link' : s.suggestion === 'create' ? 'Create' : '?'}
              </Tag>
            </Tooltip>
          );
        }
        if (parsed.suggestedType) {
          return (
            <Tooltip title={`Keyword-based suggestion`}>
              <Tag color={WORK_TYPE_COLORS[parsed.suggestedType] || 'default'}>
                {WORK_TYPE_MAP[parsed.suggestedType] || parsed.suggestedType}
              </Tag>
            </Tooltip>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Owner',
      dataIndex: 'ownerFullName',
      key: 'owner',
      render: (text: string, record: any) => text || record.trOwner,
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
      title: 'Categorize',
      key: 'action',
      width: 210,
      render: (_: any, record: any) => {
        const parsed = parseTRDescription(record.trDescription || '');
        return (
          <Space>
            {parsed.suggestedType && (
              <Tooltip title={`Accept: ${WORK_TYPE_MAP[parsed.suggestedType]}`}>
                <Button size="small" type="primary" ghost icon={<TagOutlined />}
                  onClick={() => handleCategorize(record.trNumber, parsed.suggestedType!)}
                  loading={categorize.isPending}>
                  Accept
                </Button>
              </Tooltip>
            )}
            <Select
              placeholder="Assign type..."
              size="small"
              style={{ width: 120 }}
              options={WORK_TYPES}
              onChange={(type) => handleCategorize(record.trNumber, type)}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={3}>
        <InboxOutlined style={{ marginRight: 8 }} />
        Unassigned Transports
        <Badge count={unassigned.length} style={{ marginLeft: 12, backgroundColor: unassigned.length > 0 ? '#faad14' : '#52c41a' }} />
      </Title>

      {/* Action toolbar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={handleAutoLink} loading={autoLinkMutation.isPending}>
            Auto-Link by Ticket
          </Button>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={() => handleAskAI()}
            loading={suggestMutation.isPending}
          >
            {selectedRows.length > 0 ? `Ask AI (${selectedRows.length} selected)` : 'Ask AI (all)'}
          </Button>
          {selectedRows.length > 0 && (
            <>
              <Divider type="vertical" />
              <Button icon={<TagsOutlined />} onClick={() => setBulkModalOpen(true)}>
                Bulk Categorize ({selectedRows.length})
              </Button>
              <Button onClick={() => setSelectedRows([])}>Clear</Button>
            </>
          )}
        </Space>
      </Card>

      {/* AI Suggestions Panel */}
      {showSuggestionsPanel && suggestions.length > 0 && (
        <Card
          title={
            <Space>
              <RobotOutlined style={{ color: '#1677ff' }} />
              <span>AI Suggestions</span>
              <Tag color="blue">{activeSuggestions.length} pending</Tag>
              <Tag color="green">{acceptedTrIds.size} accepted</Tag>
              <Tag color="default">{dismissedTrIds.size} dismissed</Tag>
            </Space>
          }
          extra={<Button size="small" onClick={() => setShowSuggestionsPanel(false)}>Hide</Button>}
          style={{ marginBottom: 16, borderColor: '#1677ff' }}
        >
          {activeSuggestions.length === 0 ? (
            <Alert message="All suggestions have been handled." type="success" showIcon />
          ) : (
            <Collapse ghost>
              {activeSuggestions.map((s) => {
                const editing = editingCreate[s.trId] || {};
                return (
                  <Panel
                    key={s.trId}
                    header={
                      <Row gutter={8} align="middle">
                        <Col><Tag color={CONFIDENCE_COLORS[s.confidence]}>{s.confidence}</Tag></Col>
                        <Col><Text strong>{s.trNumber}</Text></Col>
                        <Col>
                          {s.suggestion === 'link' && <Tag color="blue" icon={<LinkOutlined />}>Link to existing</Tag>}
                          {s.suggestion === 'create' && <Tag color="purple" icon={<PlusOutlined />}>Create new WI</Tag>}
                          {s.suggestion === 'unknown' && <Tag color="orange" icon={<QuestionCircleOutlined />}>Needs clarification</Tag>}
                        </Col>
                        <Col flex="auto"><Text type="secondary" style={{ fontSize: 12 }}>{s.reason}</Text></Col>
                      </Row>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {/* LINK suggestion */}
                      {s.suggestion === 'link' && s.workItemId && (
                        <Alert
                          message={<>Link <Text strong>{s.trNumber}</Text> → <Text strong>{s.workItemName}</Text></>}
                          type="info"
                          showIcon
                          action={
                            <Space>
                              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                                onClick={() => handleAcceptLink(s)} loading={categorize.isPending}>
                                Accept
                              </Button>
                              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleDismiss(s.trId)}>
                                Dismiss
                              </Button>
                            </Space>
                          }
                        />
                      )}

                      {/* CREATE suggestion */}
                      {s.suggestion === 'create' && (
                        <div>
                          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                            Suggested new work item — edit fields if needed, then accept:
                          </Paragraph>
                          <Row gutter={[8, 8]}>
                            <Col span={12}>
                              <Input
                                addonBefore="Name"
                                value={editing.suggestedName ?? s.suggestedName ?? ''}
                                onChange={e => setEditingCreate(prev => ({ ...prev, [s.trId]: { ...prev[s.trId], suggestedName: e.target.value } }))}
                              />
                            </Col>
                            <Col span={6}>
                              <Select
                                style={{ width: '100%' }}
                                value={editing.suggestedType ?? s.suggestedType ?? 'enhancement'}
                                onChange={v => setEditingCreate(prev => ({ ...prev, [s.trId]: { ...prev[s.trId], suggestedType: v } }))}
                                options={WORK_TYPES}
                              />
                            </Col>
                            <Col span={6}>
                              <Select
                                style={{ width: '100%' }}
                                value={editing.suggestedPriority ?? s.suggestedPriority ?? 'P2'}
                                onChange={v => setEditingCreate(prev => ({ ...prev, [s.trId]: { ...prev[s.trId], suggestedPriority: v } }))}
                                options={[{ value: 'P1', label: 'P1 – Critical' }, { value: 'P2', label: 'P2 – High' }, { value: 'P3', label: 'P3 – Medium' }]}
                              />
                            </Col>
                          </Row>
                          <Space style={{ marginTop: 8 }}>
                            <Button type="primary" icon={<CheckCircleOutlined />}
                              onClick={() => handleAcceptCreate(s)}
                              loading={createWorkItem.isPending || categorize.isPending}>
                              Create &amp; Link
                            </Button>
                            <Button danger icon={<CloseCircleOutlined />} onClick={() => handleDismiss(s.trId)}>
                              Dismiss
                            </Button>
                          </Space>
                        </div>
                      )}

                      {/* UNKNOWN suggestion — show questions + manual link option */}
                      {s.suggestion === 'unknown' && (
                        <div>
                          {s.questions && s.questions.length > 0 && (
                            <div className="unassigned-ai-questions">
                              <Text type="secondary" strong>AI needs answers:</Text>
                              {s.questions.map((q, i) => (
                                <div key={i} className="unassigned-ai-question-row">
                                  <Text>{q}</Text>
                                  <Input
                                    size="small"
                                    style={{ marginTop: 4 }}
                                    placeholder="Your answer..."
                                    value={(adminAnswers[s.trId] || [])[i] || ''}
                                    onChange={e => {
                                      setAdminAnswers(prev => {
                                        const arr = [...(prev[s.trId] || [])];
                                        arr[i] = e.target.value;
                                        return { ...prev, [s.trId]: arr };
                                      });
                                    }}
                                  />
                                </div>
                              ))}
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                style={{ marginTop: 8 }}
                                icon={<RobotOutlined />}
                                loading={suggestMutation.isPending}
                                onClick={() => handleAskAI([unassigned.find((t: any) => t.trNumber === s.trNumber)?.ID].filter(Boolean) as string[])}
                              >
                                Re-analyse with answers
                              </Button>
                            </div>
                          )}
                          <Space wrap>
                            <Text type="secondary">Or manually assign to:</Text>
                            <Select
                              showSearch
                              placeholder="Select work item..."
                              style={{ width: 300 }}
                              options={workItemOptions}
                              filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                              onChange={async (wiId) => {
                                await categorize.mutateAsync({ trNumber: s.trNumber, workType: 'project', workItemId: wiId });
                                setAcceptedTrIds(prev => new Set([...prev, s.trId]));
                                antMessage.success(`${s.trNumber} manually assigned`);
                              }}
                            />
                            <Button danger icon={<CloseCircleOutlined />} onClick={() => handleDismiss(s.trId)}>Dismiss</Button>
                          </Space>
                        </div>
                      )}
                    </Space>
                  </Panel>
                );
              })}
            </Collapse>
          )}
        </Card>
      )}

      {unassigned.length === 0 && !isLoading && (
        <Alert
          message="All Caught Up!"
          description="All transports have been categorized and assigned to work items."
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          dataSource={unassigned}
          columns={columns}
          loading={isLoading || suggestMutation.isPending}
          rowKey="trNumber"
          rowSelection={{
            selectedRowKeys: selectedRows.map((r: any) => r.trNumber),
            onChange: (_, rows) => setSelectedRows(rows),
          }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `${total} unassigned transports`,
          }}
        />
      </Card>

      {/* Bulk Categorize Modal */}
      <Modal
        title="Bulk Categorize Transports"
        open={bulkModalOpen}
        onOk={handleBulkCategorize}
        onCancel={() => setBulkModalOpen(false)}
        confirmLoading={bulkCategorize.isPending}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Categorize {selectedRows.length} transports:</Text>
          <div className="unassigned-bulk-tag-list">
            {selectedRows.map((r: any) => <Tag key={r.trNumber}>{r.trNumber}</Tag>)}
          </div>
          <Select
            placeholder="Select work type"
            options={WORK_TYPES}
            value={bulkType || undefined}
            onChange={setBulkType}
            style={{ width: '100%', marginTop: 12 }}
          />
          <Select
            showSearch
            placeholder="Assign to work item (optional)"
            options={workItemOptions}
            value={bulkWorkItemId || undefined}
            onChange={setBulkWorkItemId}
            style={{ width: '100%' }}
            filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
            allowClear
          />
        </Space>
      </Modal>
    </div>
  );
};

export default UnassignedTRs;
