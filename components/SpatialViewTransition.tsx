import React, { useEffect, useRef, useState } from 'react';
import { getSpatialViewClass } from '../services/motion';

type ViewKey = 'links' | 'workbench' | 'rss' | 'inspiration' | 'read-later' | 'github' | 'inbox' | 'reading';

const order: Record<ViewKey, number> = { links: 0, workbench: 1, rss: 2, inbox: 3, reading: 4, inspiration: 5, 'read-later': 6, github: 7 };

const SpatialViewTransition: React.FC<{ viewKey: ViewKey; children: React.ReactNode }> = ({ viewKey, children }) => {
  const previousView = useRef(viewKey);
  const [direction, setDirection] = useState<'forward' | 'backward' | 'same'>('same');

  useEffect(() => {
    if (previousView.current !== viewKey) {
      setDirection(order[viewKey] >= order[previousView.current] ? 'forward' : 'backward');
      previousView.current = viewKey;
    }
  }, [viewKey]);

  return (
    <div className={`cloudnav-spatial-stage ${getSpatialViewClass(direction)}`} data-spatial-view={viewKey}>
      {children}
    </div>
  );
};

export default SpatialViewTransition;
