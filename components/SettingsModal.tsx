import React, { useState, useEffect, useRef } from 'react';
import { useModalA11y } from './useModalA11y';
import { X, Save, Bot, Wrench, LayoutTemplate } from 'lucide-react';
import { AIConfig, LinkItem, Category, SiteSettings } from '../types';
import SiteSettingsTab from './SiteSettingsTab';
import AISettingsTab from './AISettingsTab';
import ExtensionToolsTab from './ExtensionToolsTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  siteSettings: SiteSettings;
  onSave: (config: AIConfig, siteSettings: SiteSettings) => void;
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  authToken: boolean;
  extensionToken: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen, onClose, config, siteSettings, onSave, links, categories, onUpdateLinks, authToken, extensionToken
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(isOpen, onClose, modalRef);

  const [activeTab, setActiveTab] = useState<'site' | 'ai' | 'tools'>('site');
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [localSiteSettings, setLocalSiteSettings] = useState<SiteSettings>(() => ({
      title: siteSettings?.title || 'NaviX - 我的导航',
      navTitle: siteSettings?.navTitle || 'NaviX',
      favicon: siteSettings?.favicon || '',
      cardStyle: siteSettings?.cardStyle || 'detailed',
      passwordExpiryDays: siteSettings?.passwordExpiryDays ?? 7
  }));

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      const safeSettings = {
          title: siteSettings?.title || 'NaviX - 我的导航',
          navTitle: siteSettings?.navTitle || 'NaviX',
          favicon: siteSettings?.favicon || '',
          cardStyle: siteSettings?.cardStyle || 'detailed',
          passwordExpiryDays: siteSettings?.passwordExpiryDays ?? 7
      };
      setLocalSiteSettings(safeSettings);
    }
  }, [isOpen, config, siteSettings]);

  const handleChange = (key: keyof AIConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  // 保存网站配置到 KV 空间
  const saveWebsiteConfigToKV = async (settings: SiteSettings) => {
    try {
        const response = await fetch('/api/storage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                saveConfig: 'website',
                config: settings
            })
        });

        if (!response.ok) {
            console.error('Failed to save website config to KV:', response.statusText);
        }
    } catch (error) {
        console.error('Error saving website config to KV:', error);
    }
  };

  const handleSiteChange = async (key: keyof SiteSettings, value: any) => {
    setLocalSiteSettings(prev => {
        const next = { ...prev, [key]: value };

        // 如果是身份验证过期天数修改，立即保存到 KV 空间
        if (key === 'passwordExpiryDays' && authToken) {
            saveWebsiteConfigToKV(next);
        }

        return next;
    });
  };

  const handleSave = () => {
    onSave(localConfig, localSiteSettings);
    onClose();
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'site', label: '网站设置', icon: LayoutTemplate },
    { id: 'ai', label: 'AI 设置', icon: Bot },
    { id: 'tools', label: '扩展工具', icon: Wrench },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div ref={modalRef} role="dialog" aria-modal="true" className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-700 flex max-h-[90vh] flex-col md:flex-row">

        <div className="w-full md:w-48 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto shrink-0">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    <tab.icon size={18} />
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white dark:bg-slate-800">
             <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <h3 className="text-lg font-semibold dark:text-white">设置</h3>
                <button onClick={onClose} aria-label="关闭" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X className="w-5 h-5 dark:text-slate-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-12">
                {activeTab === 'site' && (
                    <SiteSettingsTab value={localSiteSettings} onChange={handleSiteChange} />
                )}
                {activeTab === 'ai' && (
                    <AISettingsTab config={localConfig} onChange={handleChange} links={links} categories={categories} onUpdateLinks={onUpdateLinks} />
                )}
                {activeTab === 'tools' && (
                    <ExtensionToolsTab authToken={authToken} extensionToken={extensionToken} favicon={localSiteSettings.favicon} navTitle={localSiteSettings.navTitle} />
                )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Save size={18} /> 保存更改
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
