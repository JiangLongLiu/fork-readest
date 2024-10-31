import React, { useEffect, useRef, useState } from 'react';
import { useFoliateEvents } from '../hooks/useFoliateEvents';
import { BookDoc } from '@/libs/document';
import { BookConfig } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';

const getCSS = (spacing: number, justify: boolean, hyphenate: boolean) => `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
        color-scheme: light dark;
    }
    /* https://github.com/whatwg/html/issues/5426 */
    @media (prefers-color-scheme: dark) {
        a:link {
            color: lightblue;
        }
    }
    p, li, blockquote, dd {
        line-height: ${spacing};
        text-align: ${justify ? 'justify' : 'start'};
        -webkit-hyphens: ${hyphenate ? 'auto' : 'manual'};
        hyphens: ${hyphenate ? 'auto' : 'manual'};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
`;

export interface FoliateView extends HTMLElement {
  open: (book: BookDoc) => Promise<void>;
  close: () => void;
  init: (options: { lastLocation: string }) => void;
  goTo: (href: string) => void;
  goToFraction: (fraction: number) => void;
  goLeft: () => void;
  goRight: () => void;
  renderer: {
    setStyles: (css: string) => void;
    setAttribute: (name: string, value: string | number) => void;
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
      if ('setStyles' in view.renderer) {
        const lineHeight = viewSettings.lineHeight!;
        const justify = viewSettings.justify!;
        const hyphenate = viewSettings.hyphenate!;
        view.renderer.setStyles(getCSS(lineHeight, justify, hyphenate));
      }
      const isScrolled = viewSettings.scrolled!;
      const gap = viewSettings.gap!;
      view.renderer.setAttribute('flow', isScrolled ? 'scrolled' : 'paginated');
      view.renderer.setAttribute('margin', '44px');
      view.renderer.setAttribute('gap', `${gap * 100}%`);
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

  const handleTap = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const { clientX } = event;
    const width = window.innerWidth;
    const leftThreshold = width * 0.5;
    const rightThreshold = width * 0.5;

    if (clientX < leftThreshold) {
      view?.renderer.prev();
    } else if (clientX > rightThreshold) {
      view?.renderer.next();
    }
  };

  return <div className='foliate-viewer h-[100%] w-[100%]' ref={viewRef} onClick={handleTap} />;
};

export default FoliateViewer;
