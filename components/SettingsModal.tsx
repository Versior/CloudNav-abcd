import React, { useEffect, useRef, useState } from 'react';
import { Bot, Cloud, CopyCheck, LayoutTemplate, Save, Wrench, X } from 'lucide-react';
import { AIConfig, Category, LinkItem, SiteSettings } from '../types';
import { useModalA11y } from './useModalA11y';
import BackupSettingsTab from './BackupSettingsTab';
import SiteSettingsTab from './SiteSettingsTab';
import AISettingsTab from './AISettingsTab';
import ExtensionToolsTab from './ExtensionToolsTab';
import DuplicateLinksPanel from './DuplicateLinksPanel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  siteSettings: SiteSettings;
  onSave: (config: AIConfig, siteSettings: SiteSettings) => void;
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
  onUpdateCategories?: (categories: Category[]) => void;
  onUpdateData?: (links: LinkItem[], categories: Category[]) => void;
  onEditLink?: (link: LinkItem) => void;
  onExportJson: () => void;
  onOpenImport: () => void;
  lastBackup?: { status: string; at: number } | null;
  authToken: boolean;
  extensionToken: string;
  initialAICategoryId?: string;
  initialAIAction?: 'rename' | 'structure';
  initialTab?: 'site' | 'ai' | 'tools' | 'duplicates' | 'backup';
}

type SettingsTab = 'site' | 'ai' | 'tools' | 'duplicates' | 'backup';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  siteSettings,
  onSave,
  links,
  categories,
  onUpdateLinks,
  onUpdateCategories,
  onUpdateData,
  onEditLink,
  onExportJson,
  onOpenImport,
  lastBackup,
  authToken,
  extensionToken,
  initialAICategoryId,
  initialAIAction,
  initialTab,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y(isOpen, onClose, modalRef);
  const [activeTab, setActiveTab] = useState<SettingsTab>('site');
  const [localConfig, setLocalConfig] = useState(config);
  const [localSiteSettings, setLocalSiteSettings] = useState(siteSettings);

  useEffect(() => {
    if (!isOpen) return;
    setLocalConfig(config);
    setLocalSiteSettings(siteSettings);
    if (initialTab) setActiveTab(initialTab);
    else if (initialAICategoryId || initialAIAction) setActiveTab('ai');
  }, [isOpen, config, siteSettings, initialAICategoryId, initialAIAction, initialTab]);

  const handleChange = (key: keyof AIConfig, value: string) => {
    setLocalConfig(current => ({ ...current, [key]: value }));
  };

  const saveWebsiteConfig = async (settings: SiteSettings) => {
    if (!authToken) return;
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveConfig: 'website', config: settings }),
    }).catch(() => undefined);
  };

  const handleSiteChange = (key: keyof SiteSettings, value: string | number) => {
    setLocalSiteSettings(current => {
      const next = { ...current, [key]: value };
      if (key === 'passwordExpiryDays') void saveWebsiteConfig(next);
      return next;
    });
  };

  if (!isOpen) return null;

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof LayoutTemplate }> = [
    { id: 'site', label: '网站设置', icon: LayoutTemplate },
    { id: 'backup', label: '备份与恢复', icon: Cloud },
    { id: 'ai', label: 'AI 设置', icon: Bot },
    { id: 'duplicates', label: '重复检测', icon: CopyCheck },
    { id: 'tools', label: '扩展工具', icon: Wrench },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div ref={modalRef} role="dialog" aria-modal="true" className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-700 flex max-h-[90vh] flex-col md:flex-row">
        <div className="w-full md:w-48 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto shrink-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white dark:bg-slate-800">
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h3 className="text-lg font-semibold dark:text-white">设置</h3>
            <button onClick={onClose} aria-label="关闭" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-5 h-5 dark:text-slate-400" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 pb-12">
            {activeTab === 'site' && <SiteSettingsTab value={localSiteSettings} onChange={handleSiteChange} />}
            {activeTab === 'backup' && <BackupSettingsTab onExportJson={onExportJson} onOpenImport={onOpenImport} lastBackup={lastBackup} />}
            {activeTab === 'ai' && <AISettingsTab config={localConfig} onChange={handleChange} links={links} categories={categories} onUpdateLinks={onUpdateLinks} onUpdateCategories={onUpdateCategories} onUpdateData={onUpdateData} initialCategoryId={initialAICategoryId} initialAIAction={initialAIAction} />}
            {activeTab === 'duplicates' && <DuplicateLinksPanel links={links} categories={categories} onUpdateLinks={onUpdateLinks} onEditLink={onEditLink} />}
            {activeTab === 'tools' && <ExtensionToolsTab authToken={authToken} extensionToken={extensionToken} favicon={localSiteSettings.favicon} navTitle={localSiteSettings.navTitle} />}
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-slate-50 dark:bg-slate-800/50 shrink-0">
            <button onClick={() => { onSave(localConfig, localSiteSettings); onClose(); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20"><Save size={18} /> 保存更改</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
