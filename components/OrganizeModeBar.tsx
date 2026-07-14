import React, { useEffect, useCallback } from 'react';
import { Check, Trash2, ArrowRight, X, Sparkles, Loader2 } from 'lucide-react';

interface OrganizeModeBarProps {
  isActive: boolean;
  totalCount: number;
  currentIndex: number;
  onAccept: () => void;
  onDelete: () => void;
  onSkip: () => void;
  onAiOrganize?: () => void;
  isAiOrganizing?: boolean;
  onExit: () => void;
}

const OrganizeModeBar: React.FC<OrganizeModeBarProps> = ({ isActive, totalCount, currentIndex, onAccept, onDelete, onSkip, onAiOrganize, isAiOrganizing = false, onExit }) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); onAccept(); }
    else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); onDelete(); }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); onSkip(); }
    else if (e.key === 'Escape') { onExit(); }
  }, [isActive, onAccept, onDelete, onSkip, onExit]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isActive) return null;

  return (
    <div className="sticky top-0 z-30 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">整理模式</span>
        <span className="text-blue-100">{currentIndex + 1} / {totalCount}</span>
      </div>
      <div className="flex items-center gap-2">
        {onAiOrganize && (
          <button
            onClick={onAiOrganize}
            disabled={isAiOrganizing || totalCount === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-60 text-xs font-medium transition-colors"
            title="AI 整理当前链接"
          >
            {isAiOrganizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            AI 整理
          </button>
        )}
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded text-xs"><span className="font-bold">A</span> 接受</kbd>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded text-xs"><span className="font-bold">D</span> 删除</kbd>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded text-xs"><span className="font-bold">N</span> 跳过</kbd>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded text-xs">Esc 退出</kbd>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onAccept} className="p-1.5 hover:bg-white/20 rounded" title="接受 (A)"><Check size={16} /></button>
          <button onClick={onDelete} className="p-1.5 hover:bg-white/20 rounded" title="删除 (D)"><Trash2 size={16} /></button>
          <button onClick={onSkip} className="p-1.5 hover:bg-white/20 rounded" title="下一个 (N)"><ArrowRight size={16} /></button>
          <button onClick={onExit} className="p-1.5 hover:bg-white/20 rounded ml-2" title="退出 (Esc)"><X size={16} /></button>
        </div>
      </div>
    </div>
  );
};

export default OrganizeModeBar;
