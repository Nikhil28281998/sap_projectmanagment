/**
 * AIDocumentAnalysis — Document analysis modal + SharePoint browser modal
 * Extracted from AIChatDrawer to eliminate the god component (was 1,064 lines).
 * Owns all doc-analysis state and SharePoint browse state.
 */

import React, { useState, useCallback } from 'react';
import {
  Modal, Space, Alert, Row, Col, Typography, Select, Button, Input, Card,
  Checkbox, Badge, Divider, Tag, Empty,
} from 'antd';
import {
  FileSearchOutlined, InboxOutlined, RobotOutlined, CheckCircleOutlined,
  EditOutlined, CloudOutlined, FolderOpenOutlined, FileTextOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { Upload } from 'antd';
const { TextArea } = Input;
import { aiApi, sharePointApi } from '../../services/api';
import { message as antMessage } from 'antd';

const { Text } = Typography;
const { Dragger } = Upload;

const DOC_TYPES = [
  { value: 'email',      label: '✉️ Email / Request' },
  { value: 'veeva',      label: '💊 Veeva Change Control' },
  { value: 'sharepoint', label: '☁️ SharePoint Document' },
  { value: 'general',    label: '📄 General Document' },
];

const CONFIDENCE_COLORS: Record<string, string> = { high: 'green', medium: 'orange', low: 'red' };
const PRIORITY_COLORS: Record<string, string>   = { P1: 'red', P2: 'orange', P3: 'blue' };

interface Proposal {
  workItemName: string;
  workItemType: string;
  projectCode: string;
  priority: string;
  complexity: string;
  currentPhase: string;
  businessOwner: string;
  notes: string;
  estimatedGoLive: string;
  confidence: string;
  selected?: boolean;
}

interface Props {
  open: boolean;
  defaultApp: string;
  onClose: () => void;
  onCreated: (message: string) => void;       // notify parent chat of successful creation
}

const AIDocumentAnalysis: React.FC<Props> = ({ open, defaultApp, onClose, onCreated }) => {
  const [docContent,      setDocContent]      = useState('');
  const [docType,         setDocType]         = useState('email');
  const [docFileName,     setDocFileName]     = useState('');
  const [docApp,          setDocApp]          = useState(defaultApp);
  const [analyzing,       setAnalyzing]       = useState(false);
  const [proposals,       setProposals]       = useState<Proposal[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [creating,        setCreating]        = useState(false);

  // Refine
  const [refineInput,   setRefineInput]   = useState('');
  const [refining,      setRefining]      = useState(false);
  const [refineHistory, setRefineHistory] = useState<string[]>([]);

  // SharePoint browser
  const [spBrowseOpen, setSpBrowseOpen] = useState(false);
  const [spDocuments,  setSpDocuments]  = useState<any[]>([]);
  const [spLoading,    setSpLoading]    = useState(false);
  const [spFolder,     setSpFolder]     = useState('');
  const [spFetching,   setSpFetching]   = useState<string | null>(null);

  const handleDocFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onerror = () => antMessage.error('Failed to read file');
    reader.onload  = (e) => {
      const content = e.target?.result as string;
      setDocContent(content);
      setDocFileName(file.name);
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.eml') || ext.endsWith('.msg')) setDocType('email');
      else if (ext.includes('veeva') || ext.includes('change-control')) setDocType('veeva');
      else if (ext.includes('sharepoint')) setDocType('sharepoint');
    };
    reader.readAsText(file);
    return false;
  }, []);

  const handleAnalyzeDocument = async () => {
    if (!docContent.trim()) { antMessage.warning('Please paste or upload document content.'); return; }
    setAnalyzing(true);
    setProposals([]);
    setAnalysisSummary('');
    try {
      const result = await aiApi.analyzeDocument(docContent, docType, docApp, docFileName);
      if (result.success) {
        const parsed: Proposal[] = JSON.parse(result.proposals).map((p: Proposal) => ({ ...p, selected: true }));
        setProposals(parsed);
        setAnalysisSummary(result.summary);
        antMessage.success(`AI found ${parsed.length} potential work item(s)`);
      } else {
        antMessage.error(result.summary || 'Analysis failed');
      }
    } catch (err: any) {
      antMessage.error(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggleProposal = (index: number) => {
    setProposals(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
  };

  const handleCreateSelected = async () => {
    const selected = proposals.filter(p => p.selected);
    if (selected.length === 0) { antMessage.warning('No items selected.'); return; }
    setCreating(true);
    try {
      const result = await aiApi.createFromProposal(JSON.stringify(selected), docApp);
      if (result.success) {
        antMessage.success(result.message);
        onCreated(result.message);
        setProposals([]);
        setDocContent('');
        setDocFileName('');
        onClose();
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRefineProposals = async () => {
    if (!refineInput.trim() || refining) return;
    setRefining(true);
    try {
      const result = await aiApi.refineProposals(JSON.stringify(proposals), refineInput.trim(), docApp);
      if (result.success) {
        const parsed: Proposal[] = JSON.parse(result.proposals).map((p: Proposal) => ({ ...p, selected: true }));
        setProposals(parsed);
        setRefineHistory(prev => [...prev, refineInput.trim()]);
        setRefineInput('');
        antMessage.success(result.message);
      } else {
        antMessage.error(result.message || 'Refinement failed');
      }
    } catch (err: any) {
      antMessage.error(`Refinement failed: ${err.message}`);
    } finally {
      setRefining(false);
    }
  };

  const handleBrowseSharePoint = async (folder?: string) => {
    setSpLoading(true);
    try {
      const result = await sharePointApi.listDocuments(folder || '');
      if (result.success) {
        setSpDocuments(JSON.parse(result.documents));
        setSpFolder(folder || '');
        setSpBrowseOpen(true);
        if (result.message.includes('demo')) antMessage.info(result.message);
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`SharePoint browse failed: ${err.message}`);
    } finally {
      setSpLoading(false);
    }
  };

  const handleFetchSpDocument = async (doc: any) => {
    setSpFetching(doc.id);
    try {
      const result = await sharePointApi.fetchDocument(doc.id, doc.name);
      if (result.success) {
        setDocContent(result.content);
        setDocFileName(result.fileName || doc.name);
        const name = (doc.name || '').toLowerCase();
        if      (name.includes('veeva') || name.includes('change control')) setDocType('veeva');
        else if (name.includes('email') || name.includes('.msg'))           setDocType('email');
        else                                                                  setDocType('sharepoint');
        if      (name.includes('sap') || name.includes('fico'))  setDocApp('SAP');
        else if (name.includes('coupa'))                          setDocApp('Coupa');
        else if (name.includes('veeva') || name.includes('pharma')) setDocApp('Commercial');
        setSpBrowseOpen(false);
        antMessage.success(`Loaded: ${doc.name}`);
      } else {
        antMessage.error(result.message);
      }
    } catch (err: any) {
      antMessage.error(`Fetch failed: ${err.message}`);
    } finally {
      setSpFetching(null);
    }
  };

  const handleClose = () => {
    setProposals([]);
    setAnalysisSummary('');
    onClose();
  };

  const selectedCount = proposals.filter(p => p.selected).length;

  return (
    <>
      {/* ── Document Analysis Modal ── */}
      <Modal
        title={<Space><FileSearchOutlined style={{ color: '#1677ff' }} /><span>AI Document Analysis</span><Tag color="blue">Beta</Tag></Space>}
        open={open}
        onCancel={handleClose}
        footer={null}
        width={760}
        styles={{ body: { maxHeight: '75vh', overflow: 'auto' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="Upload any project document — emails, Veeva Change Controls, SharePoint exports, or general documents. AI will propose work items for your review."
            type="info"
            showIcon
            style={{ fontSize: 12 }}
          />

          <Row gutter={12}>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Document Type</Text>
              <Select value={docType} onChange={setDocType} style={{ width: '100%' }}
                options={DOC_TYPES.map(dt => ({ value: dt.value, label: dt.label }))} />
            </Col>
            <Col span={12}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Target Application</Text>
              <Select value={docApp} onChange={setDocApp} style={{ width: '100%' }}
                options={[
                  { value: 'SAP',        label: '⚙️ SAP' },
                  { value: 'Coupa',      label: '🛒 Coupa' },
                  { value: 'Commercial', label: '💊 Commercial' },
                ]} />
            </Col>
          </Row>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text strong>Document Content</Text>
              <Space size={4}>
                {docFileName && <Tag color="blue">{docFileName}</Tag>}
                <Button size="small" icon={<CloudOutlined />} onClick={() => handleBrowseSharePoint()} loading={spLoading}>
                  Browse SharePoint
                </Button>
              </Space>
            </div>
            {!docContent ? (
              <Dragger accept=".txt,.html,.htm,.eml,.msg,.csv,.doc,.docx" showUploadList={false}
                beforeUpload={handleDocFileUpload} style={{ padding: '20px 0' }}>
                <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#1677ff', fontSize: 32 }} /></p>
                <p className="ant-upload-text">Click or drag file to upload</p>
                <p className="ant-upload-hint">Supports: .eml, .msg, .txt, .html, .csv, .doc</p>
              </Dragger>
            ) : (
              <div>
                <TextArea value={docContent} onChange={e => setDocContent(e.target.value)}
                  placeholder="Paste document content here..." rows={6}
                  style={{ fontFamily: 'monospace', fontSize: 11 }} />
                <Button type="link" size="small" onClick={() => { setDocContent(''); setDocFileName(''); }}
                  style={{ padding: 0, fontSize: 11, marginTop: 4 }}>
                  Clear content
                </Button>
              </div>
            )}
          </div>

          <Button type="primary" icon={<RobotOutlined />} onClick={handleAnalyzeDocument}
            loading={analyzing} block size="large" disabled={!docContent.trim()}>
            {analyzing ? 'AI is analyzing...' : 'Analyze Document with AI'}
          </Button>

          {analysisSummary && (
            <Alert message="Analysis Summary" description={analysisSummary} type="success" showIcon style={{ fontSize: 12 }} />
          )}

          {proposals.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0' }}>
                <Space>
                  <Text strong>Proposed Work Items</Text>
                  <Badge count={selectedCount} style={{ backgroundColor: 'var(--color-status-risk-low)' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>/ {proposals.length} total</Text>
                </Space>
              </Divider>

              {proposals.map((proposal, idx) => (
                <Card key={idx} size="small" onClick={() => handleToggleProposal(idx)}
                  style={{ borderColor: proposal.selected ? '#1677ff' : '#d9d9d9',
                    backgroundColor: proposal.selected ? '#f0f5ff' : '#fafafa', cursor: 'pointer' }}>
                  <Space size={4} style={{ marginBottom: 4 }}>
                    <Checkbox checked={proposal.selected} onChange={() => handleToggleProposal(idx)} />
                    <Text strong style={{ fontSize: 13 }}>{proposal.workItemName}</Text>
                  </Space>
                  <div>
                    <Tag color="blue">{proposal.workItemType}</Tag>
                    <Tag color={PRIORITY_COLORS[proposal.priority] || 'default'}>{proposal.priority}</Tag>
                    <Tag>{proposal.complexity}</Tag>
                    <Tag color={CONFIDENCE_COLORS[proposal.confidence] || 'default'}>{proposal.confidence} confidence</Tag>
                  </div>
                  {proposal.notes && (
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                      {proposal.notes.substring(0, 200)}{proposal.notes.length > 200 ? '...' : ''}
                    </Text>
                  )}
                  <Space size={8} style={{ marginTop: 4 }}>
                    {proposal.businessOwner && <Text style={{ fontSize: 11 }}>👤 {proposal.businessOwner}</Text>}
                    {proposal.currentPhase && <Text style={{ fontSize: 11 }}>📍 {proposal.currentPhase}</Text>}
                    {proposal.estimatedGoLive && <Text style={{ fontSize: 11 }}>🎯 {proposal.estimatedGoLive}</Text>}
                  </Space>
                </Card>
              ))}

              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleCreateSelected}
                loading={creating} block size="large" disabled={selectedCount === 0}
                style={{ background: 'var(--color-status-risk-low)', borderColor: 'var(--color-status-risk-low)' }}>
                Create {selectedCount} Selected Work Item(s)
              </Button>

              <Divider style={{ margin: '8px 0' }}>
                <Space><EditOutlined /><Text strong style={{ fontSize: 12 }}>Discuss with AI to Refine</Text></Space>
              </Divider>
              {refineHistory.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {refineHistory.map((h, i) => <Tag key={i} color="purple" style={{ fontSize: 10, marginBottom: 2 }}>✏️ {h}</Tag>)}
                </div>
              )}
              <Space.Compact style={{ width: '100%' }}>
                <Input value={refineInput} onChange={e => setRefineInput(e.target.value)}
                  onPressEnter={handleRefineProposals}
                  placeholder='e.g. "Change P2 items to P1", "Split item 2 into sub-tasks"...'
                  disabled={refining} style={{ fontSize: 12 }} />
                <Button type="primary" icon={<RobotOutlined />} onClick={handleRefineProposals}
                  loading={refining} disabled={!refineInput.trim()}>Refine</Button>
              </Space.Compact>
            </>
          )}
        </Space>
      </Modal>

      {/* ── SharePoint Browser Modal ── */}
      <Modal
        title={<Space><CloudOutlined style={{ color: '#1677ff' }} /><span>SharePoint Document Browser</span><Tag color="blue">Live</Tag></Space>}
        open={spBrowseOpen}
        onCancel={() => setSpBrowseOpen(false)}
        footer={null}
        width={640}
        styles={{ body: { maxHeight: '60vh', overflow: 'auto' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert message="Browse SharePoint documents and import them for AI analysis." type="info" showIcon style={{ fontSize: 12 }} />
          {spFolder && (
            <Button size="small" icon={<FolderOpenOutlined />} onClick={() => handleBrowseSharePoint('')}>← Back to root</Button>
          )}
          {spDocuments.length === 0 ? (
            <Empty description="No documents found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {spDocuments.map((doc: any) => {
                const isFolder = doc.type === 'folder';
                const ext = (doc.name || '').split('.').pop()?.toLowerCase() || '';
                const sizeKB = doc.size ? `${Math.round(doc.size / 1024)} KB` : '';
                return (
                  <Card key={doc.id} size="small" hoverable
                    onClick={() => isFolder ? handleBrowseSharePoint(doc.name) : handleFetchSpDocument(doc)}
                    style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        {isFolder
                          ? <FolderOpenOutlined style={{ color: 'var(--color-status-risk-medium)', fontSize: 18 }} />
                          : <FileTextOutlined style={{ color: '#1677ff', fontSize: 18 }} />}
                        <div>
                          <Text strong style={{ fontSize: 13 }}>{doc.name}</Text>
                          <div>
                            {!isFolder && <Tag style={{ fontSize: 10 }}>{ext.toUpperCase()}</Tag>}
                            {sizeKB && <Text type="secondary" style={{ fontSize: 10 }}>{sizeKB}</Text>}
                            {doc.lastModified && (
                              <Text type="secondary" style={{ fontSize: 10, marginLeft: 8 }}>
                                {new Date(doc.lastModified).toLocaleDateString()}
                              </Text>
                            )}
                          </div>
                        </div>
                      </Space>
                      {!isFolder && (
                        <Button type="primary" size="small" icon={<CloudDownloadOutlined />}
                          loading={spFetching === doc.id}
                          onClick={(e) => { e.stopPropagation(); handleFetchSpDocument(doc); }}>
                          Import
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Space>
      </Modal>
    </>
  );
};

export default AIDocumentAnalysis;
