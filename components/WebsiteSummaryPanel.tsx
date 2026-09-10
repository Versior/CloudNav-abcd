import React from 'react';
import { ExternalLink, Loader2, RefreshCw, Sparkles, Tag, X } from 'lucide-react';
import type { LinkItem } from '../types.ts';
import type { WebsiteSummaryResult } from '../services/websiteSummaryService.ts';

export interface WebsiteSummaryPanelState {
  link: Pick<LinkItem, 'id' | 'title' | 'url' | 'description'>;
  status: 'loading' | 'ready' | 'error';
  result?: WebsiteSummaryResult;
  error?: string;
}

interface WebsiteSummaryPanelProps {
  state: WebsiteSummaryPanelState | null;
  onClose: () => void;
  onRetry: () => void;
  onOpen: () => void;
}

const WebsiteSummaryPanel: React.FC<WebsiteSummaryPanelProps> = ({ state, onClose, onRetry, onOpen }) => {
  if (!state) return null;
  const result = state.result;
  return (
    <aside className="cloudnav-website-summary-panel" role="dialog" aria-label="AI 页面摘要" aria-live="polite">
      <header className="cloudnav-website-summary-header">
        <div className="cloudnav-website-summary-heading">
          <span className="cloudnav-website-summary-kicker"><Sparkles size={14} /> AI 页面摘要</span>
          <strong>{state.status === 'loading' ? '正在阅读页面…' : result?.title || state.link.title}</strong>
          <small>{state.link.url}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭 AI 页面摘要" title="关闭"><X size={18} /></button>
      </header>

      {state.status === 'loading' && (
        <div className="cloudnav-website-summary-loading">
          <Loader2 size={20} className="animate-spin" />
          <div><strong>正在抓取正文并生成总结</strong><span>网站已在新标签页打开，这里不会阻塞阅读。</span></div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="cloudnav-website-summary-error">
          <strong>这次没有生成摘要</strong>
          <p>{state.error || '页面正文暂时无法读取。'}</p>
          <div><button type="button" onClick={onRetry}><RefreshCw size={14} />重新生成</button><button type="button" onClick={onOpen}><ExternalLink size={14} />打开网站</button></div>
        </div>
      )}

      {state.status === 'ready' && result && (
        <div className="cloudnav-website-summary-body">
          <p className="cloudnav-website-summary-lead">{result.summary}</p>
          {result.bullets.length > 0 && <section><h3>重点</h3><ul>{result.bullets.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
          {result.facts && result.facts.length > 0 && <section><h3>事实依据</h3><ul>{result.facts.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
          {result.actions && result.actions.length > 0 && <section><h3>可以做什么</h3><ul>{result.actions.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></section>}
          {result.tags.length > 0 && <div className="cloudnav-website-summary-tags">{result.tags.map(tag => <span key={tag}><Tag size={12} />{tag}</span>)}</div>}
          <footer><span>{result.fromCache ? '来自本地缓存' : '刚刚生成'} · 不替代原文</span><button type="button" onClick={onOpen}><ExternalLink size={14} />打开原文</button></footer>
        </div>
      )}
    </aside>
  );
};

export default WebsiteSummaryPanel;
