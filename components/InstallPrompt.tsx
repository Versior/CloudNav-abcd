import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (nextEvent: Event) => {
      nextEvent.preventDefault();
      setEvent(nextEvent as InstallPromptEvent);
    };
    const onInstalled = () => { setEvent(null); setHidden(true); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!event || hidden) return null;

  const install = async () => {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') setHidden(true);
  };

  return <div className="fixed bottom-20 right-4 z-40 flex max-w-xs items-center gap-2 rounded-2xl border border-blue-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-blue-900 dark:bg-slate-800/95"><Download size={17} className="shrink-0 text-blue-600" /><span className="flex-1 text-slate-600 dark:text-slate-200">把 CloudNav 安装到桌面，打开更快。</span><button type="button" onClick={install} className="rounded-lg bg-blue-600 px-2.5 py-1.5 font-medium text-white">安装</button><button type="button" onClick={() => setHidden(true)} aria-label="关闭安装提示" className="text-slate-400"><X size={15} /></button></div>;
};

export default InstallPrompt;
