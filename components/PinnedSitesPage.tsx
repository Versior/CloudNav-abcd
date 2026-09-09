import React from 'react';

export interface PinnedSitesPageProps {
  children: React.ReactNode;
  isDefaultView: boolean;
  pinnedCount: number;
}

const PinnedSitesPage: React.FC<PinnedSitesPageProps> = ({ children, isDefaultView, pinnedCount }) => (
  <section data-page="pinned-sites" data-pinned-only={isDefaultView ? 'true' : 'false'} data-pinned-count={pinnedCount} className="cloudnav-pinned-page min-h-full">
    {children}
  </section>
);

export default PinnedSitesPage;
