import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, Eye, Activity, Tag, FileText, Bookmark } from 'lucide-react';
import { LinkItem, Category } from '../types';

interface LinkDetailsDrawerProps {
  link: LinkItem | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUpdate: (linkId: string, updates: Partial<LinkItem>) => void;
}

const statusLabels: Record<string, string> = {
  unread: '未读',
  read: '已读',
  favorite: '收藏',
  archived: '归档',
};

const statusColors: Record<string, string> = {
  unread: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300',
  read: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300',
  favorite: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300',
  archived: 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400',
};

const healthLabels: Record<string, string> = { ok: '正常', broken: '失效', redirected: '已跳转', unknown: '未知' };
const healthColors: Record<string, string> = {
  ok: 'text-green-600', broken: 'text-red-600', redirected: 'text-amber-600', unknown: 'text-slate-400',
};

const LinkDetailsDrawer: React.FC<LinkDetailsDrawerProps> = ({ link, isOpen, onClose, categories, onUpdate }) => {
  const [note, setNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (link) {
      setNote(link.note || '');
      setTagsInput((link.tags || []).join(', '));
      setStatus(link.status || '');
    }
  }, [link]);

  if (!isOpen || !link) return null;

  const category = categories.find(c => c.id === link.categoryId);
  const health = link.health;
  const timeAgo = (ts?: number) => {
    if (!ts) return '从未';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  };

  const parseTags = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);

  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-80 bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-sm truncate dark:text-white">链接详情</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={16} /></button>
      </div>

      <div className="overflow-y-auto h-full pb-20 p-4 space-y-4">
        <div>
          <h2 className="text-base font-bold dark:text-white break-words">{link.title}</h2>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all mt-1 flex items-center gap-1">
            <ExternalLink size={12} /> {link.url.length > 50 ? link.url.slice(0, 50) + '...' : link.url}
          </a>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {category && <><Bookmark size={12} /> {category.name}</>}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(link.lastVisitedAt)}</span>
          <span className="flex items-center gap-1"><Eye size={12} /> {link.visitCount || 0} 次</span>
        </div>

        {health && (
          <div className={`flex items-center gap-1 text-xs ${healthColors[health.status] || ''}`}>
            <Activity size={12} />
            {healthLabels[health.status] || '未知'}
            {health.statusCode ? ` (${health.statusCode})` : ''}
            <span className="text-slate-400 ml-1">{timeAgo(health.checkedAt)}</span>
          </div>
        )}

        {link.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">{link.description}</p>
        )}

        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1"><FileText size={12} /> 备注</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => onUpdate(link.id, { note })}
            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={3} placeholder="添加备注..."
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1"><Tag size={12} /> 标签</label>
          <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} onBlur={() => onUpdate(link.id, { tags: parseTags(tagsInput) })}
            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="用逗号分隔"
          />
          {link.tags && link.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {link.tags.map(t => <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">{t}</span>)}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1"><Activity size={12} /> 状态</label>
          <select value={status} onChange={e => { const v = e.target.value; setStatus(v); onUpdate(link.id, { status: (v || undefined) as LinkItem['status'] }); }}
            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">无</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {status && statusLabels[status] && (
            <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${statusColors[status] || ''}`}>{statusLabels[status]}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkDetailsDrawer;
