import React from 'react';
import { Bookmark, BookmarkPlus, BookOpen, Bot, ExternalLink, FileText, Loader2, PanelRightOpen, Sparkles, Star, X } from 'lucide-react';
import type { RssArticle } from '../types';
import { formatRssTime } from '../services/rssService';

interface RssArticleReaderProps {
  article?: RssArticle;
  feedTitle?: string;
  isOpen: boolean;
  loadingSummary: boolean;
  readerSheetRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onToggleStar: () => void;
  onGenerateSummary: () => void;
  onSaveArticle?: (article: RssArticle) => void;
  onSaveToReadLater?: (article: RssArticle) => void;
  onSaveToReading?: (article: RssArticle) => void;
  onCaptureInspiration?: (article: RssArticle) => void;
}

const plainText = (value?: string) => (value || '')
  .replace(/<[^>]*>?/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

const EvidenceList: React.FC<{ label: string; items?: string[] }> = ({ label, items }) => (
  items?.length ? <section className="cloudnav-rss-ai-subsection"><strong>{label}</strong><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></section> : null
);

const RssArticleReader: React.FC<RssArticleReaderProps> = ({
  article, feedTitle, isOpen, loadingSummary, readerSheetRef, onClose, onToggleStar, onGenerateSummary,
  onSaveArticle, onSaveToReadLater, onSaveToReading, onCaptureInspiration,
}) => (
  <article ref={readerSheetRef} data-rss-region="reader-sheet" className="cloudnav-rss-reader-sheet" hidden={!isOpen}>
    <div className="cloudnav-rss-reader-sheet-head">
      <span className="cloudnav-rss-v5-kicker">ARTICLE VIEW</span>
      <button type="button" onClick={onClose} aria-label="关闭文章阅读" title="关闭文章阅读"><X size={17} />关闭</button>
    </div>
    {article ? <>
      <div className="cloudnav-rss-reader-meta"><span>{article.sourceTitle || feedTitle || '未知来源'}</span><span>{formatRssTime(article.publishedAt)}</span><span>{article.author || '资讯'}</span></div>
      <h2>{article.title}</h2>
      <p className="cloudnav-rss-reader-summary">{plainText(article.summary) || '该文章没有提供摘要。打开原文查看完整内容。'}</p>
      <section className="cloudnav-rss-reader-content"><span className="cloudnav-rss-v5-kicker">正文摘录</span><p>{plainText(article.content || article.summary) || '订阅源没有提供正文摘录，请打开原文查看完整内容。'}</p></section>
      <div className="cloudnav-rss-reader-actions">
        <button type="button" className="cloudnav-primary-button" onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}><ExternalLink size={15} />打开原文</button>
        <button type="button" className="cloudnav-quiet-button" onClick={onToggleStar}><Star size={15} className={article.starred ? 'fill-current text-amber-500' : ''} />{article.starred ? '已收藏' : '收藏'}</button>
        {onSaveToReadLater && <button type="button" className="cloudnav-quiet-button" onClick={() => onSaveToReadLater(article)}><BookmarkPlus size={15} />稍后阅读</button>}
        {onSaveToReading && <button type="button" className="cloudnav-quiet-button" onClick={() => onSaveToReading(article)}><BookOpen size={15} />阅读 Inbox</button>}
        {onCaptureInspiration && <button type="button" className="cloudnav-quiet-button" onClick={() => onCaptureInspiration(article)}><FileText size={15} />记入灵感</button>}
        {onSaveArticle && <button type="button" className="cloudnav-quiet-button" onClick={() => onSaveArticle(article)}><Bookmark size={15} />保存入口</button>}
      </div>
      <section className="cloudnav-rss-ai-panel" data-rss-ai-summary>
        <div className="cloudnav-rss-ai-head"><span><Bot size={16} />AI 阅读卡片</span>{article.aiUpdatedAt && <small>{formatRssTime(article.aiUpdatedAt)}生成</small>}</div>
        {article.aiSummary ? <>
          <p>{article.aiSummary}</p>
          <EvidenceList label="明确事实" items={article.aiFacts || article.aiBullets} />
          <EvidenceList label="行动建议" items={article.aiActions} />
          <EvidenceList label="原文依据" items={article.aiEvidence} />
          {article.aiTags?.length ? <div className="cloudnav-rss-ai-tags">{article.aiTags.map(tag => <span key={tag}>#{tag}</span>)}</div> : null}
          <button type="button" className="cloudnav-text-button" onClick={onGenerateSummary} disabled={loadingSummary}>{loadingSummary ? '重新生成中…' : '重新生成'}</button>
        </> : <div className="cloudnav-rss-ai-empty"><p>先读标题和原始摘要。需要更快判断时，让 AI 给出结论、事实、行动建议和原文依据。</p><button type="button" className="cloudnav-primary-button" onClick={onGenerateSummary} disabled={loadingSummary}>{loadingSummary ? <><Loader2 size={15} className="animate-spin" />生成中…</> : <><Sparkles size={15} />生成阅读卡片</>}</button></div>}
      </section>
      <div className="cloudnav-rss-reader-url"><PanelRightOpen size={14} />{article.url}</div>
    </> : <div className="cloudnav-rss-reader-empty"><FileText size={26} /><strong>选择一篇文章</strong><span>文章详情将在这里独立显示。</span></div>}
  </article>
);

export default RssArticleReader;
