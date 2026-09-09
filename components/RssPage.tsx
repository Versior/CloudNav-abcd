import React from 'react';
import RssReaderPage from './RssReaderPage';
import type { RssArticle } from '../types';

export interface RssPageProps {
  onSaveArticle?: (article: RssArticle) => void;
  initialArticleId?: string;
}

const RssPage: React.FC<RssPageProps> = ({ onSaveArticle }) => (
  <section data-page="rss" className="cloudnav-rss-page">
    <RssReaderPage onSaveArticle={onSaveArticle} />
  </section>
);

export default RssPage;
