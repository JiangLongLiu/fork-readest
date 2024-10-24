import { useEffect } from 'react';
import { FoliateView } from '@/app/reader/components/FoliateViewer';
import { useReaderStore } from '@/store/readerStore';

type FoliateEventHandler = {
  onLoad?: (event: Event) => void;
  onRelocate?: (event: Event) => void;
};

export const useFoliateEvents = (
  bookKey: string,
  view: FoliateView | null,
  handlers?: FoliateEventHandler,
) => {
  const setProgress = useReaderStore((state) => state.setProgress);

  const defaultLoadHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    console.log('load event:', detail);
  };

  const defaultRelocateHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    console.log('relocate:', detail);
    setProgress(
      bookKey,
      detail.fraction,
      detail.cfi,
      detail.tocItem?.href,
      detail.section,
      detail.location,
    );
  };

  const onLoad = handlers?.onLoad || defaultLoadHandler;
  const onRelocate = handlers?.onRelocate || defaultRelocateHandler;

  useEffect(() => {
    if (!view) return;

    view.addEventListener('load', onLoad);
    view.addEventListener('relocate', onRelocate);

    return () => {
      view.removeEventListener('load', onLoad);
      view.removeEventListener('relocate', onRelocate);
    };
  }, [view, onLoad, onRelocate, handlers]);
};
