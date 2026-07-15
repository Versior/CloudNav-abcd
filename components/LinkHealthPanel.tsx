import React, { useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Check, CheckCircle2, ExternalLink, PauseCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Category, LinkItem } from '../types';
import {
  checkLinkHealth,
  healthLabel,
  healthReasonFromCode,
  isHardBroken,
  isSoftIssue,
  makeCorrectedOkHealth,
  needsHealthCorrection,
} from '../services/linkHealthService';

interface LinkHealthPanelProps {
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  onEditLink?: (link: LinkItem) => void;
}

type Scope = 'all' | 'unchecked' | 'broken' | 'category';
type Filter = 'broken' | 'soft' | 'redirected' | 'ok' | 'all';

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
  const [filter, setFilter] = useState<Filter>('broken');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const stopRef = useRef(false);

  React.useEffect(() => {
    if (!isChecking) setLocalLinks(links);
  }, [links, isChecking]);

  const categoryName = (id: string) => categories.find(c => c.id === id)?.name || '未分类';

  const targets = useMemo(() => {
    const active = localLinks.filter(l => !l.deletedAt);
    if (scope === 'unchecked') return active.filter(l => !l.health?.checkedAt);
    if (scope === 'broken') return active.filter(l => isHardBroken(l.health) || isSoftIssue(l.health) || l.health?.status === 'redirected');
    if (scope === 'category') return active.filter(l => l.categoryId === categoryId);
    return active;
  }, [localLinks, scope, categoryId]);

  const scanned = useMemo(
    () => localLinks.filter(l => !l.deletedAt && l.health?.checkedAt),
    [localLinks]
  );

  const brokenList = useMemo(() => scanned.filter(l => isHardBroken(l.health)), [scanned]);
  const softList = useMemo(() => scanned.filter(l => isSoftIssue(l.health) && !isHardBroken(l.health)), [scanned]);
  const redirectedList = useMemo(() => scanned.filter(l => l.health?.status === 'redirected'), [scanned]);
  const okList = useMemo(() => scanned.filter(l => l.health?.status === 'ok'), [scanned]);

  const visible = useMemo(() => {
    const list =
      filter === 'broken' ? brokenList
      : filter === 'soft' ? softList
      : filter === 'redirected' ? redirectedList
      : filter === 'ok' ? okList
      : scanned;
    return [...list].sort((a, b) => (b.health?.checkedAt || 0) - (a.health?.checkedAt || 0));
  }, [filter, brokenList, softList, redirectedList, okList, scanned]);

  const runCheck = async () => {
    if (targets.length === 0) {
      alert('没有可检测的链接');
      return;
    }
    if (!confirm(`将检测 ${targets.length} 个链接的可访问性。\n说明：部分站点会拦截服务器探测，可能显示“探测受阻/待确认”，这不等于失效。\n确定继续吗？`)) return;

    setIsChecking(true);
    stopRef.current = false;
    setProgress({ current: 0, total: targets.length });

    let working = [...localLinks];
    let nextIndex = 0;
    let completed = 0;
    const workerCount = Math.min(2, targets.length);
    const selectedBroken = new Set<string>();
    const nextReasons: Record<string, string> = { ...reasons };

    const worker = async () => {
      while (!stopRef.current && nextIndex < targets.length) {
        const link = targets[nextIndex++];
        try {
          const result = await checkLinkHealth(link.url);
          const status = result.status === 'invalid' ? 'unknown' : result.status;
          working = working.map(item =>
            item.id === link.id
              ? {
                  ...item,
                  health: {
                    status,
                    statusCode: result.statusCode,
                    finalUrl: result.finalUrl,
                    checkedAt: result.checkedAt,
                  },
                  updatedAt: Date.now(),
                }
              : item
          );
          nextReasons[link.id] = healthReasonFromCode(status, result.statusCode, result.reason || result.error);
          // Only auto-select hard dead links for deletion
          if (status === 'broken' || result.statusCode === 404 || result.statusCode === 410) {
            selectedBroken.add(link.id);
          }
        } catch {
          working = working.map(item =>
            item.id === link.id
              ? {
                  ...item,
                  health: {
                    status: 'unknown',
                    statusCode: 0,
                    checkedAt: Date.now(),
                  },
                  updatedAt: Date.now(),
                }
              : item
          );
          nextReasons[link.id] = '探测异常，浏览器可能仍可打开';
        } finally {
          completed += 1;
          setProgress({ current: completed, total: targets.length });
          if (completed % 4 === 0 || completed === targets.length) {
            setLocalLinks([...working]);
            setReasons({ ...nextReasons });
            onUpdateLinks(working);
          }
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    setLocalLinks(working);
    setReasons(nextReasons);
    onUpdateLinks(working);
    setSelectedIds(selectedBroken);
    setFilter(selectedBroken.size > 0 ? 'broken' : softList.length > 0 ? 'soft' : 'all');
    setIsChecking(false);

    const hard = working.filter(l => isHardBroken(l.health)).length;
    const soft = working.filter(l => isSoftIssue(l.health) && !isHardBroken(l.health)).length;
    alert(`检测完成。\n确定失效：${hard} 个（可清理）\n探测受阻/待确认：${soft} 个（不建议直接删除）`);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectVisibleHardBroken = () => {
    setSelectedIds(new Set(visible.filter(l => isHardBroken(l.health)).map(l => l.id)));
  };

  const applyDelete = () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要删除的链接');
      return;
    }
    const softSelected = [...selectedIds].filter(id => {
      const link = localLinks.find(l => l.id === id);
      return link && isSoftIssue(link.health) && !isHardBroken(link.health);
    });
    if (softSelected.length > 0) {
      if (!confirm(`勾选中有 ${softSelected.length} 个只是“探测受阻/待确认”，浏览器里可能仍可打开。\n仍要删除全部 ${selectedIds.size} 个吗？`)) return;
    } else if (!confirm(`确定删除 ${selectedIds.size} 个失效链接吗？`)) {
      return;
    }
    const count = selectedIds.size;
    const next = localLinks.filter(l => !selectedIds.has(l.id));
    setLocalLinks(next);
    onUpdateLinks(next);
    setSelectedIds(new Set());
    alert(`已删除 ${count} 个链接`);
  };

  const correctLinksToOk = (ids: string[], silent = false) => {
    if (ids.length === 0) {
      if (!silent) alert('请先勾选要纠正的链接');
      return;
    }
    const idSet = new Set(ids);
    const nextReasons = { ...reasons };
    const next = localLinks.map(link => {
      if (!idSet.has(link.id)) return link;
      nextReasons[link.id] = '已人工纠正为正常';
      return {
        ...link,
        health: makeCorrectedOkHealth(link.url),
        updatedAt: Date.now(),
      };
    });
    setLocalLinks(next);
    setReasons(nextReasons);
    onUpdateLinks(next);
    setSelectedIds(prev => {
      const remain = new Set(prev);
      ids.forEach(id => remain.delete(id));
      return remain;
    });
    if (!silent) alert(`已纠正 ${ids.length} 个链接为正常`);
  };

  const correctSelectedToOk = () => {
    const ids = [...selectedIds].filter(id => {
      const link = localLinks.find(l => l.id === id);
      return link && needsHealthCorrection(link.health);
    });
    if (ids.length === 0) {
      alert('请勾选失效/探测受阻/跳转的链接后再纠正');
      return;
    }
    if (!confirm(`将把 ${ids.length} 个链接标记为「正常」（人工确认可访问）。确定吗？`)) return;
    correctLinksToOk(ids);
  };

  const correctOneToOk = (linkId: string) => {
    correctLinksToOk([linkId], true);
  };

  const recheckOne = async (link: LinkItem) => {
    try {
      const result = await checkLinkHealth(link.url);
      const status = result.status === 'invalid' ? 'unknown' : result.status;
      const next = localLinks.map(item =>
        item.id === link.id
          ? {
              ...item,
              health: {
                status,
                statusCode: result.statusCode,
                finalUrl: result.finalUrl,
                checkedAt: result.checkedAt,
              },
              updatedAt: Date.now(),
            }
          : item
      );
      setLocalLinks(next);
      setReasons(prev => ({
        ...prev,
        [link.id]: healthReasonFromCode(status, result.statusCode, result.reason || result.error),
      }));
      onUpdateLinks(next);
    } catch {
      alert('重新检测失败，请稍后再试');
    }
  };

  const badgeClass = (link: LinkItem) => {
    if (isHardBroken(link.health)) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    if (link.health?.status === 'redirected') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (link.health?.status === 'ok') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
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
              只有 404/410 等会标为「确定失效」。403/防爬/超时标为「探测受阻」。浏览器能打开的可用「纠正为正常」。
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
            <option value="broken">仅异常项</option>
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
            <div className="text-lg font-semibold text-slate-600 dark:text-slate-300">{softList.length}</div>
            <div className="text-[11px] text-slate-500">探测受阻</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2">
            <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">{brokenList.length}</div>
            <div className="text-[11px] text-slate-500">确定失效</div>
          </div>
        </div>
      </div>

      {scanned.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['broken', `确定失效 ${brokenList.length}`],
              ['soft', `探测受阻 ${softList.length}`],
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
            <button type="button" onClick={selectVisibleHardBroken} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              只勾选确定失效
            </button>
            <button
              type="button"
              onClick={correctSelectedToOk}
              className="px-3 py-1.5 text-xs rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1"
            >
              <CheckCircle2 size={12} /> 纠正勾选为正常
            </button>
            <button
              type="button"
              onClick={applyDelete}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> 删除勾选（{selectedIds.size}）
            </button>
          </div>

          {filter === 'soft' && (
            <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 flex gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              这些链接多半只是拦了服务器探测（防爬/登录墙/超时），请先点“打开”人工确认，别直接清空。
            </div>
          )}

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-900/10 px-4 py-8 text-center">
              <Check className="mx-auto mb-2 text-emerald-600 dark:text-emerald-400" size={22} />
              <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">当前筛选下没有链接</div>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
              {visible.map(link => {
                const hard = isHardBroken(link.health);
                const reason = reasons[link.id] || healthReasonFromCode(link.health?.status, link.health?.statusCode);
                return (
                  <div key={link.id} className={`px-3 py-2.5 flex flex-wrap items-start gap-3 ${hard ? 'bg-rose-50/40 dark:bg-rose-900/10' : ''}`}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedIds.has(link.id)}
                      onChange={() => toggleSelected(link.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{link.title}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeClass(link)}`}>
                          {healthLabel(link.health?.status, link.health?.statusCode)}
                          {link.health?.statusCode ? ` ${link.health.statusCode}` : ''}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{link.url}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>分类：{categoryName(link.categoryId)}</span>
                        {reason && <span className="text-slate-400">{reason}</span>}
                        {link.health?.finalUrl && link.health.finalUrl !== link.url && (
                          <span className="truncate max-w-[16rem]">最终：{link.health.finalUrl}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="打开验证">
                        <ExternalLink size={14} />
                      </a>
                      {needsHealthCorrection(link.health) && (
                        <button
                          type="button"
                          onClick={() => correctOneToOk(link.id)}
                          className="px-2 py-1 text-[11px] rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          title="人工确认可访问，标记为正常"
                        >
                          纠正
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => recheckOne(link)}
                        className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        title="重新检测"
                      >
                        重测
                      </button>
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
          还没有检测结果。点上方「开始检测」。只有“确定失效”才适合批量清理。
        </div>
      )}
    </div>
  );
};

export default LinkHealthPanel;
