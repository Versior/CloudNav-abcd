import React from 'react';
import RssReaderPage from './RssReaderPage';
import type { AIConfig, RssArticle } from '../types';

export interface RssPageProps {
  onSaveArticle?: (article: RssArticle) => void;
  onSaveToReadLater?: (article: RssArticle) => void;
  onSaveToReading?: (article: RssArticle) => void;
  onCaptureInspiration?: (article: RssArticle) => void;
  initialArticleId?: string;
  onInitialArticleConsumed?: () => void;
  aiConfig?: AIConfig;
}

const RssPage: React.FC<RssPageProps> = ({ onSaveArticle, onSaveToReadLater, onSaveToReading, onCaptureInspiration, initialArticleId, onInitialArticleConsumed, aiConfig }) => (
  <section data-page="rss" className="cloudnav-rss-page">
    <RssReaderPage onSaveArticle={onSaveArticle} onSaveToReadLater={onSaveToReadLater} onSaveToReading={onSaveToReading} onCaptureInspiration={onCaptureInspiration} initialArticleId={initialArticleId} onInitialArticleConsumed={onInitialArticleConsumed} aiConfig={aiConfig} />
  </section>
);

export default RssPage;
