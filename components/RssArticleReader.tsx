import type React from 'react';

export interface RssArticleReaderProps {
  children: React.ReactNode;
}

const RssArticleReader: React.FC<RssArticleReaderProps> = ({ children }) => (
  <div data-rss-region="reader" className="min-w-0">
    {children}
  </div>
);

export default RssArticleReader;
