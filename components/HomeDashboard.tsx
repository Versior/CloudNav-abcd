import React, { useState } from 'react';
import { Inbox, Clock, Eye, Activity, BarChart3, ExternalLink, AlertTriangle, Zap, Folder, ChevronDown } from 'lucide-react';
import { LinkItem, Category, INBOX_ID } from '../types';

interface HomeDashboardProps {
  links: LinkItem[];
  categories: Category[];
  onOpenInbox: () => void;
  onClickLink: (link: LinkItem) => void;
  onSelectCategory: (categoryId: string) => void;
}

const timeAgo = (ts: number) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

const HomeDashboard: React.FC<HomeDashboardProps> = ({ links, categories, onOpenInbox, onClickLink, onSelectCategory }) => {
  const [foldersCollapsed, setFoldersCollapsed] = useState(true);
  const normalLinks = links.filter(l => l.categoryId !== INBOX_ID && !l.deletedAt);
  const inboxLinks = links.filter(l => l.categoryId === INBOX_ID && !l.deletedAt);
  const brokenLinks = normalLinks.filter(l => l.health?.status === 'broken' || l.health?.status === 'redirected');
  const recentLinks = [...normalLinks].filter(l => l.lastVisitedAt).sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0)).slice(0, 6);
  const freqLinks = [...normalLinks].filter(l => (l.visitCount || 0) > 0).sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 6);
  const parentCategories = categories.filter(c => !c.parentId && c.id !== INBOX_ID);
  const linkCountByCategory = normalLinks.reduce<Record<string, number>>((acc, link) => {
    acc[link.categoryId] = (acc[link.categoryId] || 0) + 1;
    return acc;
  }, {});
  const folderCards = parentCategories.map(cat => {
    const childIds = categories.filter(c => c.parentId === cat.id).map(c => c.id);
    const count = (linkCountByCategory[cat.id] || 0) + childIds.reduce((sum, id) => sum + (linkCountByCategory[id] || 0), 0);
    return { ...cat, count, childCount: childIds.length };
  });

  const StatCard = ({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: number; color: string; onClick?: () => void }) => (
    <button onClick={onClick} className="group flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all text-left w-full">
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center group-hover:scale-105 transition-transform`}>{icon}</div>
      <div>
        <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
        <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
      </div>
    </button>
  );

  const LinkRow = ({ link, meta }: { link: LinkItem; meta?: string }) => (
    <button
      key={link.id}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left w-full"
      onClick={() => onClickLink(link)}
    >
      <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0 overflow-hidden">
        {link.icon ? <img src={link.icon} alt="" className="w-5 h-5" /> : link.title.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate dark:text-white">{link.title}</div>
        <div className="text-xs text-slate-400 truncate">{meta || link.description || link.url}</div>
      </div>
      <ExternalLink size={12} className="text-slate-300 shrink-0" />
    </button>
  );

  return (
    <section className="space-y-5 rounded-3xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50/80 via-white to-purple-50/60 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Zap size={20} className="text-blue-500" /> 工作台概览</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">最近访问、高频链接和待整理内容都在这里。</p>
        </div>
        {inboxLinks.length > 0 && (
          <button onClick={onOpenInbox} className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 shadow-sm">
            整理 {inboxLinks.length} 个链接
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Inbox size={22} className="text-amber-600" />} label="待整理" value={inboxLinks.length} color="bg-amber-50 dark:bg-amber-900/20" onClick={onOpenInbox} />
        <StatCard icon={<Activity size={22} className="text-green-600" />} label="总链接" value={normalLinks.length} color="bg-green-50 dark:bg-green-900/20" />
        <StatCard icon={<Eye size={22} className="text-blue-600" />} label="已访问" value={normalLinks.filter(l => (l.visitCount || 0) > 0).length} color="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard icon={<AlertTriangle size={22} className="text-red-600" />} label="异常链接" value={brokenLinks.length} color="bg-red-50 dark:bg-red-900/20" />
      </div>

      {folderCards.length > 0 && (
        <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
          <button
            onClick={() => setFoldersCollapsed(v => !v)}
            className="w-full text-left text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2"><Folder size={15} className="text-amber-500" /> 文件夹</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${foldersCollapsed ? '-rotate-90' : ''}`} />
          </button>
          {!foldersCollapsed && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
              {folderCards.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => onSelectCategory(folder.id)}
                  className="group text-left p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/70 dark:hover:bg-blue-900/20 transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Folder size={18} />
                    </div>
                    <span className="text-xs font-semibold text-slate-400">{folder.count}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">{folder.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{folder.childCount ? `${folder.childCount} 个子文件夹` : '主文件夹'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><Clock size={15} className="text-blue-500" /> 最近访问</h3>
          {recentLinks.length > 0 ? (
            <div className="space-y-1">
              {recentLinks.map(l => <LinkRow key={l.id} link={l} meta={l.lastVisitedAt ? timeAgo(l.lastVisitedAt) : undefined} />)}
            </div>
          ) : (
            <p className="text-sm text-slate-400 px-3 py-6 text-center">还没有访问记录，点开几个网站后这里会变聪明。</p>
          )}
        </div>

        <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><BarChart3 size={15} className="text-purple-500" /> 高频链接</h3>
          {freqLinks.length > 0 ? (
            <div className="space-y-1">
              {freqLinks.map(l => <LinkRow key={l.id} link={l} meta={`${l.visitCount || 0} 次访问`} />)}
            </div>
          ) : (
            <p className="text-sm text-slate-400 px-3 py-6 text-center">常用网站会自动浮上来，像小猫蹭到手边。</p>
          )}
        </div>
      </div>

      {brokenLinks.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium text-sm mb-1"><AlertTriangle size={14} /> {brokenLinks.length} 个链接可能已失效</div>
          <p className="text-xs text-red-600 dark:text-red-400">打开链接详情侧边栏可查看健康状态。</p>
        </div>
      )}
    </section>
  );
};

export default HomeDashboard;
