'use client';

import React, { useEffect, useRef } from 'react';
import { BookDoc } from '@/libs/document';

type FoliateViewerProps = {
  book: BookDoc | null;
};

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

const FoliateViewer: React.FC<FoliateViewerProps> = ({ book }) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const isViewCreated = useRef(false);

  useEffect(() => {
    if (isViewCreated.current) return;
    const openBook = async () => {
      await import('foliate-js/view.js');
      const view = document.createElement('foliate-view');
      document.body.append(view);
      viewRef.current?.appendChild(view);

      console.log('Open the book with foliate-view:', book);
      await view.open(book);
      if ('setStyles' in view.renderer) {
        view.renderer.setStyles(getCSS(1.4, true, true));
      }
      await view.renderer.next();
    };

    openBook();
    isViewCreated.current = true;
  }, [book]);

  const handleTap = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const { clientX } = event;
    const width = window.innerWidth;
    const leftThreshold = width * 0.5;
    const rightThreshold = width * 0.5;

    const existingView = viewRef.current?.querySelector('foliate-view');
    if (clientX < leftThreshold) {
      existingView?.renderer?.prev();
    } else if (clientX > rightThreshold) {
      existingView?.renderer?.next();
    }
  };

  return <div ref={viewRef} onClick={handleTap} />;
};

export default FoliateViewer;
