import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, Moon, Sun, Settings, Cloud, Upload, Download, Command, Inbox, BarChart3, Clock } from 'lucide-react';
import { LinkItem, Category, INBOX_ID } from '../types';

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  keywords: string[];
  icon?: React.ReactNode;
  group: 'link' | 'category' | 'action';
  run: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  links: LinkItem[];
  categories: Category[];
  actions: CommandItem[];
  onOpenLink?: (link: LinkItem) => void;
  onSelectCategory?: (categoryId: string) => void;
  onOpenInbox?: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, links, categories, actions, onOpenLink, onSelectCategory, onOpenInbox }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isCommandMode = query.startsWith('>');

  // 构建命令
  const allCommands = useMemo(() => {
    // 常用/最近链接（无搜索时排在前面）
    const recentLinks = [...links]
      .filter(l => l.lastVisitedAt)
      .sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0))
      .slice(0, 10);

    const freqLinks = [...links]
      .filter(l => (l.visitCount || 0) > 0)
      .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
      .slice(0, 10);

    // 去重合并
    const seen = new Set<string>();
    const topLinks = [...recentLinks, ...freqLinks].filter(l => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    }).slice(0, 15);

    const linkCmds: CommandItem[] = topLinks.map(link => {
      const cat = categories.find(c => c.id === link.categoryId);
      return {
        id: `link:${link.id}`,
        title: link.title,
        description: `${link.description || link.url}${link.visitCount ? ` · ${link.visitCount}次访问` : ''}`,
        keywords: [link.title, link.url, link.description || '', cat?.name || ''].filter(Boolean),
        icon: link.icon ? (
          <img src={link.icon} alt="" className="w-4 h-4 rounded" />
        ) : (
          <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
            {link.title.charAt(0)}
          </div>
        ),
        group: 'link',
        run: () => onOpenLink ? onOpenLink(link) : window.open(link.url, '_blank'),
      };
    });

    const catCmds: CommandItem[] = categories.map(cat => ({
      id: `cat:${cat.id}`,
      title: cat.name,
      description: `分类 · ${links.filter(l => l.categoryId === cat.id).length} 个链接`,
      keywords: [cat.name],
      group: 'category',
      run: () => onSelectCategory?.(cat.id),
    }));

    return [...linkCmds, ...catCmds, ...actions];
  }, [links, categories, actions]);

  // 过滤
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 命令模式: >dark, >add, >settings 等
    if (isCommandMode) {
      const cmdText = q.slice(1);
      return actions.filter(a =>
        a.title.toLowerCase().includes(cmdText) ||
        a.keywords.some(k => k.toLowerCase().includes(cmdText))
      ).slice(0, 20);
    }

    if (!q) {
      // 无搜索时显示 Inbox 快捷入口 + 常用链接
      const inboxLinks = links.filter(l => l.categoryId === INBOX_ID);
      const inboxCmds: CommandItem[] = inboxLinks.length > 0 ? [{
        id: 'goto-inbox',
        title: `待整理 (${inboxLinks.length})`,
        description: `点击查看待整理的 ${inboxLinks.length} 个链接`,
        keywords: ['inbox', '待整理'],
        icon: <Inbox size={14} className="text-amber-500" />,
        group: 'action' as const,
        run: () => onOpenInbox?.(),
      }] : [];

      return [...inboxCmds, ...allCommands].slice(0, 25);
    }

    return allCommands
      .filter(cmd =>
        cmd.keywords.some(k => k.toLowerCase().includes(q)) ||
        cmd.title.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [allCommands, query, links, isCommandMode, actions]);

  // 选中索引安全
  const safeIndex = Math.min(selectedIndex, filtered.length - 1);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[safeIndex]) {
      e.preventDefault();
      filtered[safeIndex].run();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, safeIndex, onClose]);

  // 滚动到选中项
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${safeIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [safeIndex]);

  // 分组渲染
  const renderGroup = (group: string, label: string) => {
    const items = filtered.filter(cmd => cmd.group === group);
    if (items.length === 0) return null;
    const startIndex = filtered.findIndex(cmd => cmd.id === items[0].id);
    return (
      <div key={group}>
        <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {label}
        </div>
        {items.map((cmd, i) => {
          const idx = startIndex + i;
          const isSelected = idx === safeIndex;
          return (
            <button
              key={cmd.id}
              data-index={idx}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => { cmd.run(); onClose(); }}
            >
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                {cmd.icon || <Search size={14} className="text-slate-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{cmd.title}</div>
                {cmd.description && (
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{cmd.description}</div>
                )}
              </div>
              {group === 'action' && (
                <kbd className="hidden md:inline-flex text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                  ↵
                </kbd>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* 搜索框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={isCommandMode ? '输入命令...' : '搜索链接、分类，或输入 > 执行命令...'}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
            ESC
          </kbd>
        </div>

        {/* 命令列表 */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {isCommandMode ? '没有找到匹配的命令' : '没有找到匹配项'}
            </div>
          ) : (
            <>
              {!query.trim() && !isCommandMode && (
                <div className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50">
                  <Clock size={12} /> 最近访问 & 常用
                </div>
              )}
              {renderGroup('link', '链接')}
              {renderGroup('category', '分类')}
              {renderGroup('action', '操作')}
            </>
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Command size={12} /> <span>K</span> 打开面板
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-[10px]">↑↓</span> 导航
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            ↵ 确认
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            ESC 关闭
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
            {'>'} 命令
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            tag: 标签
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            cat: 分类
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
