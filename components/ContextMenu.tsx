import React, { useEffect, useRef } from 'react';
import { Copy, QrCode, Edit2, Trash2, Pin, FolderOpen, Sparkles, LucideIcon } from 'lucide-react';

type MenuItem = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
};

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  targetType?: 'link' | 'category';
  isCategoryEditable?: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onShowQRCode: () => void;
  onEditLink: () => void;
  onDeleteLink: () => void;
  onTogglePin: () => void;
  onOpenCategory?: () => void;
  onEditCategory?: () => void;
  onOrganizeCategory?: () => void;
  onDeleteCategory?: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  position,
  targetType = 'link',
  isCategoryEditable = true,
  onClose,
  onCopyLink,
  onShowQRCode,
  onEditLink,
  onDeleteLink,
  onTogglePin,
  onOpenCategory,
  onEditCategory,
  onOrganizeCategory,
  onDeleteCategory
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 220),
    y: Math.min(position.y, window.innerHeight - 220)
  };

  const linkMenuItems: MenuItem[] = [
    { icon: Copy, label: '复制链接', onClick: onCopyLink },
    { icon: QrCode, label: '显示二维码', onClick: onShowQRCode },
    { icon: Edit2, label: '编辑链接', onClick: onEditLink },
    { icon: Pin, label: '置顶/取消置顶', onClick: onTogglePin },
    { icon: Trash2, label: '删除链接', onClick: onDeleteLink, className: 'text-red-600 dark:text-red-400' }
  ];

  const categoryMenuItems: MenuItem[] = [];
  if (onOpenCategory) categoryMenuItems.push({ icon: FolderOpen, label: '打开文件夹', onClick: onOpenCategory });
  if (onEditCategory) categoryMenuItems.push({ icon: Edit2, label: isCategoryEditable ? '编辑文件夹' : '管理分类', onClick: onEditCategory });
  if (onOrganizeCategory) categoryMenuItems.push({ icon: Sparkles, label: 'AI 整理此文件夹', onClick: onOrganizeCategory });
  if (isCategoryEditable && onDeleteCategory) categoryMenuItems.push({ icon: Trash2, label: '删除文件夹', onClick: onDeleteCategory, className: 'text-red-600 dark:text-red-400' });

  const menuItems = targetType === 'category' ? categoryMenuItems : linkMenuItems;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
            item.className || 'text-slate-700 dark:text-slate-300'
          }`}
        >
          <item.icon size={16} className={item.className} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;