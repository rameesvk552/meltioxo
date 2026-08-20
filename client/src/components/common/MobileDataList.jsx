import React from 'react';
import { Card } from 'antd';

/** A compact, touch-friendly alternative to wide data tables on phones. */
export default function MobileDataList({ items, emptyText = 'No records found', renderItem }) {
  if (!items.length) return <div className="mobile-data-list__empty">{emptyText}</div>;

  return <div className="mobile-data-list">
    {items.map((item) => (
      <Card className="mobile-data-list__item" size="small" key={item.id || item.key}>
        {typeof renderItem === 'function' ? renderItem(item) : null}
      </Card>
    ))}
  </div>;
}
