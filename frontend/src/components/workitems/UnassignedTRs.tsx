import React, { useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Typography, Select, message, Modal, Tooltip, Alert
} from 'antd';
import {
  TagOutlined, TagsOutlined, InboxOutlined
} from '@ant-design/icons';
import { useTransports, useCategorizeTransport, useBulkCategorize } from '../../hooks/useData';
import { parseTRDescription, WORK_TYPE_MAP, WORK_TYPE_COLORS } from '../../utils/tr-parser';

const { Title, Text } = Typography;

const WORK_TYPES = [
  { value: 'project', label: 'Project' },
  { value: 'enhancement', label: 'Enhancement' },
  { value: 'break-fix', label: 'Break/Fix' },
  { value: 'general', label: 'General' },
  { value: 'basis', label: 'Basis' },
  { value: 'security', label: 'Security' },
];

const UnassignedTRs: React.FC = () => {
  const { data: transports = [], isLoading } = useTransports();
  const categorize = useCategorizeTransport();
  const bulkCategorize = useBulkCategorize();

  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [bulkType, setBulkType] = useState<string>('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkWorkItemId, setBulkWorkItemId] = useState<string>('');

  const unassigned = transports.filter((t: any) => !t.workType || !t.workItem_ID);

  const handleCategorize = async (trNumber: string, workType: string) => {
    try {
      await categorize.mutateAsync({ trNumber, workType });
      message.success(`${trNumber} categorized as ${WORK_TYPE_MAP[workType]}`);
    } catch {
      message.error('Failed to categorize transport');
    }
  };

  const handleBulkCategorize = async () => {
    if (!bulkType) {
      message.warning('Select a work type');
      return;
    }
    try {
      await bulkCategorize.mutateAsync(
        selectedRows.map((r: any) => ({
          trNumber: r.trNumber,
          workType: bulkType,
          workItemId: bulkWorkItemId || undefined,
        }))
      );
      message.success(`${selectedRows.length} transports categorized`);
      setSelectedRows([]);
      setBulkModalOpen(false);
    } catch {
      message.error('Bulk categorization failed');
    }
  };

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
      title: 'Suggested Type',
      key: 'suggestion',
      width: 150,
      render: (_: any, record: any) => {
        const parsed = parseTRDescription(record.trDescription || '');
        if (parsed.suggestedType) {
          return (
            <Tooltip title={`Based on keywords: "${record.trDescription}"`}>
              <Tag color={WORK_TYPE_COLORS[parsed.suggestedType] || 'default'}>
                {WORK_TYPE_MAP[parsed.suggestedType] || parsed.suggestedType} (suggested)
              </Tag>
            </Tooltip>
          );
        }
        return <Text type="secondary">No suggestion</Text>;
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
      width: 200,
      render: (_: any, record: any) => {
        const parsed = parseTRDescription(record.trDescription || '');
        return (
          <Space>
            {parsed.suggestedType && (
              <Tooltip title={`Accept suggestion: ${WORK_TYPE_MAP[parsed.suggestedType]}`}>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<TagOutlined />}
                  onClick={() => handleCategorize(record.trNumber, parsed.suggestedType!)}
                  loading={categorize.isPending}
                >
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
        Unassigned Transports ({unassigned.length})
      </Title>

      {unassigned.length === 0 && !isLoading && (
        <Alert
          message="All Caught Up!"
          description="All transports have been categorized and assigned to work items."
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {selectedRows.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>{selectedRows.length} selected</Text>
            <Button
              type="primary"
              icon={<TagsOutlined />}
              onClick={() => setBulkModalOpen(true)}
            >
              Bulk Categorize
            </Button>
            <Button onClick={() => setSelectedRows([])}>Clear Selection</Button>
          </Space>
        </Card>
      )}

      <Card>
        <Table
          dataSource={unassigned}
          columns={columns}
          loading={isLoading}
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
          {selectedRows.map((r: any) => (
            <Tag key={r.trNumber}>{r.trNumber}</Tag>
          ))}
          <Select
            placeholder="Select work type"
            options={WORK_TYPES}
            value={bulkType || undefined}
            onChange={setBulkType}
            style={{ width: '100%', marginTop: 12 }}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default UnassignedTRs;
