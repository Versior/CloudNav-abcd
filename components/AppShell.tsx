import type React from 'react';
import DesktopSidebar from './DesktopSidebar';
import TopCommandBar from './TopCommandBar';
import PageContainer from './PageContainer';

export interface AppShellProps {
  children: React.ReactNode;
}

/**
 * The single application frame shared by pinned sites, workbench, and RSS.
 * Domain markup is migrated into the three structural slots incrementally.
 */
const AppShell: React.FC<AppShellProps> = ({ children }) => (
  <div data-shell="cloudnav" className="cloudnav-app-shell contents">
    <DesktopSidebar>
      <TopCommandBar>
        <PageContainer>{children}</PageContainer>
      </TopCommandBar>
    </DesktopSidebar>
  </div>
);

export { DesktopSidebar, TopCommandBar, PageContainer };
export default AppShell;
