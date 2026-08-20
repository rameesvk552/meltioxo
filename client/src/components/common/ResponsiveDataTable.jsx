import React from 'react';
import { Table } from 'antd';
import MobileDataList from './MobileDataList';

/**
 * Shared desktop-table / mobile-card bridge for list screens.
 * `mobileRenderItem` keeps each page in control of its useful mobile fields,
 * while all breakpoints and card treatment stay consistent.
 */
export default function ResponsiveDataTable({
  columns,
  dataSource = [],
  rowKey = 'id',
  loading,
  pagination = { pageSize: 10 },
  scroll,
  emptyText,
  mobileRenderItem
}) {
  return (
    <>
      <div className="mobile-table-alternative">
        <MobileDataList
          items={dataSource}
          emptyText={emptyText}
          renderItem={mobileRenderItem}
        />
      </div>
      <div className="desktop-table-only">
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey={rowKey}
          loading={loading}
          pagination={pagination}
          scroll={scroll}
        />
      </div>
    </>
  );
}
