import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Edit3, ExternalLink, FilePlus2, Lightbulb, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import type { AIConfig, Inspiration } from '../types';
import { INSPIRATIONS_KEY } from '../constants/storageKeys';
import { createInspiration, filterInspirations, normalizeInspirations, removeInspiration, updateInspiration } from '../services/inspirationService';
import { summarizeWorkbench } from '../services/geminiService';
import { readWorkspaceList, WORKSPACE_DATA_CHANGED_EVENT, writeWorkspaceList } from '../services/workspaceStorage';
import QuickCaptureModal, { type QuickCaptureInput } from './QuickCaptureModal';

interface InspirationPageProps { aiConfig: AIConfig; initialCapture?: Partial<QuickCaptureInput>; initialId?: string; onInitialIdConsumed?: () => void; onOpenUrl?: (url: string) => void; onNotice?: (message: string) => void; }

const InspirationPage: React.FC<InspirationPageProps> = ({ aiConfig, initialCapture, initialId, onInitialIdConsumed, onOpenUrl, onNotice }) => {
  const [items, setItems] = useState<Inspiration[]>(() => readWorkspaceList(INSPIRATIONS_KEY, normalizeInspirations));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<Inspiration['type'] | 'all'>('all');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureInitial, setCaptureInitial] = useState<Partial<QuickCaptureInput>>();
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    const reload = () => setItems(readWorkspaceList(INSPIRATIONS_KEY, normalizeInspirations));
    window.addEventListener(WORKSPACE_DATA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(WORKSPACE_DATA_CHANGED_EVENT, reload);
  }, []);

  const persist = (next: Inspiration[]) => setItems(writeWorkspaceList(INSPIRATIONS_KEY, next, normalizeInspirations));
  const visible = useMemo(() => filterInspirations(items, { query, status }).filter(item => typeFilter === 'all' || item.type === typeFilter), [items, query, status, typeFilter]);
  const selected = visible.find(item => item.id === selectedId) || visible[0] || null;

  useEffect(() => { if (selected && selected.id !== selectedId) setSelectedId(selected.id); }, [selected, selectedId]);
  useEffect(() => { if (!initialCapture) return; setCaptureInitial(initialCapture); setIsCaptureOpen(true); }, [initialCapture]);
  useEffect(() => {
    if (!initialId || !items.some(item => item.id === initialId)) return;
    const target = items.find(item => item.id === initialId);
    if (!target) return;
    setStatus(target.status === 'archived' ? 'archived' : 'active');
    setTypeFilter('all');
    setQuery('');
    setSelectedId(target.id);
    onInitialIdConsumed?.();
  }, [initialId, items, onInitialIdConsumed]);

  const create = (input: QuickCaptureInput) => { const item = createInspiration(input); persist([item, ...items]); setSelectedId(item.id); setIsCaptureOpen(false); onNotice?.('灵感已保存'); };
  const archive = () => { if (selected) persist(updateInspiration(items, selected.id, { status: selected.status === 'archived' ? 'active' : 'archived', archivedAt: selected.status === 'archived' ? undefined : Date.now() })); };
  const remove = () => { if (selected && confirm('删除这条灵感记录？')) { persist(removeInspiration(items, selected.id)); setSelectedId(null); } };
  const summarize = async () => { if (!selected || (!aiConfig.apiKey && !aiConfig.hasApiKey)) { onNotice?.('请先在设置中配置 AI'); return; } setIsSummarizing(true); try { const result = await summarizeWorkbench({ title: selected.title, summary: selected.content, sourceTitle: selected.sourceTitle || '灵感库' }, aiConfig); persist(updateInspiration(items, selected.id, { aiSummary: result.summary })); onNotice?.('AI 摘要已更新'); } catch (error) { onNotice?.(error instanceof Error ? error.message : 'AI 摘要失败'); } finally { setIsSummarizing(false); } };

  return <section data-page="inspiration" className="cloudnav-workspace-page">
    <header className="cloudnav-page-header"><div><div className="cloudnav-eyebrow"><Lightbulb size={14} /> PERSONAL KNOWLEDGE</div><h1>灵感库</h1><p>把读到的内容、突然的想法和下一步行动放在一个连续空间里。</p></div><button type="button" onClick={() => { setCaptureInitial(undefined); setIsCaptureOpen(true); }} className="cloudnav-button-primary"><Plus size={16} /> 快速记录</button></header>
    <div className="cloudnav-workspace-toolbar"><div className="cloudnav-search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、内容、来源或标签" /></div><div className="cloudnav-segmented"><button className={status === 'active' ? 'is-active' : ''} onClick={() => setStatus('active')}>进行中</button><button className={status === 'archived' ? 'is-active' : ''} onClick={() => setStatus('archived')}>已归档</button></div><span className="cloudnav-count">{visible.length} 条记录</span></div>
    <div className="cloudnav-inspiration-layout"><aside className="cloudnav-filter-rail"><div className="cloudnav-rail-title">记录类型</div><button onClick={() => setTypeFilter('all')} className={`cloudnav-rail-link ${typeFilter === 'all' ? 'is-active' : ''}`}><span>全部</span><span>{items.length}</span></button>{(['idea', 'note', 'quote', 'bookmark'] as const).map(type => <button key={type} onClick={() => setTypeFilter(type)} className={`cloudnav-rail-link ${typeFilter === type ? 'is-active' : ''}`}><span>{type === 'idea' ? '灵感' : type === 'note' ? '笔记' : type === 'quote' ? '摘录' : '网页收藏'}</span><span>{items.filter(item => item.type === type).length}</span></button>)}<div className="mt-8 cloudnav-rail-title">最近标签</div>{[...new Set(items.flatMap(item => item.tags))].slice(0, 8).map(tag => <button key={tag} onClick={() => setQuery(tag)} className="cloudnav-tag-link">#{tag}</button>)}</aside>
      <div className="cloudnav-inspiration-stream">{visible.length === 0 ? <div className="cloudnav-empty-state"><FilePlus2 size={30} /><strong>还没有记录</strong><span>把脑中的想法先写下来，后面再整理。</span><button onClick={() => setIsCaptureOpen(true)} className="cloudnav-button-primary"><Plus size={15} /> 新建第一条</button></div> : visible.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`cloudnav-inspiration-item ${selected?.id === item.id ? 'is-selected' : ''}`}><span className="cloudnav-inspiration-dot" /><span className="min-w-0 flex-1 text-left"><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {item.type === 'idea' ? '灵感' : item.type === 'note' ? '笔记' : item.type === 'quote' ? '摘录' : '网页收藏'}</small><span>{item.content.slice(0, 120)}</span></span>{item.tags.length > 0 && <em>#{item.tags[0]}</em>}</button>)}</div>
      <article className="cloudnav-inspiration-detail">{selected ? <><div className="cloudnav-detail-meta"><span>{selected.status === 'archived' ? '已归档' : '进行中'}</span><span>{new Date(selected.updatedAt).toLocaleString('zh-CN')}</span></div><h2>{selected.title}</h2><div className="cloudnav-detail-content">{selected.content}</div>{selected.aiSummary && <div className="cloudnav-ai-note"><Sparkles size={16} /><div><b>AI 摘要</b><p>{selected.aiSummary}</p></div></div>}{selected.sourceUrl && <button className="cloudnav-source-link" onClick={() => onOpenUrl?.(selected.sourceUrl!)}><ExternalLink size={14} /> {selected.sourceTitle || selected.sourceUrl}</button>}<div className="cloudnav-detail-actions"><button onClick={() => { setCaptureInitial(selected); setIsCaptureOpen(true); }} className="cloudnav-button-secondary"><Edit3 size={14} /> 编辑</button><button onClick={summarize} disabled={isSummarizing} className="cloudnav-button-secondary"><Sparkles size={14} /> {isSummarizing ? '整理中…' : 'AI 整理'}</button><button onClick={archive} className="cloudnav-button-secondary"><Archive size={14} /> {selected.status === 'archived' ? '恢复' : '归档'}</button><button onClick={remove} className="cloudnav-button-danger"><Trash2 size={14} /> 删除</button></div></> : <div className="cloudnav-empty-detail">选择一条记录查看详情</div>}</article></div>
    <QuickCaptureModal isOpen={isCaptureOpen} initial={captureInitial} onClose={() => setIsCaptureOpen(false)} onSave={input => { if (captureInitial && selected) persist(updateInspiration(items, selected.id, input)); else create(input); setIsCaptureOpen(false); }} />
  </section>;
};

export default InspirationPage;
