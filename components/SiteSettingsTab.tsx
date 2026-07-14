import React, { useState, useEffect } from 'react';
import { Globe, RefreshCw } from 'lucide-react';
import { SiteSettings } from '../types';

const getRandomColor = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 70 + Math.random() * 20;
    const l = 45 + Math.random() * 15;
    return `hsl(${h}, ${s}%, ${l}%)`;
};

const generateSvgIcon = (text: string, color1: string, color2: string) => {
    let char = '';
    if (text && text.length > 0) {
        char = text.charAt(0);
        if (/^[a-zA-Z]$/.test(char)) {
            char = '云';
        }
    } else {
        char = '云';
    }

    const gradientId = 'g_' + Math.random().toString(36).substr(2, 9);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${color1}"/>
                <stop offset="100%" stop-color="${color2}"/>
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#${gradientId})" rx="16"/>
        <text x="50%" y="50%" dy=".35em" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="32" text-anchor="middle">${char}</text>
    </svg>`.trim();

    try {
        const encoded = window.btoa(unescape(encodeURIComponent(svg)));
        return `data:image/svg+xml;base64,${encoded}`;
    } catch (e) {
        console.error("SVG Icon Generation Failed", e);
        return '';
    }
};

interface SiteSettingsTabProps {
  value: SiteSettings;
  onChange: (key: keyof SiteSettings, value: any) => void;
}

const SiteSettingsTab: React.FC<SiteSettingsTabProps> = ({ value, onChange }) => {
  const [generatedIcons, setGeneratedIcons] = useState<string[]>([]);

  const updateGeneratedIcons = (text: string) => {
      const newIcons: string[] = [];
      for (let i = 0; i < 6; i++) {
          const c1 = getRandomColor();
          const h2 = (parseInt(c1.split(',')[0].split('(')[1]) + 30 + Math.random() * 30) % 360;
          const c2 = `hsl(${h2}, 70%, 50%)`;
          newIcons.push(generateSvgIcon(text, c1, c2));
      }
      setGeneratedIcons(newIcons);
  };

  useEffect(() => {
    if (generatedIcons.length === 0) {
      updateGeneratedIcons(value.navTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">网页标题 (Title)</label>
                <input
                    type="text"
                    value={value.title}
                    onChange={(e) => onChange('title', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">导航栏标题</label>
                <input
                    type="text"
                    value={value.navTitle}
                    onChange={(e) => onChange('navTitle', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">网站图标 (Favicon URL)</label>
                <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                        {value.favicon ? <img src={value.favicon} className="w-full h-full object-cover"/> : <Globe size={20} className="text-slate-400"/>}
                    </div>
                    <input
                        type="text"
                        value={value.favicon}
                        onChange={(e) => onChange('favicon', e.target.value)}
                        placeholder="https://example.com/favicon.ico"
                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500">选择生成的随机图标 (点击右侧按钮刷新):</p>
                        <button
                            type="button"
                            onClick={() => updateGeneratedIcons(value.navTitle)}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                        >
                            <RefreshCw size={12} /> 随机生成
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {generatedIcons.map((icon, idx) => (
                            <button
                                key={idx}
                                onClick={() => onChange('favicon', icon)}
                                className="w-8 h-8 rounded hover:ring-2 ring-blue-500 transition-all border border-slate-100 dark:border-slate-600"
                            >
                                <img src={icon} className="w-full h-full rounded" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">身份验证过期天数</label>
                <div className="relative">
                    <input
                        type="number"
                        min="0"
                        value={value.passwordExpiryDays}
                        onChange={(e) => onChange('passwordExpiryDays', parseInt(e.target.value) || 0)}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <p className="text-xs text-slate-500 mt-1">设置为 0 表示永久不退出，默认 7 天后自动退出</p>
            </div>
        </div>
    </div>
  );
};

export default SiteSettingsTab;
