import type React from 'react';

export interface RssSourceRailProps {
  children: React.ReactNode;
  className?: string;
}

const RssSourceRail: React.FC<RssSourceRailProps> = ({ children, className = '' }) => (
  <aside data-rss-region="source-rail" className={className}>
    {children}
  </aside>
);

export default RssSourceRail;
