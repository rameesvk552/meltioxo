import React, { useState } from 'react';
import { Pagination, Spin, Table } from 'antd';
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
  const [page, setPage] = useState(1);
  const pageSize = typeof pagination === 'object' ? pagination.pageSize || 10 : 10;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(dataSource.length / pageSize)));
  const mobileRows = pagination === false ? dataSource : dataSource.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <div className="mobile-table-alternative" aria-busy={Boolean(loading)}>
        {loading ? <div className="mobile-data-list__empty"><Spin tip="Loading records"><div style={{ minHeight: 80 }} /></Spin></div> : (
          <MobileDataList items={mobileRows} rowKey={rowKey} emptyText={emptyText} renderItem={mobileRenderItem} />
        )}
        {!loading && pagination !== false && dataSource.length > pageSize && (
          <Pagination className="mobile-data-list__pagination" simple current={currentPage} pageSize={pageSize} total={dataSource.length} onChange={setPage} aria-label="List pages" />
        )}
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
