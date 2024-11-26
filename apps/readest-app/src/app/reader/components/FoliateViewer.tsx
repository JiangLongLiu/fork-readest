import React, { useEffect, useRef, useState } from 'react';
import { useFoliateEvents } from '../hooks/useFoliateEvents';
import { BookDoc } from '@/libs/document';
import { BookConfig, BookNote, BookSearchConfig, BookSearchResult } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import { useParallelViewStore } from '@/store/parallelViewStore';
import { getStyles } from '@/utils/style';
import { useTheme } from '@/hooks/useTheme';
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
  history: {
    canGoBack: boolean;
    canGoForward: boolean;
    back: () => void;
    forward: () => void;
    clear: () => void;
  };
  renderer: {
    scrolled?: boolean;
    viewSize: number;
    setAttribute: (name: string, value: string | number) => void;
    removeAttribute: (name: string) => void;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    scrollTo?: (offset: number, reason: string, smooth: boolean) => void;
    setStyles?: (css: string) => void;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
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
  const isScrolling = useRef(false);
  const { getView, setView: setFoliateView, setProgress, getViewSettings } = useReaderStore();
  const { getParallels } = useParallelViewStore();
  const { themeCode } = useTheme();

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
        detail.doc.addEventListener('keydown', handleKeydown.bind(null, bookKey));
        detail.doc.addEventListener('mousedown', handleMousedown.bind(null, bookKey));
        detail.doc.addEventListener('mouseup', handleMouseup.bind(null, bookKey));
        detail.doc.addEventListener('click', handleClick.bind(null, bookKey));
      }
    }
  };

  const docScrollHandler = (event: Event) => {
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
    if (isScrolling.current) return;
    isScrolling.current = true;

    const detail = (event as CustomEvent).detail;
    if (detail.reason === 'follow-scroll') return;
    if (!viewRef.current!.renderer.scrolled) return;
    const parallelViews = getParallels(bookKey);
    if (parallelViews && parallelViews.size > 0) {
      parallelViews.forEach((key) => {
        if (key !== bookKey) {
          const target = getView(key)?.renderer;
          if (target && target.scrolled && target.viewSize) {
            target.scrollTo?.(detail.fraction * target.viewSize, 'follow-scroll', true);
          }
        }
      });
    }
  };

  const handleClickTurnPage = (msg: MessageEvent) => {
    if (msg.data && msg.data.type === 'iframe-single-click' && msg.data.bookKey === bookKey) {
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
    onRendererRelocate: docScrollHandler,
  });

  useEffect(() => {
    if (viewRef.current && viewRef.current.renderer) {
      const viewSettings = getViewSettings(bookKey)!;
      viewRef.current.renderer.setStyles?.(getStyles(viewSettings, themeCode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeCode]);

  useEffect(() => {
    if (isViewCreated.current) return;
    isViewCreated.current = true;

    const openBook = async () => {
      console.log('Opening book', bookKey);
      await import('foliate-js/view.js');
      const view = wrappedFoliateView(document.createElement('foliate-view') as FoliateView);
      document.body.append(view);
      containerRef.current?.appendChild(view);
      setFoliateView(bookKey, view);

      await view.open(bookDoc);
      // make sure we can listen renderer events after opening book
      viewRef.current = view;
      const viewSettings = getViewSettings(bookKey)!;
      view.renderer.setStyles?.(getStyles(viewSettings, themeCode));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewInited]);

  return <div className='foliate-viewer h-[100%] w-[100%]' ref={containerRef} />;
};

export default FoliateViewer;
