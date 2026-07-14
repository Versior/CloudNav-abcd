import React, { useState, useEffect } from 'react';
import { Copy, Check, Download, Sidebar, Keyboard, Package, Zap, Globe, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import { buildExtensionAssets } from '../services/extensionAssets';
import { AUTH_KEY } from '../constants/storageKeys';

interface ExtensionToolsTabProps {
  authToken: boolean;
  extensionToken: string;
  favicon: string;
  navTitle: string;
}

const ExtensionToolsTab: React.FC<ExtensionToolsTabProps> = ({ authToken, extensionToken, favicon, navTitle }) => {
  const [domain, setDomain] = useState('');
  const [browserType, setBrowserType] = useState<'chrome' | 'firefox'>('chrome');
  const [isZipping, setIsZipping] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    setDomain(window.location.origin);
  }, [authToken]);

  const { getManifestJson, extBackgroundJs, extSidebarHtml, extSidebarJs } = buildExtensionAssets({
    domain, token: extensionToken, navTitle, browserType
  });

  const handleCopy = (text: string, key: string) => {
      navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
  };

  const handleDownloadFile = (filename: string, content: string) => {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const generateIconBlob = async (): Promise<Blob | null> => {
     const iconUrl = favicon;
     if (!iconUrl) return null;

     try {
         const img = new Image();
         img.crossOrigin = "anonymous";
         img.src = iconUrl;

         await new Promise((resolve, reject) => {
             img.onload = resolve;
             img.onerror = reject;
         });

         const canvas = document.createElement('canvas');
         canvas.width = 128;
         canvas.height = 128;
         const ctx = canvas.getContext('2d');
         if (!ctx) throw new Error('Canvas error');

         ctx.drawImage(img, 0, 0, 128, 128);

         return new Promise((resolve) => {
             canvas.toBlob((blob) => {
                 resolve(blob);
             }, 'image/png');
         });
     } catch (e) {
         console.error(e);
         return null;
     }
  };

  const handleDownloadIcon = async () => {
    const blob = await generateIconBlob();
    if (!blob) {
        alert("生成图片失败 (可能是跨域限制)。\n\n请尝试右键点击下方的预览图片，选择 '图片另存为...' 保存。");
        return;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "icon.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
        const zip = new JSZip();

        zip.file("manifest.json", getManifestJson());
        zip.file("background.js", extBackgroundJs);
        zip.file("sidebar.html", extSidebarHtml);
        zip.file("sidebar.js", extSidebarJs);

        const iconBlob = await generateIconBlob();
        if (iconBlob) {
            zip.file("icon.png", iconBlob);
        } else {
            console.warn("Could not generate icon for zip");
            zip.file("icon_missing.txt", "Icon generation failed due to CORS. Please save the icon manually.");
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "NaviX-Ext.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

    } catch(e) {
        console.error(e);
        alert("打包下载失败");
    } finally {
        setIsZipping(false);
    }
  };

  const renderCodeBlock = (filename: string, code: string) => (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">{filename}</span>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleDownloadFile(filename, code)}
                    className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    title="下载文件"
                >
                    <Download size={12}/>
                    Download
                </button>
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                <button
                    onClick={() => handleCopy(code, filename)}
                    className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                    {copiedStates[filename] ? <Check size={12}/> : <Copy size={12}/>}
                    {copiedStates[filename] ? 'Copied' : 'Copy'}
                </button>
            </div>
        </div>
        <div className="bg-slate-900 p-3 overflow-x-auto">
            <pre className="text-[10px] md:text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
                {code}
            </pre>
        </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

        <div className="space-y-3">
            <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                输入访问密码
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="space-y-3">
                     <div>
                        <label className="text-xs text-slate-500 mb-1 block">API 域名 (自动获取)</label>
                        <code className="block w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
                            {domain}
                        </code>
                     </div>
                     <div>
                        <label className="text-xs text-slate-500 mb-1 block">认证状态</label>
                        <div className="block w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs">
                            {authToken && extensionToken ? '已通过主站认证，扩展 Token 可用' : authToken ? '已登录主站' : '未登录主站'}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">扩展包使用 Bearer Token 认证，不包含 PASSWORD 明文。</p>
                     </div>
                </div>
            </div>
        </div>

        <div className="space-y-3">
            <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                选择浏览器类型
            </h4>
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => setBrowserType('chrome')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${browserType === 'chrome' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-white dark:bg-slate-800'}`}
                >
                    <span className="font-semibold">Chrome / Edge</span>
                </button>
                <button
                    onClick={() => setBrowserType('firefox')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${browserType === 'firefox' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 bg-white dark:bg-slate-800'}`}
                >
                    <span className="font-semibold">Mozilla Firefox</span>
                </button>
            </div>
        </div>

        <div className="space-y-4">
            <h4 className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">3</span>
                配置步骤与代码
            </h4>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                <h5 className="font-semibold text-sm mb-3 dark:text-slate-200">
                    安装指南 ({browserType === 'chrome' ? 'Chrome/Edge' : 'Firefox'}):
                </h5>
                <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
                    <li>在电脑上新建文件夹 <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs">NaviX-Pro</code>。</li>
                    <li><strong>[重要]</strong> 将下方图标保存为 <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs">icon.png</code>。</li>
                    <li>获取插件代码文件：
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-slate-500">
                            <li><strong>方式一 (推荐)：</strong>点击下方的 <span className="text-blue-600 dark:text-blue-400 font-bold">"📦 一键下载所有文件"</span> 按钮，解压到该文件夹。</li>
                            <li><strong>方式二 (备用)：</strong>分别点击下方代码块的 <Download size={12} className="inline"/> 按钮下载或复制 <code className="bg-white dark:bg-slate-900 px-1 rounded">manifest.json</code>, <code className="bg-white dark:bg-slate-900 px-1 rounded">background.js</code> 等文件到该文件夹。</li>
                        </ul>
                    </li>
                    <li>
                        打开浏览器扩展管理页面
                        {browserType === 'chrome' ? (
                            <> (Chrome: <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">chrome://extensions</code>)</>
                        ) : (
                            <> (Firefox: <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">about:debugging</code>)</>
                        )}。
                    </li>
                    <li className="text-blue-600 font-bold">操作关键点：</li>
                    <li>1. 开启右上角的 "开发者模式" (Chrome)。</li>
                    <li>2. 点击 "加载已解压的扩展程序"，选择包含上述文件的文件夹。</li>
                    <li>3. 前往 <code className="select-all bg-white dark:bg-slate-900 px-1 rounded">chrome://extensions/shortcuts</code>。</li>
                    <li>4. <strong>[重要]</strong> 找到 "打开/关闭 NaviX 侧边栏"，设置快捷键 (如 Ctrl+Shift+E)。</li>
                </ol>

                <div className="mt-4 mb-4">
                    <button
                        onClick={handleDownloadZip}
                        disabled={isZipping}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <Package size={20} />
                        {isZipping ? '打包中...' : '📦 一键下载所有文件 (v7.6 Pro)'}
                    </button>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded border border-green-200 dark:border-green-900/50 text-sm space-y-2">
                    <div className="font-bold flex items-center gap-2"><Zap size={16}/> 完美交互方案 (v7.6):</div>
                    <ul className="list-disc list-inside text-xs space-y-1">
                        <li><strong>左键 / 快捷键:</strong> 极速打开/关闭侧边栏 (无弹窗延迟)。</li>
                        <li><strong>网页右键:</strong> 直接展示分类列表 (支持判重警告)。</li>
                        <li><strong>图标右键:</strong> 同上，统一为级联菜单，直接保存。</li>
                    </ul>
                </div>
            </div>

                <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                        {favicon ? <img src={favicon} className="w-full h-full object-cover"/> : <Globe size={24} className="text-slate-400"/>}
                    </div>
                    <div>
                        <div className="font-medium text-sm dark:text-white">插件图标 (icon.png)</div>
                        <div className="text-xs text-slate-500">请保存此图片为 icon.png</div>
                    </div>
                </div>
                <button
                    onClick={handleDownloadIcon}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-lg transition-colors"
                >
                    <Download size={16} /> 下载图标
                </button>
            </div>

            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded border border-orange-200 dark:border-orange-900/50 text-sm">
                <div className="font-bold flex items-center gap-1 mb-1"><AlertCircle size={14}/> 安全提示</div>
                <p className="text-xs">生成的扩展配置包含访问密码。请勿分享扩展目录或源码，否则他人可直接访问您的导航站数据。</p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <Sidebar size={18} className="text-purple-500"/> 核心配置
                </div>
                {renderCodeBlock('manifest.json', getManifestJson())}
                {renderCodeBlock('background.js', extBackgroundJs)}

                <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <Keyboard size={18} className="text-green-500"/> 侧边栏导航功能 (Sidebar)
                </div>
                {renderCodeBlock('sidebar.html', extSidebarHtml)}
                {renderCodeBlock('sidebar.js', extSidebarJs)}
            </div>
        </div>
    </div>
  );
};

export default ExtensionToolsTab;
