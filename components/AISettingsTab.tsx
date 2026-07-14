import React, { useState, useRef } from 'react';
import { Key, Sparkles, PauseCircle } from 'lucide-react';
import { AIConfig, LinkItem } from '../types';
import { generateLinkDescription } from '../services/geminiService';

interface AISettingsTabProps {
  config: AIConfig;
  onChange: (key: keyof AIConfig, value: string) => void;
  links: LinkItem[];
  onUpdateLinks: (links: LinkItem[]) => void;
}

const AISettingsTab: React.FC<AISettingsTabProps> = ({ config, onChange, links, onUpdateLinks }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const shouldStopRef = useRef(false);

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
    shouldStopRef.current = false;
    setProgress({ current: 0, total: missingLinks.length });

    let currentLinks = [...links];

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
            console.error(`Failed to generate for ${link.title}`, e);
        }
    }

    setIsProcessing(false);
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

        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <h4 className="text-sm font-semibold mb-2 dark:text-slate-200">批量操作</h4>
            {isProcessing ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>正在生成描述... ({progress.current}/{progress.total})</span>
                        <button onClick={() => { shouldStopRef.current = true; setIsProcessing(false); }} className="text-red-500 flex items-center gap-1 hover:underline">
                            <PauseCircle size={12}/> 停止
                        </button>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={handleBulkGenerate}
                    className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-2 rounded-lg transition-colors border border-purple-200 dark:border-purple-800"
                >
                    <Sparkles size={16} /> 一键补全所有缺失的描述
                </button>
            )}
        </div>
    </div>
  );
};

export default AISettingsTab;
