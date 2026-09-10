export interface PendingMutation {
  id: string;
  createdAt: number;
  links: unknown[];
  categories: unknown[];
  baseVersion: number;
  workspace?: unknown;
}

export const createPendingMutationId = () => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `mutation-${suffix}`;
};

export const coalescePendingMutations = (_pending: PendingMutation[], next: PendingMutation): PendingMutation[] => [next];

export const takeNextMutation = (pending: PendingMutation[]): [PendingMutation | undefined, PendingMutation[]] => {
  const ordered = [...pending].sort((left, right) => left.createdAt - right.createdAt);
  return [ordered[0], ordered.slice(1)];
};
