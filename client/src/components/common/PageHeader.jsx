import React from 'react';
export default function PageHeader({ title, action }) {
  return (
    <div className="responsive-list-page-header">
      <h1>{title}</h1>
      {action && <div>{action}</div>}
    </div>
  );
}
