import React from 'react';
import { Inbox, Clock, Eye, Activity, BarChart3, ExternalLink, AlertTriangle } from 'lucide-react';
import { LinkItem, INBOX_ID } from '../types';

interface HomeDashboardProps {
  links: LinkItem[];
  onOpenInbox: () => void;
  onClickLink: (link: LinkItem) => void;
}

const timeAgo = (ts: number) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
};

const HomeDashboard: React.FC<HomeDashboardProps> = ({ links, onOpenInbox, onClickLink }) => {
  const inboxLinks = links.filter(l => l.categoryId === INBOX_ID);
  const brokenLinks = links.filter(l => l.health?.status === 'broken' || l.health?.status === 'redirected');
  const recentLinks = [...links].filter(l => l.lastVisitedAt).sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0)).slice(0, 10);
  const freqLinks = [...links].filter(l => (l.visitCount || 0) > 0).sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 10);

  const StatCard = ({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: number; color: string; onClick?: () => void }) => (
    <button onClick={onClick} className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all text-left w-full">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>{icon}</div>
      <div><div className="text-2xl font-bold dark:text-white">{value}</div><div className="text-xs text-slate-500">{label}</div></div>
    </button>
  );

  const LinkRow = ({ link }: { link: LinkItem }) => (
    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left w-full"
      onClick={() => onClickLink(link)}
    >
      <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
        {link.title.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate dark:text-white">{link.title}</div>
        <div className="text-xs text-slate-400 truncate">{link.description || link.url}</div>
      </div>
      <ExternalLink size={12} className="text-slate-300 shrink-0" />
    </a>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2"><BarChart3 size={14} /> 概览</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Inbox size={18} className="text-amber-600" />} label="待整理" value={inboxLinks.length} color="bg-amber-50 dark:bg-amber-900/20" onClick={onOpenInbox} />
          <StatCard icon={<Activity size={18} className="text-green-600" />} label="总链接" value={links.length} color="bg-green-50 dark:bg-green-900/20" />
          <StatCard icon={<Eye size={18} className="text-blue-600" />} label="已访问" value={links.filter(l => (l.visitCount || 0) > 0).length} color="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard icon={<AlertTriangle size={18} className="text-red-600" />} label="失效链接" value={brokenLinks.length} color="bg-red-50 dark:bg-red-900/20" />
        </div>
      </div>

      {recentLinks.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-2"><Clock size={14} /> 最近访问</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {recentLinks.map(l => <LinkRow key={l.id} link={l} />)}
          </div>
        </div>
      )}

      {freqLinks.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-2"><BarChart3 size={14} /> 高频链接</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {freqLinks.slice(0, 8).map(l => <LinkRow key={l.id} link={l} />)}
          </div>
        </div>
      )}

      {brokenLinks.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium text-sm mb-2"><AlertTriangle size={14} /> {brokenLinks.length} 个链接可能已失效</div>
          <p className="text-xs text-red-600 dark:text-red-400">打开链接详情侧边栏可运行健康检查确认。</p>
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;
