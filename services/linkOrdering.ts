export type MoveDirection = 'top' | 'up' | 'down' | 'bottom';

export const moveItem = <T extends { id: string }>(items: T[], id: string, direction: MoveDirection): T[] => {
  const sourceIndex = items.findIndex(item => item.id === id);
  if (sourceIndex < 0) return [...items];

  const targetIndex = direction === 'top'
    ? 0
    : direction === 'bottom'
      ? items.length - 1
      : direction === 'up'
        ? Math.max(0, sourceIndex - 1)
        : Math.min(items.length - 1, sourceIndex + 1);

  if (targetIndex === sourceIndex) return [...items];
  const next = [...items];
  const [item] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, item);
  return next;
};
