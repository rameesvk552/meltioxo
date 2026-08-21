import React from 'react';

export default function WayonLogo({
  compact = false,
  inverse = false,
  size = 42,
  className = '',
  style,
}) {
  return (
    <div
      className={`wayon-logo${compact ? ' wayon-logo--compact' : ''}${inverse ? ' wayon-logo--inverse' : ''} ${className}`.trim()}
      style={{ '--wayon-logo-size': `${size}px`, ...style }}
      role="img"
      aria-label="Wayon"
    >
      <svg
        className="wayon-logo__mark"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="44" height="44" rx="14" fill="currentColor" />
        <path
          d="M11.5 15.5 18.7 33l5.2-12.2L29.2 33l7.3-17.5"
          fill="none"
          stroke="#fff"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="36.5" cy="12" r="3" fill="#f7c4b8" />
      </svg>
      {!compact && <span className="wayon-logo__name">Wayon</span>}
    </div>
  );
}
