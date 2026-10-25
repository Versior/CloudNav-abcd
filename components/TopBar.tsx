import React from 'react';
import { Command, Filter, LogOut, Menu, Moon, Plus, Search, Sun, X } from 'lucide-react';
import AdvancedSearchBar from './AdvancedSearchBar';

interface TopBarProps {
  searchQuery: string;
  searchMode: 'internal' | 'external';
  placeholder: string;
  darkMode: boolean;
  authenticated: boolean;
  mobileSearchOpen: boolean;
  advancedOpen: boolean;
  advancedActive: boolean;
  tags: string[];
  filters: Record<string, string | boolean | undefined>;
  onSearchChange: (value: string) => void;
  onSubmitSearch: () => void;
  onToggleSearchMode: () => void;
  onToggleMobileSearch: () => void;
  onToggleAdvanced: () => void;
  onCloseAdvanced: () => void;
  onFilterChange: (filters: Record<string, string | boolean | undefined>) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onAdd: () => void;
  onOpenSidebar: () => void;
  onOpenPalette: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  searchQuery, searchMode, placeholder, darkMode, authenticated, mobileSearchOpen,
  advancedOpen, advancedActive, tags, filters,
  onSearchChange, onSubmitSearch, onToggleSearchMode, onToggleMobileSearch,
  onToggleAdvanced, onCloseAdvanced, onFilterChange,
  onToggleTheme, onLogout, onAdd, onOpenSidebar, onOpenPalette,
}) => (
  <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-xl lg:px-6">
    <button type="button" onClick={onOpenSidebar} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-700" aria-label="打开导航">
      <Menu size={18} />
    </button>

    <div className={`${mobileSearchOpen ? 'flex' : 'hidden lg:flex'} relative min-w-0 flex-1 max-w-xl`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={searchQuery}
        onChange={event => onSearchChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') onSubmitSearch(); }}
        placeholder={placeholder}
        className="w-full rounded-full bg-slate-100 py-2 pl-9 pr-[6.5rem] text-[13px] text-slate-700 outline-none ring-1 ring-transparent transition-all placeholder:text-slate-400 focus:bg-white focus:ring-blue-500/60 dark:bg-slate-700/60 dark:text-slate-100 dark:focus:bg-slate-700"
        style={{ fontSize: 16 }}
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {searchMode === 'internal' && (
          <button
            type="button"
            onClick={onToggleAdvanced}
            aria-label="高级筛选"
            className={`rounded-full p-1.5 transition-colors ${advancedActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-600'}`}
          >
            <Filter size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleSearchMode}
          className="rounded-full px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          {searchMode === 'internal' ? '站内' : '站外'}
        </button>
      </div>
      {searchMode === 'internal' && (
        <AdvancedSearchBar
          isOpen={advancedOpen}
          onClose={onCloseAdvanced}
          tags={tags}
          workspaces={[]}
          filters={filters}
          onFilterChange={onFilterChange}
        />
      )}
    </div>

    <button type="button" onClick={onToggleMobileSearch} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-700" aria-label="打开搜索">
      {mobileSearchOpen ? <X size={17} /> : <Search size={17} />}
    </button>

    <div className="ml-auto flex items-center gap-1">
      <button
        type="button"
        onClick={onOpenPalette}
        title="命令面板 (⌘K)"
        className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:flex dark:hover:bg-slate-700"
      >
        <Command size={13} />
      </button>
      <button type="button" onClick={onToggleTheme} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700" aria-label="切换主题">
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      {authenticated && (
        <button type="button" onClick={onLogout} title="退出登录" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
          <LogOut size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="ml-0.5 flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">添加</span>
      </button>
    </div>
  </header>
);

export default TopBar;
