import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Command, Inbox, Clock, FolderOpen } from 'lucide-react';
import { LinkItem, Category, INBOX_ID } from '../types';
import { highlightMatch } from '../services/searchService';

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

interface ScoredCommand extends CommandItem {
  score: number;
}

const normalize = (value: string) => value.toLowerCase().trim();

const getCredentialText = (link: LinkItem) => (link.credentials || [])
  .flatMap(c => [c.label, c.username, c.account, c.remark])
  .filter(Boolean)
  .join(' ');

const isFuzzyMatch = (text: string, query: string) => {
  let index = 0;
  for (const char of text) {
    if (char === query[index]) index += 1;
    if (index === query.length) return true;
  }
  return false;
};

const scoreCommand = (cmd: CommandItem, query: string) => {
  const q = normalize(query.replace(/^>/, ''));
  if (!q) return 0;
  const haystack = [cmd.title, cmd.description || '', ...cmd.keywords].map(normalize);
  if (normalize(cmd.title) === q) return 120;
  if (normalize(cmd.title).startsWith(q)) return 100;
  if (normalize(cmd.title).includes(q)) return 85;
  if (haystack.some(text => text.startsWith(q))) return 70;
  if (haystack.some(text => text.includes(q))) return 55;
  if (haystack.some(text => isFuzzyMatch(text, q))) return 30;
  return 0;
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, links, categories, actions, onOpenLink, onSelectCategory, onOpenInbox }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isCommandMode = query.startsWith('>');

  const visibleLinks = useMemo(() => links.filter(link => !link.deletedAt), [links]);

  const linkCommands = useMemo<CommandItem[]>(() => visibleLinks.map(link => {
    const cat = categories.find(c => c.id === link.categoryId);
    const credentialText = getCredentialText(link);
    return {
      id: `link:${link.id}`,
      title: link.title,
      description: `${cat?.name || '未分类'} · ${link.description || link.url}${link.visitCount ? ` · ${link.visitCount}次访问` : ''}`,
      keywords: [
        link.title,
        link.url,
        link.description || '',
        link.note || '',
        (link.tags || []).join(' '),
        credentialText,
        cat?.name || '',
      ].filter(Boolean),
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
  }), [visibleLinks, categories, onOpenLink]);

  const categoryCommands = useMemo<CommandItem[]>(() => categories.map(cat => {
    const childIds = categories.filter(c => c.parentId === cat.id).map(c => c.id);
    const linkCount = visibleLinks.filter(l => l.categoryId === cat.id || childIds.includes(l.categoryId)).length;
    return {
      id: `cat:${cat.id}`,
      title: cat.name,
      description: `分类 · ${linkCount} 个链接`,
      keywords: [cat.name, cat.id, categories.find(c => c.id === cat.parentId)?.name || ''].filter(Boolean),
      icon: <FolderOpen size={14} className="text-slate-400" />,
      group: 'category',
      run: () => onSelectCategory?.(cat.id),
    };
  }), [categories, visibleLinks, onSelectCategory]);

  const allCommands = useMemo(() => [...linkCommands, ...categoryCommands, ...actions], [linkCommands, categoryCommands, actions]);

  const defaultCommands = useMemo(() => {
    const inboxLinks = visibleLinks.filter(l => l.categoryId === INBOX_ID);
    const inboxCmds: CommandItem[] = inboxLinks.length > 0 ? [{
      id: 'goto-inbox',
      title: `待整理 (${inboxLinks.length})`,
      description: `点击查看待整理的 ${inboxLinks.length} 个链接`,
      keywords: ['inbox', '待整理'],
      icon: <Inbox size={14} className="text-amber-500" />,
      group: 'action',
      run: () => onOpenInbox?.(),
    }] : [];

    const recent = [...visibleLinks]
      .filter(l => l.lastVisitedAt)
      .sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0))
      .slice(0, 8);
    const frequent = [...visibleLinks]
      .filter(l => (l.visitCount || 0) > 0)
      .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
      .slice(0, 8);
    const seen = new Set<string>();
    const defaultLinks = [...recent, ...frequent]
      .filter(link => {
        if (seen.has(link.id)) return false;
        seen.add(link.id);
        return true;
      })
      .map(link => linkCommands.find(cmd => cmd.id === `link:${link.id}`))
      .filter((cmd): cmd is CommandItem => !!cmd)
      .slice(0, 12);

    return [...inboxCmds, ...defaultLinks, ...actions.slice(0, 6)].slice(0, 25);
  }, [visibleLinks, linkCommands, actions, onOpenInbox]);

  const filtered = useMemo<ScoredCommand[]>(() => {
    const q = query.trim();

    if (isCommandMode) {
      return actions
        .map(cmd => ({ ...cmd, score: scoreCommand(cmd, q) }))
        .filter(cmd => !q.slice(1) || cmd.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    }

    if (!q) return defaultCommands.map((cmd, index) => ({ ...cmd, score: defaultCommands.length - index }));

    return allCommands
      .map(cmd => ({ ...cmd, score: scoreCommand(cmd, q) }))
      .filter(cmd => cmd.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [allCommands, defaultCommands, query, isCommandMode, actions]);

  const safeIndex = Math.max(0, Math.min(selectedIndex, filtered.length - 1));

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${safeIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [safeIndex]);

  const queryForHighlight = query.trim().replace(/^>/, '');

  const renderGroup = (group: CommandItem['group'], label: string) => {
    const items = filtered.filter(cmd => cmd.group === group);
    if (items.length === 0) return null;
    return (
      <div key={group}>
        <div className="px-4 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {label}
        </div>
        {items.map((cmd) => {
          const idx = filtered.findIndex(item => item.id === cmd.id);
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
                <div className="text-sm font-medium truncate">{highlightMatch(cmd.title, queryForHighlight)}</div>
                {cmd.description && (
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{highlightMatch(cmd.description, queryForHighlight)}</div>
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={isCommandMode ? '输入命令...' : '搜索链接、分类、笔记、账号备注，或输入 > 执行命令...'}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {isCommandMode ? '没有找到匹配的命令' : '没有找到匹配项'}
            </div>
          ) : (
            <>
              {!query.trim() && !isCommandMode && (
                <div className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50">
                  <Clock size={12} /> 最近访问 / 高频 / 待整理
                </div>
              )}
              {renderGroup('link', '链接')}
              {renderGroup('category', '分类')}
              {renderGroup('action', '操作')}
            </>
          )}
        </div>

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
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
