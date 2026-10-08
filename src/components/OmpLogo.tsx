/**
 * omp's mark (oh-my-pi): the pi symbol with its plugin connector, drawn inline
 * so it follows the surrounding text colour while the connector keeps omp's
 * orange. Same geometry as `public/omp-logo.svg` / `public/favicon.svg`.
 */
import React from 'react';

interface OmpLogoProps {
  className?: string;
  style?: React.CSSProperties;
  /** Draw the bars in the current text colour instead of omp's white. */
  inherit?: boolean;
  title?: string;
}

export const OmpLogo: React.FC<OmpLogoProps> = ({ className, style, inherit = true, title = 'oh-my-pi' }) => (
  <svg viewBox="0 0 120 90" className={className} style={style} role="img" aria-label={title}>
    <title>{title}</title>
    <g fill={inherit ? 'currentColor' : '#fafafa'}>
      <rect x="10" y="8" width="100" height="12" rx="2" />
      <rect x="25" y="20" width="12" height="62" rx="2" />
      <rect x="75" y="20" width="12" height="45" rx="2" />
    </g>
    <rect x="71" y="55" width="20" height="16" rx="3" fill="#f97316" />
    <rect x="76" y="59" width="3" height="8" rx="1" fill="#0d0d0d" />
    <rect x="82" y="59" width="3" height="8" rx="1" fill="#0d0d0d" />
    <circle cx="18" cy="14" r="2" fill="#f97316" opacity="0.8" />
    <circle cx="102" cy="14" r="2" fill="#f97316" opacity="0.8" />
  </svg>
);
