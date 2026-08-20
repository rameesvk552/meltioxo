import React from 'react';
import PageDrawerControls from './PageDrawerControls';

/**
 * Shared action header for data-list pages. Desktop keeps the familiar title
 * and right-aligned action; phones promote the primary action and place the
 * filter/summary controls in a stable two-column row beneath it.
 */
export default function ResponsiveListPageHeader({
  title,
  primaryAction,
  filters,
  summary,
  activeFilterCount = 0,
  onReset,
}) {
  return (
    <div className="responsive-list-page-header">
      <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary, var(--color-gold))', margin: 0 }}>{title}</h1>
      <div className="responsive-list-page-actions">
        {(filters || summary) && <PageDrawerControls title={title} filters={filters} summary={summary} activeFilterCount={activeFilterCount} onReset={onReset} />}
        {primaryAction}
      </div>
    </div>
  );
}
