import React, { useEffect, useCallback } from 'react';
import { Check, Trash2, ArrowRight, X } from 'lucide-react';

interface OrganizeModeBarProps {
  isActive: boolean;
  totalCount: number;
  currentIndex: number;
  onAccept: () => void;
  onDelete: () => void;
  onSkip: () => void;
  onExit: () => void;
}

const OrganizeModeBar: React.FC<OrganizeModeBarProps> = ({ isActive, totalCount, currentIndex, onAccept, onDelete, onSkip, onExit }) => {
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
