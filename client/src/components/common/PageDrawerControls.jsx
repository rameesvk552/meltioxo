import React, { useState } from 'react';
import { Badge, Button, Drawer, Space } from 'antd';
import { FilterOutlined, ReloadOutlined, SlidersOutlined } from '@ant-design/icons';

/**
 * Shared list-page controls. Pass each screen's existing filter fields and
 * summary cards; this keeps the mobile experience consistent without moving
 * filtering state out of the page that owns the data.
 */
export default function PageDrawerControls({ title = 'List', filters, summary, onReset, activeFilterCount = 0 }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <>
      <Space className="page-drawer-controls" size={8} wrap>
        {filters && (
          <Badge count={activeFilterCount} size="small" offset={[-2, 3]}>
            <Button icon={<FilterOutlined />} onClick={() => setFiltersOpen(true)}>Filters</Button>
          </Badge>
        )}
        {summary && <Button icon={<SlidersOutlined />} onClick={() => setSummaryOpen(true)}>Summary</Button>}
      </Space>

      <Drawer title={`${title} filters`} placement="right" open={filtersOpen} onClose={() => setFiltersOpen(false)} width={360}>
        <div className="page-drawer-panel">
          {filters}
          <Button type="primary" block onClick={() => setFiltersOpen(false)}>Apply filters</Button>
          {onReset && <Button block icon={<ReloadOutlined />} onClick={onReset}>Clear filters</Button>}
        </div>
      </Drawer>

      <Drawer title={`${title} summary`} placement="right" open={summaryOpen} onClose={() => setSummaryOpen(false)} width={360}>
        <div className="page-drawer-summary">{summary}</div>
      </Drawer>
    </>
  );
}
