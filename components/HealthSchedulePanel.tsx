import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, CheckCircle2, Save } from 'lucide-react';
import { Category, HealthScheduleConfig } from '../types';
import { DEFAULT_HEALTH_SCHEDULE, getNextHealthRun, normalizeHealthSchedule } from '../services/healthSchedule';
import { DEFAULT_HEALTH_NOTIFICATION, normalizeHealthNotification, type HealthNotificationConfig } from '../services/healthNotifications';

interface HealthRun {
  id: string;
  startedAt: number;
  finishedAt: number;
  summary: { checked: number; ok: number; broken: number; soft: number; redirected: number };
}

interface HealthSchedulePanelProps {
  categories: Category[];
}

const formatTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '尚未运行';

const HealthSchedulePanel: React.FC<HealthSchedulePanelProps> = ({ categories }) => {
  const [config, setConfig] = useState<HealthScheduleConfig>(DEFAULT_HEALTH_SCHEDULE);
  const [runs, setRuns] = useState<HealthRun[]>([]);
  const [notification, setNotification] = useState<HealthNotificationConfig>(DEFAULT_HEALTH_NOTIFICATION);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/storage?getConfig=healthSchedule').then(response => response.ok ? response.json() : null).catch(() => null),
      fetch('/api/storage?getConfig=healthRuns').then(response => response.ok ? response.json() : []).catch(() => []),
      fetch('/api/storage?getConfig=healthNotification').then(response => response.ok ? response.json() : null).catch(() => null),
    ]).then(([remoteConfig, remoteRuns, remoteNotification]) => {
      if (!active) return;
      if (remoteConfig) setConfig(normalizeHealthSchedule(remoteConfig));
      if (Array.isArray(remoteRuns)) setRuns(remoteRuns);
      if (remoteNotification) setNotification(normalizeHealthNotification(remoteNotification));
    });
    return () => { active = false; };
  }, []);

  const nextRun = useMemo(() => getNextHealthRun(config), [config]);

  const save = async () => {
    setSaving(true);
    try {
      const normalizedNotification = normalizeHealthNotification(notification);
      if (notification.enabled && !normalizedNotification.webhookUrl) {
        alert('请输入有效的公共 HTTP(S) Webhook 地址');
        return;
      }
      const [scheduleResponse, notificationResponse] = await Promise.all([
        fetch('/api/storage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saveConfig: 'healthSchedule', config }) }),
        fetch('/api/storage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saveConfig: 'healthNotification', config: normalizedNotification }) }),
      ]);
      if (!scheduleResponse.ok || !notificationResponse.ok) throw new Error('save failed');
      const data = await scheduleResponse.json();
      setConfig(normalizeHealthSchedule(data.config || config));
      setNotification(normalizedNotification);
      alert('定时健康检测设置已保存');
    } catch {
      alert('设置保存失败，请先登录后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><CalendarClock size={16} className="text-blue-600" /> 定时健康检测</div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">由 Cloudflare Cron 在后台检测，不需要打开网页。</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"><input type="checkbox" checked={config.enabled} onChange={event => setConfig(prev => ({ ...prev, enabled: event.target.checked }))} /> 启用</label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-slate-500">检测频率<select value={config.frequency} onChange={event => setConfig(prev => ({ ...prev, frequency: event.target.value as HealthScheduleConfig['frequency'] }))} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2"><option value="6h">每 6 小时</option><option value="12h">每 12 小时</option><option value="daily">每天</option><option value="weekly">每周</option></select></label>
        <label className="text-xs text-slate-500">检测范围<select value={config.scope} onChange={event => setConfig(prev => ({ ...prev, scope: event.target.value as HealthScheduleConfig['scope'] }))} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2"><option value="all">全部链接</option><option value="unchecked">仅未检测</option><option value="category">指定文件夹</option></select></label>
        <label className="text-xs text-slate-500">单次最多检测<input type="number" min={1} max={500} value={config.maxLinksPerRun} onChange={event => setConfig(prev => ({ ...prev, maxLinksPerRun: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2" /></label>
      </div>

      {config.scope === 'category' && <label className="block text-xs text-slate-500">选择文件夹<select value={config.categoryId || ''} onChange={event => setConfig(prev => ({ ...prev, categoryId: event.target.value || undefined }))} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white p-2"><option value="">请选择文件夹</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400"><div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3">上次运行：<span className="font-medium text-slate-700 dark:text-slate-200">{formatTime(config.lastRunAt)}</span></div><div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3">下次运行：<span className="font-medium text-slate-700 dark:text-slate-200">{config.enabled ? formatTime(nextRun || undefined) : '已停用'}</span></div></div>

      <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-400">立即检测仍可在下方手动执行。</p><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium"><Save size={14} /> {saving ? '保存中…' : '保存设置'}</button></div>

      <div className="rounded-xl border border-slate-200 bg-white/70 p-3 space-y-3 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="flex items-center justify-between gap-3"><div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Bell size={14} className="text-amber-500" /> 失效链接通知</div><label className="inline-flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={notification.enabled} onChange={event => setNotification(prev => ({ ...prev, enabled: event.target.checked }))} /> 启用 Webhook</label></div>
        <input value={notification.webhookUrl} onChange={event => setNotification(prev => ({ ...prev, webhookUrl: event.target.value }))} placeholder="https://你的通知服务/webhook" className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
        <label className="inline-flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={notification.onlyNewBroken} onChange={event => setNotification(prev => ({ ...prev, onlyNewBroken: event.target.checked }))} /> 仅在新增确定失效链接时通知</label>
        <p className="text-[11px] text-slate-400">通知由 Cron 后台发送；Webhook 地址会校验为公共 HTTP(S) 地址。</p>
      </div>

      {runs.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">最近运行</h4>{runs.slice(0, 3).map(run => <div key={run.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 dark:bg-slate-800/70 px-3 py-2 text-xs"><span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300"><CheckCircle2 size={13} className="text-emerald-500" />{formatTime(run.finishedAt)}</span><span className="text-slate-400">检测 {run.summary.checked} · 正常 {run.summary.ok} · 失效 {run.summary.broken}</span></div>)}</div>}
    </section>
  );
};

export default HealthSchedulePanel;
