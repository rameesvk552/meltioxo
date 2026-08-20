import React from 'react';
import { Card } from 'antd';
export default function StatCard({ title, value, prefix, suffix, trend }) {
  return (
    <Card bordered={false} style={{ height: '100%' }}>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
        {prefix}{value}{suffix}
      </div>
      {trend && <div style={{ marginTop: 8, color: trend > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
        {trend > 0 ? '+' : ''}{trend}%
      </div>}
    </Card>
  );
}
