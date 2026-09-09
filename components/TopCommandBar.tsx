import type React from 'react';

export interface TopCommandBarProps {
  children: React.ReactNode;
}

/** Structural boundary for the global command/search bar. */
const TopCommandBar: React.FC<TopCommandBarProps> = ({ children }) => (
  <div data-shell-part="topbar" className="contents">
    {children}
  </div>
);

export default TopCommandBar;
