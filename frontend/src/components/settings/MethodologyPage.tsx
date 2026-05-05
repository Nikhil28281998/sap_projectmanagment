import React from 'react';
import {
  Card, Typography, Tag, Timeline, Table, Collapse, Space, Badge, Skeleton, Empty, Row, Col, Statistic
} from 'antd';
import {
  BookOutlined, ClockCircleOutlined, ExperimentOutlined,
  RocketOutlined, ThunderboltOutlined, ApartmentOutlined
} from '@ant-design/icons';
import { useMethodologies } from '../../hooks/useData';

const { Title, Text, Paragraph } = Typography;

const CATEGORY_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'Waterfall':         { label: 'Traditional',  color: 'blue',    icon: <ApartmentOutlined /> },
  'Agile':             { label: 'Agile',         color: 'green',   icon: <ThunderboltOutlined /> },
  'Hybrid':            { label: 'Hybrid',        color: 'purple',  icon: <ApartmentOutlined /> },
  'SAFe':              { label: 'Scaled Agile',  color: 'cyan',    icon: <ApartmentOutlined /> },
  'Break-fix':         { label: 'Fast Track',    color: 'orange',  icon: <RocketOutlined /> },
  'SAP Activate':      { label: 'SAP',           color: 'gold',    icon: <BookOutlined /> },
  'ASAP':              { label: 'SAP',           color: 'gold',    icon: <BookOutlined /> },
  'Fit-to-Standard':   { label: 'SAP',           color: 'gold',    icon: <BookOutlined /> },
  'Rapid Deployment':  { label: 'SAP',           color: 'gold',    icon: <RocketOutlined /> },
};

const MethodologyPage: React.FC = () => {
  const { data: methodologies = [], isLoading } = useMethodologies();

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (methodologies.length === 0) return <Empty description="No methodologies loaded" />;

  // Group by category
  const sapMethodologies = methodologies.filter((m: any) =>
    ['SAP Activate', 'ASAP', 'Fit-to-Standard', 'Rapid Deployment'].includes(m.methodologyKey)
  );
  const generalMethodologies = methodologies.filter((m: any) =>
    !['SAP Activate', 'ASAP', 'Fit-to-Standard', 'Rapid Deployment'].includes(m.methodologyKey)
  );

  const totalDays = (phases: any[]) => phases?.reduce((s: number, p: any) => s + (p.typicalDurationDays || 0), 0) || 0;
  const testPhases = (phases: any[]) => phases?.filter((p: any) => p.hasTests).length || 0;

  const renderMethodologyCard = (m: any) => {
    const cat = CATEGORY_MAP[m.methodologyKey] || { label: 'Other', color: 'default', icon: <BookOutlined /> };
    const phases = m.phases || [];

    return (
      <Card
        key={m.methodologyKey}
        size="small"
        title={
          <Space>
            {cat.icon}
            <span>{m.name}</span>
            <Tag color={cat.color}>{cat.label}</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Badge count={phases.length} style={{ backgroundColor: '#1677ff' }} title="Phases" />
            <Text type="secondary" style={{ fontSize: 12 }}>{totalDays(phases)} days typical</Text>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>{m.description}</Paragraph>

        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={8}>
            <Statistic title="Phases" value={phases.length} prefix={<ApartmentOutlined />} valueStyle={{ fontSize: 18 }} />
          </Col>
          <Col span={8}>
            <Statistic title="Test Phases" value={testPhases(phases)} prefix={<ExperimentOutlined />}
              valueStyle={{ fontSize: 18, color: testPhases(phases) > 0 ? 'var(--color-status-risk-low)' : '#999' }} />
          </Col>
          <Col span={8}>
            <Statistic title="~Duration" value={totalDays(phases)} suffix="days"
              prefix={<ClockCircleOutlined />} valueStyle={{ fontSize: 18 }} />
          </Col>
        </Row>

        <Timeline
          items={phases.map((p: any) => ({
            color: p.hasTests ? 'green' : 'blue',
            children: (
              <Space>
                <Text strong>{p.name}</Text>
                <Text type="secondary">({p.typicalDurationDays} days)</Text>
                {p.hasTests && <Tag color="green" style={{ fontSize: 10 }}>Testing</Tag>}
              </Space>
            ),
          }))}
        />
      </Card>
    );
  };

  return (
    <div>
      <Title level={3}>
        <BookOutlined style={{ marginRight: 8 }} />
        Project Methodologies
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Available methodologies for SAP project management. Each defines standard phases, typical durations,
        and testing gates. Assign a methodology to a work item to auto-generate milestones.
      </Paragraph>

      {sapMethodologies.length > 0 && (
        <>
          <Title level={4} style={{ color: '#d48806' }}>
            <BookOutlined /> SAP-Specific Methodologies
          </Title>
          {sapMethodologies.map(renderMethodologyCard)}
        </>
      )}

      <Title level={4} style={{ color: '#1677ff', marginTop: 24 }}>
        <ApartmentOutlined /> General Methodologies
      </Title>
      {generalMethodologies.map(renderMethodologyCard)}
    </div>
  );
};

export default MethodologyPage;
