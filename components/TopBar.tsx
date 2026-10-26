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
  <header className="material-content hairline-b flex h-14 shrink-0 items-center gap-2 px-3 lg:px-6">
    <button type="button" onClick={onOpenSidebar} className="rounded-md p-1.5 text-ink-soft hover:bg-raised lg:hidden" aria-label="打开导航">
      <Menu size={18} />
    </button>

    {/* 左侧占位与右侧按钮组等宽，让搜索框真正居中 */}
    <div className="hidden flex-1 lg:block" aria-hidden="true" />
    <div className={`${mobileSearchOpen ? 'flex' : 'hidden lg:flex'} relative w-full min-w-0 max-w-xl lg:flex-none lg:basis-[min(36rem,46vw)]`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        value={searchQuery}
        onChange={event => onSearchChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') onSubmitSearch(); }}
        placeholder={placeholder}
        className="material-sunken w-full rounded-[9px] py-1.5 pl-9 pr-[6.5rem] text-[14px] text-ink outline-none transition-shadow placeholder:text-ink-muted focus:shadow-[inset_0_0_0_2px_hsl(var(--accent)/0.55)]"
        style={{ fontSize: 16 }}
      />
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {searchMode === 'internal' && (
          <button
            type="button"
            onClick={onToggleAdvanced}
            aria-label="高级筛选"
            className={`rounded-full p-1.5 transition-colors ${advancedActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-raised'}`}
          >
            <Filter size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleSearchMode}
          className="rounded-full px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-raised"
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

    <button type="button" onClick={onToggleMobileSearch} className="rounded-md p-1.5 text-ink-soft hover:bg-raised lg:hidden" aria-label="打开搜索">
      {mobileSearchOpen ? <X size={17} /> : <Search size={17} />}
    </button>

    <div className="flex flex-1 items-center justify-end gap-1">
      <button
        type="button"
        onClick={onOpenPalette}
        title="命令面板 (⌘K)"
        className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-ink-muted hover:bg-raised hover:text-ink-soft md:flex"
      >
        <Command size={13} />
      </button>
      <button type="button" onClick={onToggleTheme} className="rounded-lg p-1.5 text-ink-soft hover:bg-raised" aria-label="切换主题">
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      {authenticated && (
        <button type="button" onClick={onLogout} title="退出登录" className="rounded-lg p-1.5 text-ink-soft hover:bg-raised">
          <LogOut size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="ml-0.5 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-ink-inverse shadow-sm transition-opacity hover:opacity-90"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">添加</span>
      </button>
    </div>
  </header>
);

export default TopBar;
