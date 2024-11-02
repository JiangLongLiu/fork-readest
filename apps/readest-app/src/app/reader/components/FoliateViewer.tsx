import React, { useEffect, useRef, useState } from 'react';
import { useFoliateEvents } from '../hooks/useFoliateEvents';
import { BookDoc } from '@/libs/document';
import { BookConfig } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import { getStyles } from '@/utils/style';

export interface FoliateView extends HTMLElement {
  open: (book: BookDoc) => Promise<void>;
  close: () => void;
  init: (options: { lastLocation: string }) => void;
  goTo: (href: string) => void;
  goToFraction: (fraction: number) => void;
  goLeft: () => void;
  goRight: () => void;
  renderer: {
    setStyles?: (css: string) => void;
    setAttribute: (name: string, value: string | number) => void;
    removeAttribute: (name: string) => void;
    next: () => Promise<void>;
    prev: () => Promise<void>;
  };
}

const FoliateViewer: React.FC<{
  bookKey: string;
  bookDoc: BookDoc;
  bookConfig: BookConfig;
}> = ({ bookKey, bookDoc, bookConfig }) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<FoliateView | null>(null);
  const isViewCreated = useRef(false);
  const { setFoliateView } = useReaderStore();
  const setProgress = useReaderStore((state) => state.setProgress);

  const progressRelocateHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    // console.log('relocate:', detail);
    setProgress(
      bookKey,
      detail.fraction,
      detail.cfi,
      detail.tocItem?.href,
      detail.tocItem?.label,
      detail.section,
      detail.location,
    );
  };

  const handleKeydown = (event: KeyboardEvent) => {
    window.postMessage(
      {
        type: 'iframe-keydown',
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      },
      '*',
    );
  };

  const handleMousedown = (event: MouseEvent) => {
    window.postMessage(
      {
        type: 'iframe-mousedown',
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      },
      '*',
    );
  };

  const docLoadHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail.doc) {
      if (!detail.doc.isEventListenersAdded) {
        detail.doc.addEventListener('keydown', handleKeydown);
        detail.doc.addEventListener('mousedown', handleMousedown);
        detail.doc.isEventListenersAdded = true;
      }
    }
  };

  useFoliateEvents(view, { onLoad: docLoadHandler, onRelocate: progressRelocateHandler });

  useEffect(() => {
    if (isViewCreated.current) return;
    const openBook = async () => {
      console.log('Opening book', bookKey);
      await import('foliate-js/view.js');
      const view = document.createElement('foliate-view') as FoliateView;
      document.body.append(view);
      viewRef.current?.appendChild(view);
      setView(view);
      setFoliateView(bookKey, view);

      await view.open(bookDoc);
      const viewSettings = bookConfig.viewSettings!;
      view.renderer.setStyles?.(getStyles(bookConfig));
      const isScrolled = viewSettings.scrolled!;
      const marginPx = viewSettings.marginPx!;
      const gapPercent = viewSettings.gapPercent!;
      const animated = viewSettings.animated!;
      const maxColumnCount = viewSettings.maxColumnCount!;
      const maxInlineSize = viewSettings.maxInlineSize!;
      const maxBlockSize = viewSettings.maxBlockSize!;
      if (animated) {
        view.renderer.setAttribute('animated', '');
      } else {
        view.renderer.removeAttribute('animated');
      }
      view.renderer.setAttribute('animated', animated ? 'animated' : '');
      view.renderer.setAttribute('flow', isScrolled ? 'scrolled' : 'paginated');
      view.renderer.setAttribute('margin', `${marginPx}px`);
      view.renderer.setAttribute('gap', `${gapPercent}%`);
      view.renderer.setAttribute('max-column-count', maxColumnCount);
      view.renderer.setAttribute('max-inline-size', `${maxInlineSize}px`);
      view.renderer.setAttribute('max-block-size', `${maxBlockSize}px`);

      const lastLocation = bookConfig.location;
      if (lastLocation) {
        view.init({ lastLocation });
      } else {
        view.goToFraction(0);
      }
    };

    openBook();
    isViewCreated.current = true;

    return () => {
      console.log('Closing book', bookKey);
      view?.close();
      view?.remove();
    };
  }, []);

  return <div className='foliate-viewer h-[100%] w-[100%]' ref={viewRef} />;
};

export default FoliateViewer;
