import type React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/** Shared scroll surface for the three primary pages. */
const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => (
  <div data-shell-part="page-container" className={`contents cloudnav-page-container ${className}`}>
    {children}
  </div>
);

export default PageContainer;
