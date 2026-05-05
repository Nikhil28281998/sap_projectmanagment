import { type CSSProperties, type Key, type ReactNode } from 'react';
import { Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { EmptyState } from './EmptyState';
import { SkeletonPanel } from './SkeletonPanel';

// NOTE: Virtualization is intentionally out of scope here; defer to Phase 2c.
// If rendering > ~500 rows becomes common, swap the inner AntD Table for a
// virtualized variant (e.g. rc-virtual-list based) behind the same API.

type Density = 'comfortable' | 'compact' | 'dense';
type AntdSize = 'small' | 'middle' | 'large';

const densityToSize: Record<Density, AntdSize> = {
  comfortable: 'large',
  compact: 'middle',
  dense: 'small',
};

export type DataTableProps<T> = {
  columns: ColumnsType<T>;
  dataSource: T[];
  rowKey: keyof T | ((record: T) => Key);
  loading?: boolean;
  density?: Density;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: { label: string; onClick: () => void };
  pagination?: false | { pageSize?: number };
  onRowClick?: (record: T) => void;
  className?: string;
  'data-testid'?: string;
};

export function DataTable<T extends object>(props: DataTableProps<T>) {
  const {
    columns,
    dataSource,
    rowKey,
    loading = false,
    density = 'compact',
    emptyTitle,
    emptyDescription,
    emptyIcon,
    emptyAction,
    pagination,
    onRowClick,
    className,
  } = props;
  const testId = props['data-testid'];

  const wrapperStyle: CSSProperties = {
    width: '100%',
  };

  if (loading) {
    const rows =
      pagination !== undefined && pagination !== false
        ? pagination.pageSize ?? 5
        : 5;
    return (
      <div className={className} data-testid={testId} style={wrapperStyle}>
        <SkeletonPanel variant="table" rows={rows} />
      </div>
    );
  }

  if (dataSource.length === 0) {
    return (
      <div className={className} data-testid={testId} style={wrapperStyle}>
        <EmptyState
          title={emptyTitle ?? 'No data'}
          description={emptyDescription}
          icon={emptyIcon}
          action={emptyAction}
          size="md"
        />
      </div>
    );
  }

  const size = densityToSize[density];

  const paginationProp: false | TablePaginationConfig =
    pagination === false
      ? false
      : pagination !== undefined
        ? { pageSize: pagination.pageSize }
        : { pageSize: 10 };

  const onRow = onRowClick
    ? (record: T) => ({
        onClick: () => onRowClick(record),
        style: { cursor: 'pointer' },
      })
    : undefined;

  const rowKeyProp =
    typeof rowKey === 'function'
      ? (rowKey as (record: T) => Key)
      : (record: T) => record[rowKey] as unknown as Key;

  return (
    <div className={className} data-testid={testId} style={wrapperStyle}>
      <Table<T>
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKeyProp}
        size={size}
        pagination={paginationProp}
        onRow={onRow}
      />
    </div>
  );
}
