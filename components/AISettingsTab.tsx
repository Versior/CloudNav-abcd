import React, { useState, useRef } from 'react';
import { Key, Sparkles, PauseCircle, FolderTree, Check, X } from 'lucide-react';
import { AIConfig, LinkItem, Category, INBOX_ID } from '../types';
import { generateLinkDescription, suggestCategory, testAIConnection } from '../services/geminiService';

interface AISettingsTabProps {
  config: AIConfig;
  onChange: (key: keyof AIConfig, value: string) => void;
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
}

type CategorizeScope = 'all' | 'inbox' | 'uncategorized';

interface CategoryPreviewItem {
  linkId: string;
  title: string;
  url: string;
  fromCategoryId: string;
  toCategoryId?: string;
  error?: string;
}

const AISettingsTab: React.FC<AISettingsTabProps> = ({ config, onChange, links, categories, onUpdateLinks }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [categorizeScope, setCategorizeScope] = useState<CategorizeScope>('all');
  const [categoryPreview, setCategoryPreview] = useState<CategoryPreviewItem[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());
  const [testMessage, setTestMessage] = useState('');
  const shouldStopRef = useRef(false);

  const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || '未分类';

  const handleTestConnection = async () => {
    if (!config.hasApiKey && !config.apiKey) {
      setTestMessage('请先填写 API Key，并点击底部保存更改');
      return;
    }

    setIsProcessing(true);
    setProcessingLabel('正在测试 AI 接口');
    setProgress({ current: 0, total: 1 });
    setTestMessage('');
    try {
      await testAIConnection(config);
      setProgress({ current: 1, total: 1 });
      setTestMessage('AI 接口调用成功');
    } catch (e) {
      setTestMessage(e instanceof Error ? e.message : 'AI 接口测试失败');
    } finally {
      setIsProcessing(false);
      setProcessingLabel('');
    }
  };

  const getCategorizeTargets = () => {
    const validCategoryIds = new Set(categories.map(c => c.id));
    const source = links.filter(link => !link.deletedAt);
    if (categorizeScope === 'inbox') return source.filter(link => link.categoryId === INBOX_ID);
    if (categorizeScope === 'uncategorized') return source.filter(link => !validCategoryIds.has(link.categoryId) || link.categoryId === INBOX_ID);
    return source;
  };

  const handleBulkGenerate = async () => {
    if (!config.hasApiKey && !config.apiKey) {
        alert("请先配置并保存 API Key");
        return;
    }

    const missingLinks = links.filter(l => !l.description);
    if (missingLinks.length === 0) {
        alert("所有链接都已有描述！");
        return;
    }

    if (!confirm(`发现 ${missingLinks.length} 个链接缺少描述，确定要使用 AI 自动生成吗？这可能需要一些时间。`)) return;

    setIsProcessing(true);
    setProcessingLabel('正在测试 AI 接口');
    shouldStopRef.current = false;
    setProgress({ current: 0, total: missingLinks.length });
    try {
        await testAIConnection(config);
    } catch (e) {
        setIsProcessing(false);
        setProcessingLabel('');
        alert(e instanceof Error ? `AI 接口测试失败：${e.message}` : 'AI 接口测试失败');
        return;
    }

    setProcessingLabel('正在生成描述');

    let currentLinks = [...links];
    let firstError = '';

    for (let i = 0; i < missingLinks.length; i++) {
        if (shouldStopRef.current) break;

        const link = missingLinks[i];
        try {
            const desc = await generateLinkDescription(link.title, link.url, config);
            if (desc) {
                currentLinks = currentLinks.map(l => l.id === link.id ? { ...l, description: desc } : l);
                onUpdateLinks(currentLinks);
            }
            setProgress({ current: i + 1, total: missingLinks.length });
        } catch (e) {
            const message = e instanceof Error ? e.message : '未知错误';
            firstError ||= message;
            console.error(`Failed to generate for ${link.title}`, e);
        }
    }

    setIsProcessing(false);
    setProcessingLabel('');
    if (firstError) alert(`部分描述生成失败：${firstError}`);
  };

  const handleBulkCategorize = async () => {
    if (!config.hasApiKey && !config.apiKey) {
        alert("请先配置并保存 API Key");
        return;
    }

    const availableCategories = categories
        .filter(c => c.id !== INBOX_ID && !c.password)
        .map(c => ({ id: c.id, name: c.name }));
    if (availableCategories.length === 0) {
        alert("没有可用分类");
        return;
    }

    const targetLinks = getCategorizeTargets();
    if (targetLinks.length === 0) {
        alert("没有可整理的书签");
        return;
    }

    if (!confirm(`将使用 AI 为 ${targetLinks.length} 个书签生成分类预览，不会立即修改数据。确定继续吗？`)) return;

    setIsProcessing(true);
    setProcessingLabel('正在测试 AI 接口');
    shouldStopRef.current = false;
    setProgress({ current: 0, total: targetLinks.length });
    try {
        await testAIConnection(config);
    } catch (e) {
        setIsProcessing(false);
        setProcessingLabel('');
        alert(e instanceof Error ? `AI 接口测试失败：${e.message}` : 'AI 接口测试失败');
        return;
    }

    setProcessingLabel('正在生成分类预览');
    setCategoryPreview([]);
    setSelectedPreviewIds(new Set());

    const preview: CategoryPreviewItem[] = [];

    for (let i = 0; i < targetLinks.length; i++) {
        if (shouldStopRef.current) break;

        const link = targetLinks[i];
        try {
            const categoryId = await suggestCategory(link.title, link.url, availableCategories, config);
            const isValid = categoryId && availableCategories.some(c => c.id === categoryId);
            preview.push({
                linkId: link.id,
                title: link.title,
                url: link.url,
                fromCategoryId: link.categoryId,
                toCategoryId: isValid ? categoryId : undefined,
                error: isValid ? undefined : 'AI 未返回可用分类',
            });
        } catch (e) {
            preview.push({
                linkId: link.id,
                title: link.title,
                url: link.url,
                fromCategoryId: link.categoryId,
                error: e instanceof Error ? e.message : '未知错误',
            });
        }
        setProgress({ current: i + 1, total: targetLinks.length });
    }

    const changedIds = new Set(preview.filter(item => item.toCategoryId && item.toCategoryId !== item.fromCategoryId).map(item => item.linkId));
    setCategoryPreview(preview);
    setSelectedPreviewIds(changedIds);
    setIsProcessing(false);
    setProcessingLabel('');
  };

  const applyCategoryPreview = () => {
    const selected = categoryPreview.filter(item => selectedPreviewIds.has(item.linkId) && item.toCategoryId && item.toCategoryId !== item.fromCategoryId);
    if (selected.length === 0) {
      alert('没有可应用的分类变更');
      return;
    }
    const targetById = new Map(selected.map(item => [item.linkId, item.toCategoryId!]));
    const nextLinks = links.map(link => targetById.has(link.id) ? { ...link, categoryId: targetById.get(link.id)!, updatedAt: Date.now() } : link);
    onUpdateLinks(nextLinks);
    setCategoryPreview([]);
    setSelectedPreviewIds(new Set());
    alert(`已应用 ${selected.length} 个分类变更`);
  };

  const togglePreviewSelection = (id: string) => {
    setSelectedPreviewIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI 提供商</label>
            <select
                value={config.provider}
                onChange={(e) => onChange('provider', e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI Compatible (ChatGPT, DeepSeek, Claude...)</option>
            </select>
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key</label>
            <div className="relative">
                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => onChange('apiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full pl-10 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
            </div>
            <p className="text-xs text-slate-500 mt-1">Key 仅存储在当前浏览器，不会同步到 Cloudflare KV 或 WebDAV 备份。</p>
        </div>

        {config.provider === 'openai' && (
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base URL (API 地址)</label>
                <input
                    type="text"
                    value={config.baseUrl}
                    onChange={(e) => onChange('baseUrl', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">必须是 API 地址，例如 https://api.openai.com/v1；不要填网页登录地址或控制台地址。</p>
            </div>
        )}

        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">模型名称 (Model Name)</label>
            <input
                type="text"
                value={config.model}
                onChange={(e) => onChange('model', e.target.value)}
                placeholder={config.provider === 'gemini' ? "gemini-2.5-flash" : "gpt-3.5-turbo"}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">接口自检</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">保存配置后测试，能提前发现网页地址、模型名和密钥问题。</div>
                </div>
                <button
                    onClick={handleTestConnection}
                    disabled={isProcessing}
                    className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
                >
                    测试 AI 接口
                </button>
            </div>
            {testMessage && (
                <div className={`mt-2 text-xs ${testMessage.includes('成功') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{testMessage}</div>
            )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <h4 className="text-sm font-semibold mb-2 dark:text-slate-200">批量操作</h4>
            {isProcessing ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>{processingLabel || '正在处理'}... ({progress.current}/{progress.total})</span>
                        <button onClick={() => { shouldStopRef.current = true; }} className="text-red-500 flex items-center gap-1 hover:underline">
                            <PauseCircle size={12}/> 停止
                        </button>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}></div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleBulkGenerate}
                            className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-2 rounded-lg transition-colors border border-purple-200 dark:border-purple-800"
                        >
                            <Sparkles size={16} /> 一键补全所有缺失的描述
                        </button>
                        <button
                            onClick={handleBulkCategorize}
                            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-2 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                        >
                            <FolderTree size={16} /> 生成 AI 分类预览
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>整理范围</span>
                        <select value={categorizeScope} onChange={(e) => setCategorizeScope(e.target.value as CategorizeScope)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none">
                            <option value="all">全部书签</option>
                            <option value="inbox">待整理</option>
                            <option value="uncategorized">未分类 / 待整理</option>
                        </select>
                    </div>
                </div>
            )}
        </div>

        {categoryPreview.length > 0 && !isProcessing && (
          <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI 分类预览</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">只会应用勾选且分类发生变化的条目。</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedPreviewIds(new Set(categoryPreview.filter(item => item.toCategoryId && item.toCategoryId !== item.fromCategoryId).map(item => item.linkId)))} className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">全选变更</button>
                <button onClick={() => setCategoryPreview([])} className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1"><X size={12} /> 关闭</button>
                <button onClick={applyCategoryPreview} className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"><Check size={12} /> 应用勾选</button>
              </div>
            </div>
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
              {categoryPreview.map(item => {
                const changed = item.toCategoryId && item.toCategoryId !== item.fromCategoryId;
                return (
                  <label key={item.linkId} className="grid grid-cols-[auto,1fr,120px,120px] gap-3 items-center px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <input type="checkbox" disabled={!changed} checked={selectedPreviewIds.has(item.linkId)} onChange={() => togglePreviewSelection(item.linkId)} />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{item.title}</div>
                      <div className="text-slate-400 truncate">{item.error || item.url}</div>
                    </div>
                    <span className="truncate text-slate-500 dark:text-slate-400">{getCategoryName(item.fromCategoryId)}</span>
                    <span className={changed ? 'truncate text-blue-600 dark:text-blue-300 font-medium' : 'truncate text-slate-400'}>{item.toCategoryId ? getCategoryName(item.toCategoryId) : '失败'}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
};

export default AISettingsTab;
