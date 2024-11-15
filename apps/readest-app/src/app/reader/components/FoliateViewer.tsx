import React, { useEffect, useRef, useState } from 'react';
import { useFoliateEvents } from '../hooks/useFoliateEvents';
import { BookDoc } from '@/libs/document';
import { BookConfig, BookNote, BookSearchConfig, BookSearchResult } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import { getStyles } from '@/utils/style';
import { ONE_COLUMN_MAX_INLINE_SIZE } from '@/services/constants';
import {
  handleKeydown,
  handleMousedown,
  handleClick,
  handleMouseup,
} from '../utils/iframeEventHandlers';
import { eventDispatcher } from '@/utils/event';

export interface FoliateView extends HTMLElement {
  open: (book: BookDoc) => Promise<void>;
  close: () => void;
  init: (options: { lastLocation: string }) => void;
  goTo: (href: string) => void;
  goToFraction: (fraction: number) => void;
  prev: (distance: number) => void;
  next: (distance: number) => void;
  goLeft: () => void;
  goRight: () => void;
  getCFI: (index: number, range: Range) => string;
  addAnnotation: (note: BookNote, remove?: boolean) => { index: number; label: string };
  search: (config: BookSearchConfig) => AsyncGenerator<BookSearchResult | string, void, void>;
  clearSearch: () => void;
  select: (target: string | number | { fraction: number }) => void;
  deselect: () => void;
  renderer: {
    setStyles?: (css: string) => void;
    setAttribute: (name: string, value: string | number) => void;
    removeAttribute: (name: string) => void;
    next: () => Promise<void>;
    prev: () => Promise<void>;
  };
}

const wrappedFoliateView = (originalView: FoliateView): FoliateView => {
  const originalAddAnnotation = originalView.addAnnotation.bind(originalView);
  originalView.addAnnotation = (note: BookNote, remove = false) => {
    // transform BookNote to foliate annotation
    const annotation = {
      value: note.cfi,
      ...note,
    };
    return originalAddAnnotation(annotation, remove);
  };
  return originalView;
};

const FoliateViewer: React.FC<{
  bookKey: string;
  bookDoc: BookDoc;
  config: BookConfig;
}> = ({ bookKey, bookDoc, config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoliateView | null>(null);
  const [viewInited, setViewInited] = useState(false);
  const isViewCreated = useRef(false);
  const { setView: setFoliateView, setProgress, getViewSettings } = useReaderStore();

  const progressRelocateHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    // console.log('relocate:', detail);
    setProgress(bookKey, detail.cfi, detail.tocItem, detail.section, detail.location, detail.range);
  };

  const docLoadHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail.doc) {
      if (!detail.doc.isEventListenersAdded) {
        detail.doc.isEventListenersAdded = true;
        detail.doc.addEventListener('keydown', handleKeydown);
        detail.doc.addEventListener('mousedown', handleMousedown);
        detail.doc.addEventListener('mouseup', handleMouseup);
        detail.doc.addEventListener('click', handleClick);
      }
    }
  };

  const handleClickTurnPage = (msg: MessageEvent) => {
    if (msg.data && msg.data.type === 'iframe-single-click') {
      const viewElement = containerRef.current;
      if (viewElement) {
        const rect = viewElement.getBoundingClientRect();
        const { screenX } = msg.data;

        const eventConsumed = eventDispatcher.dispatchSync('iframe-single-click', { screenX });
        if (!eventConsumed) {
          if (screenX >= rect.left + rect.width / 2) {
            viewRef.current?.goRight();
          } else if (screenX < rect.left + rect.width / 2) {
            viewRef.current?.goLeft();
          }
        }
      }
    }
  };

  useFoliateEvents(viewRef.current, {
    onLoad: docLoadHandler,
    onRelocate: progressRelocateHandler,
  });

  useEffect(() => {
    if (isViewCreated.current) return;
    const openBook = async () => {
      console.log('Opening book', bookKey);
      await import('foliate-js/view.js');
      const view = wrappedFoliateView(document.createElement('foliate-view') as FoliateView);
      document.body.append(view);
      containerRef.current?.appendChild(view);
      viewRef.current = view;
      setFoliateView(bookKey, view);

      await view.open(bookDoc);
      const viewSettings = getViewSettings(bookKey)!;
      view.renderer.setStyles?.(getStyles(viewSettings));
      const isScrolled = viewSettings.scrolled!;
      const marginPx = viewSettings.marginPx!;
      const gapPercent = viewSettings.gapPercent!;
      const animated = viewSettings.animated!;
      const maxColumnCount = viewSettings.maxColumnCount!;
      const maxInlineSize =
        maxColumnCount === 1 ? ONE_COLUMN_MAX_INLINE_SIZE : viewSettings.maxInlineSize!;
      const maxBlockSize = viewSettings.maxBlockSize!;
      if (animated) {
        view.renderer.setAttribute('animated', '');
      } else {
        view.renderer.removeAttribute('animated');
      }
      view.renderer.setAttribute('flow', isScrolled ? 'scrolled' : 'paginated');
      view.renderer.setAttribute('margin', `${marginPx}px`);
      view.renderer.setAttribute('gap', `${gapPercent}%`);
      view.renderer.setAttribute('max-column-count', maxColumnCount);
      view.renderer.setAttribute('max-inline-size', `${maxInlineSize}px`);
      view.renderer.setAttribute('max-block-size', `${maxBlockSize}px`);

      const lastLocation = config.location;
      if (lastLocation) {
        await view.init({ lastLocation });
      } else {
        await view.goToFraction(0);
      }
      setViewInited(true);

      window.addEventListener('message', handleClickTurnPage);
    };

    openBook();
    isViewCreated.current = true;

    return () => {
      console.log('Closing book', bookKey);
      viewRef.current?.close();
      viewRef.current?.remove();
    };
  }, []);

  const initAnnotations = () => {
    const { booknotes = [] } = config;
    const annotations = booknotes.filter((item) => item.type === 'annotation' && item.style);
    try {
      Promise.all(annotations.map((annotation) => viewRef.current?.addAnnotation(annotation)));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (viewInited) {
      initAnnotations();
    }
  }, [viewInited]);

  return <div className='foliate-viewer h-[100%] w-[100%]' ref={containerRef} />;
};

export default FoliateViewer;
