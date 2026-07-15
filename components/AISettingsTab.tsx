import React, { useEffect, useState, useRef } from 'react';
import { Key, Sparkles, PauseCircle, FolderTree, Check, X, Type, FolderPlus } from 'lucide-react';
import { AIConfig, LinkItem, Category, INBOX_ID } from '../types';
import {
  generateLinkDescription,
  suggestCategory,
  testAIConnection,
  suggestFolderRename,
  suggestFolderStructure,
} from '../services/geminiService';
import { normalizeOpenAIEndpoint } from '../services/openaiEndpoint';

interface AISettingsTabProps {
  config: AIConfig;
  onChange: (key: keyof AIConfig, value: string) => void;
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  onUpdateCategories?: (categories: Category[]) => void;
  onUpdateData?: (links: LinkItem[], categories: Category[]) => void;
  initialCategoryId?: string;
  initialAIAction?: 'organize' | 'rename' | 'structure';
}

type CategorizeScope = 'all' | 'inbox' | 'uncategorized' | 'category';
type RenameScope = 'all' | 'top' | 'category';

type AIPreset = {
  id: string;
  label: string;
  provider: AIConfig['provider'];
  baseUrl: string;
  model: string;
  hint: string;
};

const AI_PRESETS: AIPreset[] = [
  { id: 'gemini', label: 'Gemini', provider: 'gemini', baseUrl: '', model: 'gemini-2.5-flash', hint: 'Google Gemini 官方接口' },
  { id: 'deepseek', label: 'DeepSeek', provider: 'openai', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', hint: '国内常用，分类速度快' },
  { id: 'openrouter', label: 'OpenRouter', provider: 'openai', baseUrl: 'https://openrouter.ai', model: 'openai/gpt-4o-mini', hint: '多模型聚合接口' },
  { id: 'openai', label: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hint: 'OpenAI 官方接口' },
  { id: 'siliconflow', label: '硅基流动', provider: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', hint: 'OpenAI 兼容接口' },
  { id: 'moonshot', label: 'Moonshot', provider: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', hint: 'Kimi 开放平台' },
];

interface CategoryPreviewItem {
  linkId: string;
  title: string;
  url: string;
  fromCategoryId: string;
  toCategoryId?: string;
  error?: string;
}

interface FolderRenamePreviewItem {
  categoryId: string;
  fromName: string;
  toName?: string;
  sampleCount: number;
  error?: string;
}

interface StructureFolderDraft {
  tempId: string;
  name: string;
  linkIds: string[];
  reason?: string;
  selected: boolean;
}

interface StructurePreview {
  parentId: string;
  parentName: string;
  renameParent?: string;
  renameParentSelected: boolean;
  reason?: string;
  folders: StructureFolderDraft[];
  keepInParent: string[];
}

const makeId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const AISettingsTab: React.FC<AISettingsTabProps> = ({
  config,
  onChange,
  links,
  categories,
  onUpdateLinks,
  onUpdateCategories,
  onUpdateData,
  initialCategoryId,
  initialAIAction,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [categorizeScope, setCategorizeScope] = useState<CategorizeScope>('all');
  const [categorizeCategoryId, setCategorizeCategoryId] = useState('');
  const [includeSubCategories, setIncludeSubCategories] = useState(true);
  const [categoryPreview, setCategoryPreview] = useState<CategoryPreviewItem[]>([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());
  const [renameScope, setRenameScope] = useState<RenameScope>('all');
  const [renameCategoryId, setRenameCategoryId] = useState('');
  const [renamePreview, setRenamePreview] = useState<FolderRenamePreviewItem[]>([]);
  const [selectedRenameIds, setSelectedRenameIds] = useState<Set<string>>(new Set());
  const [structureCategoryId, setStructureCategoryId] = useState('');
  const [structurePreview, setStructurePreview] = useState<StructurePreview | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const shouldStopRef = useRef(false);

  const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || '未分类';

  const applyPreset = (preset: AIPreset) => {
    onChange('provider', preset.provider);
    onChange('baseUrl', preset.baseUrl);
    onChange('model', preset.model);
    setTestMessage(`已套用 ${preset.label} 预设，请确认 API Key 后保存`);
  };

  useEffect(() => {
    if (!initialCategoryId) return;
    setCategorizeScope('category');
    setCategorizeCategoryId(initialCategoryId);
    setIncludeSubCategories(true);
    setRenameScope('category');
    setRenameCategoryId(initialCategoryId);
    setStructureCategoryId(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    if (!initialAIAction || !initialCategoryId) return;
    // keep scopes aligned when opened from context menu action
    if (initialAIAction === 'rename') {
      setRenameScope('category');
      setRenameCategoryId(initialCategoryId);
    }
    if (initialAIAction === 'structure') {
      setStructureCategoryId(initialCategoryId);
    }
  }, [initialAIAction, initialCategoryId]);

  const finalOpenAIEndpoint = (() => {
    if (config.provider !== 'openai' || !config.baseUrl.trim()) return '';
    try {
      return normalizeOpenAIEndpoint(config.baseUrl);
    } catch (e) {
      return e instanceof Error ? e.message : 'API 地址无效';
    }
  })();

  const ensureApiReady = async (label: string) => {
    if (!config.hasApiKey && !config.apiKey) {
      alert('请先配置并保存 API Key');
      return false;
    }
    setIsProcessing(true);
    setProcessingLabel('正在测试 AI 接口');
    shouldStopRef.current = false;
    setProgress({ current: 0, total: 1 });
    try {
      await testAIConnection(config);
      setProcessingLabel(label);
      return true;
    } catch (e) {
      setIsProcessing(false);
      setProcessingLabel('');
      alert(e instanceof Error ? `AI 接口测试失败：${e.message}` : 'AI 接口测试失败');
      return false;
    }
  };

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
    if (categorizeScope === 'category') {
      if (!categorizeCategoryId) return [];
      const childIds = includeSubCategories ? categories.filter(c => c.parentId === categorizeCategoryId).map(c => c.id) : [];
      const ids = new Set([categorizeCategoryId, ...childIds]);
      return source.filter(link => ids.has(link.categoryId));
    }
    return source;
  };

  const getRenameTargets = () => {
    const editable = categories.filter(c => c.id !== INBOX_ID && c.id !== 'common' && !c.password);
    if (renameScope === 'top') return editable.filter(c => !c.parentId);
    if (renameScope === 'category') {
      if (!renameCategoryId) return [];
      return editable.filter(c => c.id === renameCategoryId);
    }
    return editable;
  };

  const buildFolderSamples = (categoryId: string) => {
    const childIds = categories.filter(c => c.parentId === categoryId).map(c => c.id);
    const ids = new Set([categoryId, ...childIds]);
    return links
      .filter(l => !l.deletedAt && ids.has(l.categoryId))
      .slice(0, 12)
      .map(l => `${l.title} (${l.url})`);
  };

  const runCategorizePreview = async (targetLinks: LinkItem[], availableCategories: Array<Pick<Category, 'id' | 'name'>>) => {
    const preview: CategoryPreviewItem[] = [];
    let nextIndex = 0;
    let completed = 0;
    const workerCount = Math.min(4, targetLinks.length);

    const worker = async () => {
      while (!shouldStopRef.current && nextIndex < targetLinks.length) {
        const link = targetLinks[nextIndex++];
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
        } finally {
          completed += 1;
          setProgress({ current: completed, total: targetLinks.length });
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return preview;
  };

  const isInvalidDescription = (description?: string) => !description || description.trim() === '生成描述失败';

  const handleBulkGenerate = async () => {
    if (!(await ensureApiReady('正在生成描述'))) return;

    const missingLinks = links.filter(l => isInvalidDescription(l.description));
    if (missingLinks.length === 0) {
      setIsProcessing(false);
      setProcessingLabel('');
      alert('所有链接都已有描述！');
      return;
    }

    if (!confirm(`发现 ${missingLinks.length} 个链接缺少描述，确定要使用 AI 自动生成吗？这可能需要一些时间。`)) {
      setIsProcessing(false);
      setProcessingLabel('');
      return;
    }

    setProgress({ current: 0, total: missingLinks.length });
    setProcessingLabel('正在生成描述');

    let currentLinks = [...links];
    let firstError = '';
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < missingLinks.length; i++) {
      if (shouldStopRef.current) break;

      const link = missingLinks[i];
      try {
        const desc = await generateLinkDescription(link.title, link.url, config);
        if (!isInvalidDescription(desc)) {
          successCount += 1;
          currentLinks = currentLinks.map(l => l.id === link.id ? { ...l, description: desc } : l);
          onUpdateLinks(currentLinks);
        } else {
          failedCount += 1;
          firstError ||= 'AI 未返回有效描述';
        }
        setProgress({ current: i + 1, total: missingLinks.length });
      } catch (e) {
        failedCount += 1;
        const message = e instanceof Error ? e.message : '未知错误';
        firstError ||= message;
        console.error(`Failed to generate for ${link.title}`, e);
        setProgress({ current: i + 1, total: missingLinks.length });
      }
    }

    setIsProcessing(false);
    setProcessingLabel('');
    if (firstError) alert(`描述生成完成：成功 ${successCount} 个，失败 ${failedCount} 个。首个失败原因：${firstError}`);
  };

  const handleBulkCategorize = async () => {
    const availableCategories = categories
      .filter(c => c.id !== INBOX_ID && !c.password)
      .map(c => ({ id: c.id, name: c.name }));
    if (availableCategories.length === 0) {
      alert('没有可用分类');
      return;
    }

    const targetLinks = getCategorizeTargets();
    if (targetLinks.length === 0) {
      alert('没有可整理的书签');
      return;
    }

    const scopeLabel = categorizeScope === 'category'
      ? `文件夹「${getCategoryName(categorizeCategoryId)}」${includeSubCategories ? '及子文件夹' : ''}`
      : categorizeScope === 'inbox'
        ? '待整理'
        : categorizeScope === 'uncategorized'
          ? '未分类 / 待整理'
          : '全部书签';

    if (!confirm(`将使用 AI 为 ${scopeLabel} 中的 ${targetLinks.length} 个书签生成分类预览，会并发处理以加快速度，不会立即修改数据。确定继续吗？`)) return;
    if (!(await ensureApiReady('正在生成分类预览'))) return;

    setProgress({ current: 0, total: targetLinks.length });
    setCategoryPreview([]);
    setSelectedPreviewIds(new Set());

    const preview = await runCategorizePreview(targetLinks, availableCategories);

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

  const handleBulkRenameFolders = async () => {
    const targets = getRenameTargets();
    if (targets.length === 0) {
      alert('没有可重命名的文件夹');
      return;
    }

    const scopeLabel = renameScope === 'category'
      ? `文件夹「${getCategoryName(renameCategoryId)}」`
      : renameScope === 'top'
        ? '全部顶级文件夹'
        : '全部文件夹';

    if (!confirm(`将为 ${scopeLabel} 共 ${targets.length} 个文件夹生成 AI 重命名预览，不会立即修改。确定继续吗？`)) return;
    if (!(await ensureApiReady('正在生成文件夹重命名预览'))) return;

    setProgress({ current: 0, total: targets.length });
    setRenamePreview([]);
    setSelectedRenameIds(new Set());

    const preview: FolderRenamePreviewItem[] = [];
    let nextIndex = 0;
    let completed = 0;
    const workerCount = Math.min(3, targets.length);

    const worker = async () => {
      while (!shouldStopRef.current && nextIndex < targets.length) {
        const category = targets[nextIndex++];
        const samples = buildFolderSamples(category.id);
        try {
          if (samples.length === 0) {
            preview.push({
              categoryId: category.id,
              fromName: category.name,
              sampleCount: 0,
              error: '该文件夹下没有书签样本',
            });
          } else {
            const suggestion = await suggestFolderRename(category.name, samples, config);
            const toName = suggestion.name;
            preview.push({
              categoryId: category.id,
              fromName: category.name,
              toName,
              sampleCount: samples.length,
              error: !toName || toName === category.name ? '建议保持原名' : undefined,
            });
          }
        } catch (e) {
          preview.push({
            categoryId: category.id,
            fromName: category.name,
            sampleCount: samples.length,
            error: e instanceof Error ? e.message : '未知错误',
          });
        } finally {
          completed += 1;
          setProgress({ current: completed, total: targets.length });
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const changedIds = new Set(
      preview
        .filter(item => item.toName && item.toName !== item.fromName && !item.error)
        .map(item => item.categoryId)
    );
    // also allow selecting "建议保持原名" only if name actually differs due to cleanup edge cases
    preview.forEach(item => {
      if (item.toName && item.toName !== item.fromName) changedIds.add(item.categoryId);
    });
    setRenamePreview(preview);
    setSelectedRenameIds(changedIds);
    setIsProcessing(false);
    setProcessingLabel('');
  };

  const applyRenamePreview = () => {
    if (!onUpdateCategories && !onUpdateData) {
      alert('当前环境不支持更新分类');
      return;
    }
    const selected = renamePreview.filter(item =>
      selectedRenameIds.has(item.categoryId) &&
      item.toName &&
      item.toName !== item.fromName
    );
    if (selected.length === 0) {
      alert('没有可应用的重命名变更');
      return;
    }

    const nameById = new Map(selected.map(item => [item.categoryId, item.toName!]));
    const nextCategories = categories.map(cat =>
      nameById.has(cat.id) ? { ...cat, name: nameById.get(cat.id)! } : cat
    );

    if (onUpdateData) onUpdateData(links, nextCategories);
    else onUpdateCategories?.(nextCategories);

    setRenamePreview([]);
    setSelectedRenameIds(new Set());
    alert(`已重命名 ${selected.length} 个文件夹`);
  };

  const handleSuggestStructure = async () => {
    if (!structureCategoryId) {
      alert('请先选择要拆分的文件夹');
      return;
    }
    const parent = categories.find(c => c.id === structureCategoryId);
    if (!parent) {
      alert('文件夹不存在');
      return;
    }
    if (parent.id === INBOX_ID) {
      alert('待整理不支持直接拆分，请先选择具体分类');
      return;
    }

    const parentLinks = links.filter(l => !l.deletedAt && l.categoryId === parent.id);
    if (parentLinks.length < 2) {
      alert('该文件夹至少需要 2 个书签才能建议子文件夹');
      return;
    }

    if (!confirm(`将分析「${parent.name}」下 ${parentLinks.length} 个书签，生成子文件夹拆分预览，不会立即修改。确定继续吗？`)) return;
    if (!(await ensureApiReady('正在生成子文件夹建议'))) return;

    setProgress({ current: 0, total: 1 });
    setStructurePreview(null);

    try {
      const existingNames = categories
        .filter(c => c.id !== parent.id)
        .map(c => c.name);
      const suggestion = await suggestFolderStructure(
        parent.name,
        parentLinks.map(l => ({ id: l.id, title: l.title, url: l.url, description: l.description })),
        existingNames,
        config
      );
      setProgress({ current: 1, total: 1 });

      const folders: StructureFolderDraft[] = suggestion.folders.map(folder => ({
        tempId: makeId('new-folder'),
        name: folder.name,
        linkIds: folder.linkIds,
        reason: folder.reason,
        selected: true,
      }));

      setStructurePreview({
        parentId: parent.id,
        parentName: parent.name,
        renameParent: suggestion.rename && suggestion.rename !== parent.name ? suggestion.rename : undefined,
        renameParentSelected: Boolean(suggestion.rename && suggestion.rename !== parent.name),
        reason: suggestion.reason,
        folders,
        keepInParent: suggestion.keepInParent,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : '生成子文件夹建议失败');
    } finally {
      setIsProcessing(false);
      setProcessingLabel('');
    }
  };

  const applyStructurePreview = () => {
    if (!structurePreview) return;
    if (!onUpdateData && !(onUpdateCategories && onUpdateLinks)) {
      alert('当前环境不支持同时更新分类和书签');
      return;
    }

    const selectedFolders = structurePreview.folders.filter(f => f.selected && f.name.trim() && f.linkIds.length > 0);
    const shouldRenameParent = structurePreview.renameParentSelected && structurePreview.renameParent;

    if (selectedFolders.length === 0 && !shouldRenameParent) {
      alert('请至少勾选一个新建文件夹，或勾选父文件夹重命名');
      return;
    }

    let nextCategories = [...categories];
    if (shouldRenameParent) {
      nextCategories = nextCategories.map(c =>
        c.id === structurePreview.parentId ? { ...c, name: structurePreview.renameParent! } : c
      );
    }

    const created: Category[] = selectedFolders.map(folder => ({
      id: folder.tempId,
      name: folder.name.trim(),
      icon: 'Folder',
      parentId: structurePreview.parentId,
      color: categories.find(c => c.id === structurePreview.parentId)?.color,
    }));
    nextCategories = [...nextCategories, ...created];

    const moveMap = new Map<string, string>();
    selectedFolders.forEach(folder => {
      folder.linkIds.forEach(linkId => moveMap.set(linkId, folder.tempId));
    });

    const nextLinks = links.map(link =>
      moveMap.has(link.id)
        ? { ...link, categoryId: moveMap.get(link.id)!, updatedAt: Date.now() }
        : link
    );

    if (onUpdateData) onUpdateData(nextLinks, nextCategories);
    else {
      onUpdateCategories?.(nextCategories);
      onUpdateLinks(nextLinks);
    }

    setStructurePreview(null);
    alert(`已应用：新建 ${selectedFolders.length} 个子文件夹${shouldRenameParent ? '，并重命名父文件夹' : ''}`);
  };

  const togglePreviewSelection = (id: string) => {
    setSelectedPreviewIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRenameSelection = (id: string) => {
    setSelectedRenameIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const editableCategories = categories.filter(c => c.id !== INBOX_ID);

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

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/60">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">常用配置预设</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AI_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${config.provider === preset.provider && config.baseUrl === preset.baseUrl && config.model === preset.model ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
            >
              <div className="text-sm font-medium text-slate-700 dark:text-slate-100">{preset.label}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{preset.hint}</div>
            </button>
          ))}
        </div>
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
          {finalOpenAIEndpoint && (
            <div className={`mt-2 text-xs rounded-lg p-2 ${finalOpenAIEndpoint.startsWith('http') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'}`}>
              最终请求地址：{finalOpenAIEndpoint}
            </div>
          )}
          <div className="mt-2 grid gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>OpenAI：<code>https://api.openai.com/v1</code></span>
            <span>OpenRouter：<code>https://openrouter.ai</code></span>
            <span>DeepSeek：<code>https://api.deepseek.com</code></span>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">模型名称 (Model Name)</label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder={config.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-3.5-turbo'}
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold dark:text-slate-200">批量操作</h4>
          {categorizeScope === 'category' && categorizeCategoryId && (
            <span className="text-xs rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1">
              当前范围：{getCategoryName(categorizeCategoryId)}{includeSubCategories ? '及子文件夹' : ''}
            </span>
          )}
        </div>
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
          <div className="space-y-4">
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
              <button
                onClick={handleBulkRenameFolders}
                className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-3 py-2 rounded-lg transition-colors border border-amber-200 dark:border-amber-800"
              >
                <Type size={16} /> AI 重命名文件夹
              </button>
              <button
                onClick={handleSuggestStructure}
                className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 py-2 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
              >
                <FolderPlus size={16} /> 按内容拆分子文件夹
              </button>
            </div>

            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>分类范围</span>
                <select value={categorizeScope} onChange={(e) => setCategorizeScope(e.target.value as CategorizeScope)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none">
                  <option value="all">全部书签</option>
                  <option value="inbox">待整理</option>
                  <option value="uncategorized">未分类 / 待整理</option>
                  <option value="category">指定文件夹</option>
                </select>
                {categorizeScope === 'category' && (
                  <>
                    <select value={categorizeCategoryId} onChange={(e) => setCategorizeCategoryId(e.target.value)} className="min-w-40 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none">
                      <option value="">选择文件夹</option>
                      {editableCategories.map(category => (
                        <option key={category.id} value={category.id}>{category.parentId ? '— ' : ''}{category.name}</option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={includeSubCategories} onChange={e => setIncludeSubCategories(e.target.checked)} />
                      含子文件夹
                    </label>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>重命名范围</span>
                <select value={renameScope} onChange={(e) => setRenameScope(e.target.value as RenameScope)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none">
                  <option value="all">全部文件夹</option>
                  <option value="top">仅顶级文件夹</option>
                  <option value="category">指定文件夹</option>
                </select>
                {renameScope === 'category' && (
                  <select value={renameCategoryId} onChange={(e) => setRenameCategoryId(e.target.value)} className="min-w-40 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none">
                    <option value="">选择文件夹</option>
                    {editableCategories.filter(c => c.id !== 'common').map(category => (
                      <option key={category.id} value={category.id}>{category.parentId ? '— ' : ''}{category.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>拆分目标</span>
                <select value={structureCategoryId} onChange={(e) => setStructureCategoryId(e.target.value)} className="min-w-40 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none">
                  <option value="">选择文件夹</option>
                  {editableCategories.filter(c => c.id !== 'common').map(category => (
                    <option key={category.id} value={category.id}>{category.parentId ? '— ' : ''}{category.name}</option>
                  ))}
                </select>
              </div>
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

      {renamePreview.length > 0 && !isProcessing && (
        <div className="rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI 文件夹重命名预览</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">根据文件夹内书签样本生成名称，勾选后一次应用。</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRenameIds(new Set(renamePreview.filter(item => item.toName && item.toName !== item.fromName).map(item => item.categoryId)))}
                className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                全选变更
              </button>
              <button onClick={() => setRenamePreview([])} className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1"><X size={12} /> 关闭</button>
              <button onClick={applyRenamePreview} className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1"><Check size={12} /> 应用勾选</button>
            </div>
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
            {renamePreview.map(item => {
              const changed = Boolean(item.toName && item.toName !== item.fromName);
              return (
                <label key={item.categoryId} className="grid grid-cols-[auto,1fr,140px,140px] gap-3 items-center px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <input type="checkbox" disabled={!changed} checked={selectedRenameIds.has(item.categoryId)} onChange={() => toggleRenameSelection(item.categoryId)} />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{item.fromName}</div>
                    <div className="text-slate-400 truncate">{item.error || `样本 ${item.sampleCount} 个`}</div>
                  </div>
                  <span className="truncate text-slate-500 dark:text-slate-400">{item.fromName}</span>
                  <span className={changed ? 'truncate text-amber-600 dark:text-amber-300 font-medium' : 'truncate text-slate-400'}>{item.toName || '失败'}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {structurePreview && !isProcessing && (
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">按内容新建子文件夹</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                父文件夹：{structurePreview.parentName}
                {structurePreview.reason ? ` · ${structurePreview.reason}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStructurePreview(null)} className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1"><X size={12} /> 关闭</button>
              <button onClick={applyStructurePreview} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"><Check size={12} /> 应用勾选</button>
            </div>
          </div>

          {structurePreview.renameParent && (
            <label className="flex items-center gap-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <input
                type="checkbox"
                checked={structurePreview.renameParentSelected}
                onChange={(e) => setStructurePreview(prev => prev ? { ...prev, renameParentSelected: e.target.checked } : prev)}
              />
              <span className="text-slate-500">同时重命名父文件夹：</span>
              <input
                type="text"
                value={structurePreview.renameParent}
                onChange={(e) => setStructurePreview(prev => prev ? { ...prev, renameParent: e.target.value } : prev)}
                className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
              />
            </label>
          )}

          <div className="space-y-2 max-h-80 overflow-auto">
            {structurePreview.folders.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-4">
                AI 未建议新建子文件夹，可保留当前结构。
              </div>
            ) : structurePreview.folders.map((folder, index) => (
              <div key={folder.tempId} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={folder.selected}
                    onChange={(e) => setStructurePreview(prev => {
                      if (!prev) return prev;
                      const folders = prev.folders.map((f, i) => i === index ? { ...f, selected: e.target.checked } : f);
                      return { ...prev, folders };
                    })}
                  />
                  <input
                    type="text"
                    value={folder.name}
                    onChange={(e) => setStructurePreview(prev => {
                      if (!prev) return prev;
                      const folders = prev.folders.map((f, i) => i === index ? { ...f, name: e.target.value } : f);
                      return { ...prev, folders };
                    })}
                    className="flex-1 min-w-0 px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                  />
                  <span className="text-xs text-slate-400 whitespace-nowrap">{folder.linkIds.length} 个书签</span>
                </div>
                {folder.reason && <div className="text-[11px] text-slate-400">{folder.reason}</div>}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {folder.linkIds
                    .map(id => links.find(l => l.id === id)?.title || id)
                    .slice(0, 6)
                    .join(' · ')}
                  {folder.linkIds.length > 6 ? ' …' : ''}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            保留在父文件夹：{structurePreview.keepInParent.length} 个
          </div>
        </div>
      )}
    </div>
  );
};

export default AISettingsTab;
