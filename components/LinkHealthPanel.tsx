import React, { useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Check, ExternalLink, PauseCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Category, LinkItem } from '../types';
import { checkLinkHealth, healthLabel, isUnhealthy } from '../services/linkHealthService';

interface LinkHealthPanelProps {
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  onEditLink?: (link: LinkItem) => void;
}

type Scope = 'all' | 'unchecked' | 'broken' | 'category';

const LinkHealthPanel: React.FC<LinkHealthPanelProps> = ({
  links,
  categories,
  onUpdateLinks,
  onEditLink,
}) => {
  const [scope, setScope] = useState<Scope>('all');
  const [categoryId, setCategoryId] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [localLinks, setLocalLinks] = useState<LinkItem[]>(links);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'broken' | 'redirected' | 'ok' | 'unknown'>('broken');
  const stopRef = useRef(false);

  // keep in sync when parent links change after delete/save
  React.useEffect(() => {
    if (!isChecking) setLocalLinks(links);
  }, [links, isChecking]);

  const categoryName = (id: string) => categories.find(c => c.id === id)?.name || '未分类';

  const targets = useMemo(() => {
    const active = localLinks.filter(l => !l.deletedAt);
    if (scope === 'unchecked') return active.filter(l => !l.health?.checkedAt);
    if (scope === 'broken') return active.filter(l => isUnhealthy(l.health?.status) || l.health?.status === 'redirected');
    if (scope === 'category') return active.filter(l => l.categoryId === categoryId);
    return active;
  }, [localLinks, scope, categoryId]);

  const scanned = useMemo(
    () => localLinks.filter(l => !l.deletedAt && l.health?.checkedAt),
    [localLinks]
  );

  const brokenList = useMemo(
    () => scanned.filter(l => l.health?.status === 'broken' || l.health?.status === 'unknown'),
    [scanned]
  );
  const redirectedList = useMemo(
    () => scanned.filter(l => l.health?.status === 'redirected'),
    [scanned]
  );
  const okList = useMemo(
    () => scanned.filter(l => l.health?.status === 'ok'),
    [scanned]
  );

  const visible = useMemo(() => {
    const list =
      filter === 'broken' ? brokenList
      : filter === 'redirected' ? redirectedList
      : filter === 'ok' ? okList
      : filter === 'unknown' ? scanned.filter(l => l.health?.status === 'unknown')
      : scanned;
    return [...list].sort((a, b) => (b.health?.checkedAt || 0) - (a.health?.checkedAt || 0));
  }, [filter, brokenList, redirectedList, okList, scanned]);

  const runCheck = async () => {
    if (targets.length === 0) {
      alert('没有可检测的链接');
      return;
    }
    if (!confirm(`将检测 ${targets.length} 个链接的可访问性，可能需要一些时间。确定继续吗？`)) return;

    setIsChecking(true);
    stopRef.current = false;
    setProgress({ current: 0, total: targets.length });

    let working = [...localLinks];
    let nextIndex = 0;
    let completed = 0;
    const workerCount = Math.min(3, targets.length);
    const selectedBroken = new Set<string>();

    const worker = async () => {
      while (!stopRef.current && nextIndex < targets.length) {
        const link = targets[nextIndex++];
        try {
          const result = await checkLinkHealth(link.url);
          working = working.map(item =>
            item.id === link.id
              ? {
                  ...item,
                  health: {
                    status: result.status === 'invalid' ? 'unknown' : result.status,
                    statusCode: result.statusCode,
                    finalUrl: result.finalUrl,
                    checkedAt: result.checkedAt,
                  },
                  updatedAt: Date.now(),
                }
              : item
          );
          if (result.status === 'broken' || result.status === 'unknown') {
            selectedBroken.add(link.id);
          }
        } catch {
          working = working.map(item =>
            item.id === link.id
              ? {
                  ...item,
                  health: {
                    status: 'broken',
                    statusCode: 0,
                    checkedAt: Date.now(),
                  },
                  updatedAt: Date.now(),
                }
              : item
          );
          selectedBroken.add(link.id);
        } finally {
          completed += 1;
          setProgress({ current: completed, total: targets.length });
          // persist progress periodically so refresh doesn't lose work
          if (completed % 5 === 0 || completed === targets.length) {
            setLocalLinks(working);
            onUpdateLinks(working);
          }
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    setLocalLinks(working);
    onUpdateLinks(working);
    setSelectedIds(selectedBroken);
    setFilter('broken');
    setIsChecking(false);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectVisibleBroken = () => {
    setSelectedIds(new Set(visible.filter(l => isUnhealthy(l.health?.status)).map(l => l.id)));
  };

  const applyDelete = () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要删除的链接');
      return;
    }
    if (!confirm(`确定删除 ${selectedIds.size} 个无法访问/无用链接吗？`)) return;
    const next = localLinks.filter(l => !selectedIds.has(l.id));
    setLocalLinks(next);
    onUpdateLinks(next);
    setSelectedIds(new Set());
    alert(`已删除 ${selectedIds.size} 个链接`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Activity size={16} className="text-rose-600 dark:text-rose-400" />
              链接健康检测
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              批量测试网站是否可访问，标记失效链接后可一键清理。部分站点屏蔽探测，会标为未知/异常。
            </p>
          </div>
          <button
            type="button"
            onClick={runCheck}
            disabled={isChecking}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white"
          >
            <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? '检测中…' : '开始检测'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>范围</span>
          <select
            value={scope}
            onChange={e => setScope(e.target.value as Scope)}
            disabled={isChecking}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none"
          >
            <option value="all">全部链接</option>
            <option value="unchecked">仅未检测</option>
            <option value="broken">仅异常/失效</option>
            <option value="category">指定文件夹</option>
          </select>
          {scope === 'category' && (
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              disabled={isChecking}
              className="min-w-40 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none"
            >
              <option value="">选择文件夹</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>
              ))}
            </select>
          )}
          <span className="text-slate-400">将检测 {targets.length} 个</span>
        </div>

        {isChecking && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>检测进度 {progress.current}/{progress.total}</span>
              <button type="button" onClick={() => { stopRef.current = true; }} className="text-red-500 inline-flex items-center gap-1 hover:underline">
                <PauseCircle size={12} /> 停止
              </button>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2">
            <div className="text-lg font-semibold text-slate-800 dark:text-white">{scanned.length}</div>
            <div className="text-[11px] text-slate-500">已检测</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2">
            <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{okList.length}</div>
            <div className="text-[11px] text-slate-500">正常</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2">
            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">{redirectedList.length}</div>
            <div className="text-[11px] text-slate-500">跳转</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2">
            <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">{brokenList.length}</div>
            <div className="text-[11px] text-slate-500">失效/异常</div>
          </div>
        </div>
      </div>

      {scanned.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['broken', `失效 ${brokenList.length}`],
              ['redirected', `跳转 ${redirectedList.length}`],
              ['ok', `正常 ${okList.length}`],
              ['all', `全部 ${scanned.length}`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${filter === key ? 'bg-rose-600 text-white border-rose-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                {label}
              </button>
            ))}
            <button type="button" onClick={selectVisibleBroken} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              勾选当前失效
            </button>
            <button
              type="button"
              onClick={applyDelete}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> 删除勾选（{selectedIds.size}）
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-900/10 px-4 py-8 text-center">
              <Check className="mx-auto mb-2 text-emerald-600 dark:text-emerald-400" size={22} />
              <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">当前筛选下没有链接</div>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
              {visible.map(link => {
                const unhealthy = isUnhealthy(link.health?.status);
                return (
                  <div key={link.id} className={`px-3 py-2.5 flex flex-wrap items-start gap-3 ${unhealthy ? 'bg-rose-50/40 dark:bg-rose-900/10' : ''}`}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedIds.has(link.id)}
                      onChange={() => toggleSelected(link.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{link.title}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          link.health?.status === 'ok' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : link.health?.status === 'redirected' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        }`}>
                          {healthLabel(link.health?.status)}
                          {link.health?.statusCode ? ` ${link.health.statusCode}` : ''}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{link.url}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>分类：{categoryName(link.categoryId)}</span>
                        {link.health?.finalUrl && link.health.finalUrl !== link.url && (
                          <span className="truncate max-w-[16rem]">最终：{link.health.finalUrl}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="打开">
                        <ExternalLink size={14} />
                      </a>
                      {onEditLink && (
                        <button
                          type="button"
                          onClick={() => onEditLink(link)}
                          className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          编辑
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isChecking && scanned.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
          <AlertTriangle className="mx-auto mb-2 opacity-60" size={20} />
          还没有检测结果。点上方「开始检测」扫描无法访问的网站。
        </div>
      )}
    </div>
  );
};

export default LinkHealthPanel;
