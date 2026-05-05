import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { ColumnsType } from 'antd/es/table';
import { DataTable } from '../DataTable';

// jsdom lacks matchMedia; AntD's responsiveObserver needs it.
beforeAll(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
});

type Row = { id: string; name: string; count: number };

const columns: ColumnsType<Row> = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Count', dataIndex: 'count', key: 'count' },
];

const rows: Row[] = [
  { id: 'a', name: 'Alpha', count: 1 },
  { id: 'b', name: 'Beta', count: 2 },
];

describe('DataTable', () => {
  it('renders SkeletonPanel (table variant) when loading=true', () => {
    const { container } = render(
      <DataTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading
        data-testid="dt"
      />,
    );
    const skeleton = container.querySelector('[data-variant="table"]');
    expect(skeleton).toBeTruthy();
    // AntD table should not render
    expect(container.querySelector('.ant-table')).toBeNull();
  });

  it('renders EmptyState with default title "No data" when dataSource is empty', () => {
    const { getByText, container } = render(
      <DataTable<Row> columns={columns} dataSource={[]} rowKey="id" />,
    );
    expect(getByText('No data')).toBeTruthy();
    // AntD table should not render in empty branch
    expect(container.querySelector('.ant-table')).toBeNull();
  });

  it('renders custom emptyTitle/description and fires emptyAction onClick', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <DataTable<Row>
        columns={columns}
        dataSource={[]}
        rowKey="id"
        emptyTitle="Nothing here"
        emptyDescription="Try adding one."
        emptyAction={{ label: 'Add', onClick }}
      />,
    );
    expect(getByText('Nothing here')).toBeTruthy();
    expect(getByText('Try adding one.')).toBeTruthy();
    fireEvent.click(getByText('Add'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders AntD table rows when dataSource has items', () => {
    const { container, getByText } = render(
      <DataTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
      />,
    );
    expect(container.querySelector('.ant-table')).toBeTruthy();
    expect(getByText('Alpha')).toBeTruthy();
    expect(getByText('Beta')).toBeTruthy();
  });

  it('density="dense" maps to AntD size="small" (ant-table-small class)', () => {
    const { container } = render(
      <DataTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        density="dense"
      />,
    );
    expect(container.querySelector('.ant-table-small')).toBeTruthy();
  });

  it('onRowClick fires when a row is clicked', () => {
    const onRowClick = vi.fn();
    const { getByText } = render(
      <DataTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0]).toEqual(rows[0]);
  });

  it('passes className and data-testid on the wrapper', () => {
    const { getByTestId } = render(
      <DataTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        className="c"
        data-testid="t"
      />,
    );
    expect(getByTestId('t').className).toBe('c');
  });
});
