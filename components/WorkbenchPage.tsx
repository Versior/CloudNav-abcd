import React from 'react';
import HomeDashboard, { type HomeDashboardProps } from './HomeDashboard';

export interface WorkbenchPageProps extends HomeDashboardProps {
  pageStatus?: 'ready' | 'hydrating' | 'offline';
}

const WorkbenchPage: React.FC<WorkbenchPageProps> = ({ pageStatus = 'ready', ...dashboardProps }) => (
  <section data-page="workbench" data-dashboard-layout="command-center" data-page-status={pageStatus} className="cloudnav-workbench-page">
    {pageStatus !== 'ready' && <div className="mb-3 text-[11px] text-slate-400">{pageStatus === 'hydrating' ? '正在同步工作台…' : '当前使用本地工作台'}</div>}
    <HomeDashboard {...dashboardProps} />
  </section>
);

export default WorkbenchPage;
