import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from '../../../test/axe';
import {
  StatCard, StatusChip, EmptyState, SectionCard, PageHeader,
  SkeletonPanel, RiskMeter, UserAvatar, DataTable, Timeline,
} from '..';
import { SmileOutlined } from '@ant-design/icons';

describe('a11y — design system components', () => {
  it('StatCard has no violations', async () => {
    const { container } = render(<StatCard label="Active" value={42} caption="projects" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('StatCard (as button) has no violations', async () => {
    const { container } = render(<StatCard label="Active" value={42} onClick={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('StatusChip has no violations', async () => {
    const { container } = render(<StatusChip status="on-track" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('EmptyState with action has no violations', async () => {
    const { container } = render(
      <EmptyState
        title="No projects"
        description="Create one to get started"
        icon={<SmileOutlined aria-hidden />}
        action={{ label: 'Create', onClick: () => {} }}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SectionCard has no violations', async () => {
    const { container } = render(
      <SectionCard title="Section" description="desc"><p>content</p></SectionCard>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('PageHeader has no violations', async () => {
    const { container } = render(
      <PageHeader
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Current' }]}
        title="Current page"
        description="desc"
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SkeletonPanel card variant has no violations', async () => {
    const { container } = render(<SkeletonPanel variant="card" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('RiskMeter has no violations', async () => {
    const { container } = render(<RiskMeter score={72} label="Risk" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('UserAvatar has no violations', async () => {
    const { container } = render(<UserAvatar name="Nikhil Kumar" role="Manager" showName />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('DataTable (empty state) has no violations', async () => {
    const { container } = render(
      <DataTable columns={[{ title: 'Name', dataIndex: 'name', key: 'name' }]} dataSource={[]} rowKey="name" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Timeline has no violations', async () => {
    const { container } = render(
      <Timeline items={[
        { id: '1', title: 'Kickoff', date: '2026-01-01', status: 'done' },
        { id: '2', title: 'UAT', date: '2026-02-01', status: 'in-progress' },
      ]} activeIndex={1} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
