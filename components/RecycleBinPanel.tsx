import React, { useMemo } from 'react';
import { RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { Category, LinkItem } from '../types';
import { filterDeletedLinks, restoreLinks } from '../services/recycleBin';

interface RecycleBinPanelProps {
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  authToken: boolean;
  onEditLink?: (link: LinkItem) => void;
}

const RecycleBinPanel: React.FC<RecycleBinPanelProps> = ({ links, categories, onUpdateLinks, authToken, onEditLink }) => {
  const deletedLinks = useMemo(() => filterDeletedLinks(links).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)), [links]);
  const categoryName = (id: string) => categories.find(category => category.id === id)?.name || '未分类';

  const requireAuth = () => {
    if (!authToken) {
      alert('请先登录后管理回收站');
      return false;
    }
    return true;
  };

  const restore = (id: string) => {
    if (!requireAuth()) return;
    onUpdateLinks(restoreLinks(links, [id]));
  };

  const permanentlyDelete = (id: string) => {
    if (!requireAuth()) return;
    if (!confirm('永久删除后将无法通过回收站恢复，确定继续吗？')) return;
    onUpdateLinks(links.filter(link => link.id !== id));
  };

  const empty = () => {
    if (!requireAuth() || deletedLinks.length === 0) return;
    if (!confirm(`确定永久删除回收站中的 ${deletedLinks.length} 个链接吗？`)) return;
    const deleted = new Set(deletedLinks.map(link => link.id));
    onUpdateLinks(links.filter(link => !deleted.has(link.id)));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-800 dark:text-white inline-flex items-center gap-2"><Trash2 size={17} className="text-rose-500" /> 回收站</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">删除的链接会先保留在这里，恢复前不会出现在置顶、搜索和工作台中。</p>
        </div>
        <button type="button" onClick={empty} disabled={deletedLinks.length === 0} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900/60 dark:hover:bg-rose-950/30"><Trash2 size={14} /> 清空回收站</button>
      </div>

      {deletedLinks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-slate-700">回收站是空的</div>
      ) : (
        <div className="space-y-2">
          {deletedLinks.map(link => (
            <div key={link.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-sm font-bold text-rose-500 dark:bg-rose-950/30">{link.icon ? <img src={link.icon} alt="" className="h-5 w-5" /> : link.title.charAt(0)}</div>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onEditLink?.(link)} className="block max-w-full truncate text-left text-sm font-medium text-slate-800 hover:text-blue-600 dark:text-slate-100" title={link.title}>{link.title}</button>
                <div className="truncate text-xs text-slate-400">{categoryName(link.categoryId)} · 删除于 {link.deletedAt ? new Date(link.deletedAt).toLocaleString('zh-CN', { hour12: false }) : '未知时间'}</div>
              </div>
              <button type="button" onClick={() => restore(link.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-blue-700"><Undo2 size={14} /> 恢复</button>
              <button type="button" onClick={() => permanentlyDelete(link.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-slate-600"><RotateCcw size={14} /> 永久删除</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RecycleBinPanel;
