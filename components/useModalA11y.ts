import React, { useEffect } from 'react';

/**
 * 统一弹窗无障碍行为:ESC 关闭 + Tab 焦点锁在弹窗内 + 打开时自动聚焦首个可聚焦元素。
 * 视觉零侵入:各弹窗只需把白框容器 ref 传进来即可,不改布局。
 */
export function useModalA11y(
  isOpen: boolean,
  onClose: (() => void) | undefined,
  containerRef: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!isOpen) return;

    const getFocusables = (): HTMLElement[] => {
      const container = containerRef.current;
      if (!container) return [];
      const nodeList = container.querySelectorAll(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      );
      return (Array.from(nodeList) as HTMLElement[]).filter(el => el.offsetParent !== null);
    };

    // 打开时自动聚焦第一个可聚焦元素
    let clearFocusTimer = () => {};
    const first = getFocusables()[0];
    if (first) {
      const t = setTimeout(() => first.focus(), 0);
      clearFocusTimer = () => clearTimeout(t);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) {
          e.stopPropagation();
          onClose();
        }
        return;
      }
      if (e.key === 'Tab') {
        const items = getFocusables();
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearFocusTimer();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose, containerRef]);
}
