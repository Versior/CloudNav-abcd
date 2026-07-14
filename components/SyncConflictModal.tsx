import React from 'react';
import { X, AlertTriangle, Cloud, Download, Upload } from 'lucide-react';

interface SyncConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseLocal: () => void;
  onUseCloud: () => void;
  onMerge: () => void;
}

const SyncConflictModal: React.FC<SyncConflictModalProps> = ({ isOpen, onClose, onUseLocal, onUseCloud, onMerge }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg dark:text-white">同步冲突</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              本地和云端数据都发生了修改，无法自动合并。请选择处理方式：
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded ml-auto"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <button onClick={onUseLocal} className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-left">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Download size={16} className="text-blue-600 dark:text-blue-400" /></div>
            <div><div className="font-medium text-sm dark:text-white">使用本地数据</div><div className="text-xs text-slate-500">本地的修改将覆盖云端</div></div>
          </button>
          <button onClick={onUseCloud} className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-left">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><Upload size={16} className="text-green-600 dark:text-green-400" /></div>
            <div><div className="font-medium text-sm dark:text-white">使用云端数据</div><div className="text-xs text-slate-500">云端的数据将覆盖本地</div></div>
          </button>
          <button onClick={onMerge} className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-left">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Cloud size={16} className="text-purple-600 dark:text-purple-400" /></div>
            <div><div className="font-medium text-sm dark:text-white">自动合并</div><div className="text-xs text-slate-500">尝试合并两端数据（按 ID 去重）</div></div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncConflictModal;
