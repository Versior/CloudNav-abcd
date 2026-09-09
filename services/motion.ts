export const motionTokens = {
  fast: 160,
  normal: 260,
  spatial: 360,
  stagger: 28,
  easeSpatial: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeExit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export type SpatialDirection = 'forward' | 'backward' | 'same';
export type DetailsOrigin = 'left' | 'right' | 'bottom';

export const motionDirections = {
  workbench: 'workbench',
  links: 'links',
  rss: 'rss',
} as const;

export const getSpatialViewClass = (direction: SpatialDirection) => `cloudnav-spatial-${direction}`;
export const getDetailsOriginClass = (origin: DetailsOrigin) => `cloudnav-details-from-${origin}`;
