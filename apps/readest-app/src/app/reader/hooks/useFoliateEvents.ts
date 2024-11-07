import { useEffect } from 'react';
import { FoliateView } from '@/app/reader/components/FoliateViewer';

type FoliateEventHandler = {
  onLoad?: (event: Event) => void;
  onRelocate?: (event: Event) => void;
  onDrawAnnotation?: (event: Event) => void;
  onShowAnnotation?: (event: Event) => void;
};

export const useFoliateEvents = (
  view: FoliateView | null,
  handlers?: FoliateEventHandler,
  dependencies: React.DependencyList = [],
) => {
  const onLoad = handlers?.onLoad;
  const onRelocate = handlers?.onRelocate;
  const onDrawAnnotation = handlers?.onDrawAnnotation;
  const onShowAnnotation = handlers?.onShowAnnotation;

  useEffect(() => {
    if (!view) return;
    if (onLoad) view.addEventListener('load', onLoad);
    if (onRelocate) view.addEventListener('relocate', onRelocate);
    if (onDrawAnnotation) view.addEventListener('draw-annotation', onDrawAnnotation);
    if (onShowAnnotation) view.addEventListener('show-annotation', onShowAnnotation);

    return () => {
      if (onLoad) view.removeEventListener('load', onLoad);
      if (onRelocate) view.removeEventListener('relocate', onRelocate);
      if (onDrawAnnotation) view.removeEventListener('draw-annotation', onDrawAnnotation);
      if (onShowAnnotation) view.removeEventListener('show-annotation', onShowAnnotation);
    };
  }, [view, ...dependencies]);
};
