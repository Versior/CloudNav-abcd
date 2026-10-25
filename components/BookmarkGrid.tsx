import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardStyle, LinkItem } from '../types';
import LinkCard from './LinkCard';

interface SortableCardProps {
  link: LinkItem;
  cardStyle: CardStyle;
  /** 整理模式：显示勾选框并禁用跳转。 */
  selectable?: boolean;
  selected?: boolean;
  /** 显示拖拽把手（仅手动排序且非整理模式）。 */
  draggable?: boolean;
  onOpen: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;

  onToggleSelect?: (id: string) => void;
  onContextMenu?: (event: React.MouseEvent, link: LinkItem) => void;
}

/** 单个可拖拽卡片：仅手动排序时挂载拖拽能力。 */
const SortableCard: React.FC<SortableCardProps> = props => {
  const sortable = useSortable({ id: props.link.id, disabled: !props.draggable });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={sortable.isDragging ? 'z-10 opacity-60' : undefined}
      {...(props.draggable ? sortable.attributes : {})}
      {...(props.draggable ? sortable.listeners : {})}
    >
      <LinkCard {...props} />
    </div>
  );
};

interface BookmarkGridProps extends Omit<SortableCardProps, 'link' | 'selected'> {
  links: LinkItem[];
  /** 整理模式下按 id 判断选中，避免逐卡传布尔值。 */
  selectedIds?: Set<string>;
}

/** 网格容器：列数随视图宽度自适应，列表模式降为单列。 */
const BookmarkGrid: React.FC<BookmarkGridProps> = ({ links, cardStyle, selectedIds, ...rest }) => {
  const gridClass = cardStyle === 'list'
    ? 'grid grid-cols-1 gap-1.5'
    : cardStyle === 'simple'
      ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
      : 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

  return (
    <div className={gridClass}>
      {links.map(link => (
        <SortableCard
          key={link.id}
          link={link}
          cardStyle={cardStyle}
          selected={selectedIds?.has(link.id) ?? false}
          {...rest}
        />
      ))}
    </div>
  );
};

export default React.memo(BookmarkGrid);
