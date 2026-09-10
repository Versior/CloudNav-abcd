import React from 'react';
import { Grid2X2, Plus, Radio, Settings, Zap } from 'lucide-react';

interface MobileBottomNavProps {
  activeView: 'links' | 'workbench' | 'rss' | 'inspiration' | 'read-later' | 'github' | 'inbox' | 'reading';
  onLinks: () => void;
  onWorkbench: () => void;
  onRss: () => void;
  onAdd: () => void;
  onSettings: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeView, onLinks, onWorkbench, onRss, onAdd, onSettings }) => (
  <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200/90 bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/95 lg:hidden" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }} aria-label="移动端导航">
    <button type="button" data-spatial-id="mobile-nav-links" onClick={onLinks} className={`flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] ${activeView === 'links' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}><Grid2X2 size={18} />网站</button>
    <button type="button" data-spatial-id="mobile-nav-workbench" onClick={onWorkbench} className={`flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] ${activeView === 'workbench' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}><Zap size={18} />工作台</button>
    <button type="button" onClick={onAdd} className="-mt-5 flex flex-col items-center gap-1 text-[11px] text-white"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-500/30"><Plus size={22} /></span><span className="text-blue-600 dark:text-blue-400">快速添加</span></button>
    <button type="button" data-spatial-id="mobile-nav-rss" onClick={onRss} className={`flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] ${activeView === 'rss' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}><Radio size={18} />资讯</button>
    <button type="button" data-spatial-id="mobile-nav-settings" onClick={onSettings} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] text-slate-500"><Settings size={18} />设置</button>
  </nav>
);

export default MobileBottomNav;
