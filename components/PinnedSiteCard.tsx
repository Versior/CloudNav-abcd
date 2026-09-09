import type React from 'react';

export interface PinnedSiteCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}

const PinnedSiteCard: React.FC<PinnedSiteCardProps> = ({ children, className = '', onClick, onContextMenu }) => (
  <div className={`cloudnav-pinned-site-card ${className}`} onClick={onClick} onContextMenu={onContextMenu}>
    {children}
  </div>
);

export default PinnedSiteCard;
