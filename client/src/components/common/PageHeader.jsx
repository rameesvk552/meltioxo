import React from 'react';
export default function PageHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}>{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}
