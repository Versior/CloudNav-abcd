import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Search } from 'lucide-react';
import { LinkItem, Category } from '../types';
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
}

interface ScoredCommand extends CommandItem { score: number }
const normalize = (value: string) => value.toLowerCase().trim();
const isFuzzyMatch = (text: string, query: string) => {
  let index = 0;
  for (const char of text) {
    if (char === query[index]) index += 1;
    if (index === query.length) return true;
  }
  return false;
};
const scoreCommand = (command: CommandItem, query: string) => {
  const normalized = normalize(query.replace(/^>/, ''));
  if (!normalized) return 0;
  const title = normalize(command.title);
  const haystack = [title, command.description || '', ...command.keywords].map(normalize);
  if (title === normalized) return 120;
  if (title.startsWith(normalized)) return 100;
  if (title.includes(normalized)) return 85;
  if (haystack.some(text => text.startsWith(normalized))) return 70;
  if (haystack.some(text => text.includes(normalized))) return 55;
  return haystack.some(text => isFuzzyMatch(text, normalized)) ? 30 : 0;
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, links, categories, actions, onOpenLink, onSelectCategory }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const visibleLinks = useMemo(() => links.filter(link => !link.deletedAt), [links]);
  const linkCommands = useMemo<CommandItem[]>(() => visibleLinks.map(link => {
    const category = categories.find(item => item.id === link.categoryId);
    return {
      id: `link:${link.id}`,
      title: link.title,
      description: `${category?.name || '未分类'} · ${link.description || link.url}${link.visitCount ? ` · ${link.visitCount}次访问` : ''}`,
      keywords: [link.title, link.url, link.description || '', link.note || '', (link.tags || []).join(' '), category?.name || ''].filter(Boolean),
      icon: link.icon ? <img src={link.icon} alt="" className="w-4 h-4 rounded" /> : <div className="w-4 h-4 rounded bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center">{link.title.charAt(0)}</div>,
      group: 'link',
      run: () => onOpenLink ? onOpenLink(link) : window.open(link.url, '_blank', 'noopener,noreferrer'),
    };
  }), [visibleLinks, categories, onOpenLink]);
  const categoryCommands = useMemo<CommandItem[]>(() => categories.map(category => {
    const childIds = categories.filter(item => item.parentId === category.id).map(item => item.id);
    const count = visibleLinks.filter(link => link.categoryId === category.id || childIds.includes(link.categoryId)).length;
    return { id: `category:${category.id}`, title: category.name, description: `分类 · ${count} 个链接`, keywords: [category.name, category.id], icon: <FolderOpen size={14} className="text-slate-400" />, group: 'category', run: () => onSelectCategory?.(category.id) };
  }), [categories, visibleLinks, onSelectCategory]);
  const allCommands = useMemo(() => [...linkCommands, ...categoryCommands, ...actions], [linkCommands, categoryCommands, actions]);
  const defaults = useMemo(() => {
    const recent = [...visibleLinks].filter(link => link.lastVisitedAt).sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0)).slice(0, 8);
    const frequent = [...visibleLinks].filter(link => (link.visitCount || 0) > 0).sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 8);
    const seen = new Set<string>();
    return [...recent, ...frequent].filter(link => !seen.has(link.id) && seen.add(link.id)).map(link => linkCommands.find(command => command.id === `link:${link.id}`)).filter((command): command is CommandItem => !!command).slice(0, 12).concat(actions.slice(0, 6));
  }, [visibleLinks, linkCommands, actions]);
  const commandMode = query.startsWith('>');
  const filtered = useMemo<ScoredCommand[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return defaults.map((command, index) => ({ ...command, score: defaults.length - index }));
    const source = commandMode ? actions : allCommands;
    return source.map(command => ({ ...command, score: scoreCommand(command, trimmed) })).filter(command => command.score > 0).sort((a, b) => b.score - a.score).slice(0, 50);
  }, [actions, allCommands, commandMode, defaults, query]);
  const safeIndex = Math.max(0, Math.min(selectedIndex, filtered.length - 1));

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${safeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [safeIndex]);

  const run = (command?: CommandItem) => { if (!command) return; command.run(); onClose(); };
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex(index => Math.min(index + 1, filtered.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex(index => Math.max(index - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); run(filtered[safeIndex]); }
    else if (event.key === 'Escape') onClose();
  }, [filtered, safeIndex, onClose]);

  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 pt-[12vh]" onClick={onClose}><div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden" onClick={event => event.stopPropagation()}><div className="relative border-b border-slate-200 dark:border-slate-700"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} onKeyDown={handleKeyDown} placeholder="搜索书签或输入 > 使用命令" className="w-full py-4 pl-11 pr-4 bg-transparent outline-none text-sm" /></div><div ref={listRef} className="max-h-[min(60vh,520px)] overflow-y-auto p-2">{filtered.length ? filtered.map((command, index) => <button key={command.id} data-index={index} onClick={() => run(command)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left ${index === safeIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}><div className="w-7 h-7 shrink-0 flex items-center justify-center">{command.icon || <Search size={15} className="text-slate-400" />}</div><div className="min-w-0 flex-1"><div className="text-sm font-medium truncate dark:text-white">{query ? highlightMatch(command.title, query.replace(/^>/, '').trim()) : command.title}</div><div className="text-xs text-slate-400 truncate">{command.description}</div></div></button>) : <div className="py-12 text-center text-sm text-slate-400">没有匹配结果</div>}</div></div></div>;
};

export default CommandPalette;
