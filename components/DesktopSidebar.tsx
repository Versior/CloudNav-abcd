import type React from 'react';

export interface DesktopSidebarProps {
  children: React.ReactNode;
}

/** Structural boundary for the desktop navigation rail. The parent owns domain callbacks. */
const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ children }) => (
  <div data-shell-part="sidebar" className="contents">
    {children}
  </div>
);

export default DesktopSidebar;
