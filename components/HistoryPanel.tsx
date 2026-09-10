import React, { useEffect, useState } from 'react';
import { Clock3, RotateCcw } from 'lucide-react';
import { HistorySnapshotMeta, LinkItem, Category } from '../types';

interface HistoryPanelProps {
  onRestore: (links: LinkItem[], categories: Category[], version?: number) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onRestore }) => {
  const [history, setHistory] = useState<HistorySnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/storage?getConfig=history');
      if (response.ok) setHistory(await response.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadHistory(); }, []);

  const restore = async (entry: HistorySnapshotMeta) => {
    if (!confirm(`确定恢复到 v${entry.version} 吗？当前数据会先自动保存为新历史版本。`)) return;
    setRestoring(entry.id);
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreHistory: entry.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.data?.links) throw new Error('restore failed');
      onRestore(result.data.links, result.data.categories || [], result.data.version);
      await loadHistory();
      alert(`已恢复到 v${entry.version}`);
    } catch {
      alert('历史版本恢复失败，请稍后重试');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><Clock3 size={16} className="text-purple-600" /> 数据历史</div>
      <p className="text-xs text-slate-500">每次云端保存前会自动生成快照，最多保留 30 个版本。</p>
      {loading ? <div className="text-xs text-slate-400">正在加载历史…</div> : history.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-700/30 p-3 text-xs text-slate-500">暂无历史版本。下一次保存数据后会自动生成。</div> : <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700">{history.map(entry => <div key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"><div><div className="font-medium text-slate-700 dark:text-slate-200">v{entry.version} · {new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })}</div><div className="text-slate-400 mt-0.5">{entry.linkCount} 个链接 · {entry.categoryCount} 个文件夹</div></div><button onClick={() => restore(entry)} disabled={restoring !== null} className="inline-flex items-center gap-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1.5 text-purple-700 dark:text-purple-300 hover:bg-purple-200 disabled:opacity-50"><RotateCcw size={13} />{restoring === entry.id ? '恢复中' : '恢复'}</button></div>)}</div>}
    </section>
  );
};

export default HistoryPanel;
