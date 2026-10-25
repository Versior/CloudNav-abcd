import React from 'react';
import { FolderInput, Pin, PinOff, Tag, Trash2, X } from 'lucide-react';
import type { Category } from '../types';

interface ArrangeActionBarProps {
  selectedCount: number;
  categories: Category[];
  /** 批量动作进行中时禁用按钮，避免重复提交。 */
  busy?: boolean;
  onMove: (categoryId: string) => void;
  onTogglePin: (pinned: boolean) => void;
  onAddTag: (tag: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

const ArrangeActionBar: React.FC<ArrangeActionBarProps> = ({
  selectedCount, categories, busy, onMove, onTogglePin, onAddTag, onDelete, onClear,
}) => {
  const [tagInput, setTagInput] = React.useState('');
  const [tagOpen, setTagOpen] = React.useState(false);
  const disabled = selectedCount === 0 || busy;
  const parents = categories.filter(category => !category.parentId);
  const children = categories.filter(category => category.parentId);

  if (selectedCount === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/95 px-2.5 py-2 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.4)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <span className="flex items-center gap-1.5 px-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          已选 <span className="text-blue-600 dark:text-blue-400">{selectedCount}</span> 项
        </span>

        <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* 移动到分类 */}
        <div className="group relative">
          <button type="button" disabled={disabled} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700">
            <FolderInput size={13} />移动
          </button>
          <div className="invisible absolute bottom-full left-0 mb-1.5 max-h-64 w-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-800">
            {parents.map(category => (
              <React.Fragment key={category.id}>
                <button type="button" onClick={() => onMove(category.id)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/60">
                  {category.name}
                </button>
                {children.filter(child => child.parentId === category.id).map(child => (
                  <button key={child.id} type="button" onClick={() => onMove(child.id)} className="flex w-full items-center gap-1.5 rounded-md py-1.5 pl-5 pr-2 text-left text-[12px] text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/60">
                    — {child.name}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <button type="button" disabled={disabled} onClick={() => onTogglePin(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700">
          <Pin size={13} />置顶
        </button>
        <button type="button" disabled={disabled} onClick={() => onTogglePin(false)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700">
          <PinOff size={13} />取消置顶
        </button>

        {/* 加标签 */}
        <div className="relative">
          <button type="button" disabled={disabled} onClick={() => setTagOpen(open => !open)} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium disabled:opacity-40 ${tagOpen ? 'bg-slate-100 text-blue-600 dark:bg-slate-700' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
            <Tag size={13} />标签
          </button>
          {tagOpen && (
            <div className="absolute bottom-full left-0 mb-1.5 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <form
                onSubmit={event => {
                  event.preventDefault();
                  const value = tagInput.trim();
                  if (!value) return;
                  onAddTag(value);
                  setTagInput('');
                  setTagOpen(false);
                }}
                className="flex gap-1.5"
              >
                <input
                  autoFocus
                  value={tagInput}
                  onChange={event => setTagInput(event.target.value)}
                  placeholder="输入标签名"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-[12px] outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <button type="submit" className="rounded-md bg-blue-600 px-2 py-1 text-[12px] font-medium text-white">加</button>
              </form>
            </div>
          )}
        </div>

        <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        <button type="button" disabled={disabled} onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-900/20">
          <Trash2 size={13} />删除
        </button>

        <button type="button" onClick={onClear} title="清空选择" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export default ArrangeActionBar;
