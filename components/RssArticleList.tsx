import type React from 'react';

export interface RssArticleListProps {
  children: React.ReactNode;
  className?: string;
}

const RssArticleList: React.FC<RssArticleListProps> = ({ children, className = '' }) => (
  <section data-rss-region="article-list" className={className}>
    {children}
  </section>
);

export default RssArticleList;
