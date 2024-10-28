import { useEffect } from 'react';
import { FoliateView } from '@/app/reader/components/FoliateViewer';

type FoliateEventHandler = {
  onLoad?: (event: Event) => void;
  onRelocate?: (event: Event) => void;
};

export const useFoliateEvents = (view: FoliateView | null, handlers?: FoliateEventHandler) => {
  const onLoad = handlers?.onLoad;
  const onRelocate = handlers?.onRelocate;

  useEffect(() => {
    if (!view) return;

    if (onLoad) view.addEventListener('load', onLoad);
    if (onRelocate) view.addEventListener('relocate', onRelocate);

    return () => {
      if (onLoad) view.removeEventListener('load', onLoad);
      if (onRelocate) view.removeEventListener('relocate', onRelocate);
    };
  }, [view, onLoad, onRelocate, handlers]);
};
