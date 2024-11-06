import React, { useState, useEffect } from 'react';
import { FiSearch } from 'react-icons/fi';
import { FiCopy } from 'react-icons/fi';
import { PiHighlighterFill } from 'react-icons/pi';
import { FaWikipediaW } from 'react-icons/fa';
import { BsPencilSquare } from 'react-icons/bs';

import { useEnv } from '@/context/EnvContext';
import { BookNote } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import { useFoliateEvents } from '../../hooks/useFoliateEvents';
import { getPosition, Position } from '@/utils/sel';
import useOutsideClick from '@/hooks/useOutsideClick';
import PopupButton from './PopupButton';
import HighlightOptions from './HighlightOptions';

interface TextSelection {
  text: string;
  range: Range;
  sel: Selection;
  index: number;
}

const Annotator: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const { envConfig } = useEnv();
  const { books, settings, saveConfig, updateBooknotes, getFoliateView } = useReaderStore();
  const globalReadSettings = settings.globalReadSettings;
  const bookState = books[bookKey]!;
  const config = bookState.config!;
  const progress = bookState.progress!;

  const [selection, setSelection] = useState<TextSelection | null>();
  const [showPopup, setShowPopup] = useState(false);
  const [isPopupAbove, setIsPopupAbove] = useState(false);
  const [trianglePosition, setTrianglePosition] = useState<Position>();
  const [popupPosition, setPopupPosition] = useState<Position>();
  const [toastMessage, setToastMessage] = useState('');
  const [highlightOptionsVisible, setHighlightOptionsVisible] = useState(false);

  const popupWidthPx = 240;
  const popupHeightPx = 44;
  const popupPaddingPx = 10;
  const highlightOptionsHeightPx = 28;
  const highlightOptionsPaddingPx = 16;

  const docLoadHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { doc, index } = detail;

    const handlePointerup = () => {
      const sel = doc.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        setSelection({ text: sel.toString(), range: sel.getRangeAt(0), sel, index });
      }
    };
    if (detail.doc) {
      detail.doc.addEventListener('pointerup', handlePointerup);
    }
  };

  const popupRef = useOutsideClick<HTMLDivElement>(() => {
    setShowPopup(false);
    setSelection(null);
  });
  useFoliateEvents(getFoliateView(bookKey), { onLoad: docLoadHandler });

  useEffect(() => {
    setHighlightOptionsVisible(false);
    if (selection && selection.text.trim().length > 0) {
      const gridFrame = document.querySelector(`#gridcell-${bookKey}`);
      if (!gridFrame) return;
      const offset = {
        x: gridFrame.getBoundingClientRect().left,
        y: gridFrame.getBoundingClientRect().top,
      };
      const gridFrameRect = gridFrame.getBoundingClientRect();
      const position = getPosition(selection.range, offset);

      if (position.dir === 'up') {
        position.point.y -= 12;
        setIsPopupAbove(true);
      } else {
        position.point.y += 0;
        setIsPopupAbove(false);
      }

      const popupPoint = {
        x: position.point.x - popupWidthPx / 2,
        y: position.dir === 'up' ? position.point.y - popupHeightPx : position.point.y + 6,
      };

      if (popupPoint.x + popupWidthPx > gridFrameRect.right - offset.x - popupPaddingPx) {
        popupPoint.x = gridFrameRect.right - offset.x - popupPaddingPx - popupWidthPx;
      }
      if (popupPoint.x < gridFrameRect.left - offset.x + popupPaddingPx) {
        popupPoint.x = gridFrameRect.left - offset.x + popupPaddingPx;
      }
      if (popupPoint.y + popupHeightPx > gridFrameRect.bottom - offset.y - popupPaddingPx) {
        popupPoint.y = gridFrameRect.bottom - offset.y - popupPaddingPx - popupHeightPx;
      }
      if (popupPoint.y < gridFrameRect.top - offset.y + popupPaddingPx) {
        popupPoint.y = gridFrameRect.top - offset.y + popupPaddingPx;
      }

      setPopupPosition({ point: popupPoint });
      setTrianglePosition(position);
      setShowPopup(true);
    }
  }, [selection, bookKey]);

  useEffect(() => {
    const timer = setTimeout(() => setToastMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleCopy = () => {
    setShowPopup(false);
    setToastMessage('Copied to clipboard');
    if (selection) navigator.clipboard.writeText(selection.text);
  };

  const handleHighlight = () => {
    if (!selection || !selection.text) return;
    setHighlightOptionsVisible(true);
    const { booknotes: annotations = [] } = config;
    const { tocHref: href } = progress;
    const cfi = getFoliateView(bookKey)?.getCFI(selection.index, selection.range);
    if (!cfi) return;
    const annotation: BookNote = {
      type: 'annotation',
      cfi,
      href,
      style: globalReadSettings.highlightStyle,
      color: globalReadSettings.highlightStyles[globalReadSettings.highlightStyle],
      text: selection.text,
      note: '',
      created: Date.now(),
    };
    const existingIndex = annotations.findIndex(
      (annotation) => annotation.cfi === cfi && annotation.type === 'annotation',
    );
    if (existingIndex !== -1) {
      annotations[existingIndex] = annotation;
    } else {
      annotations.push(annotation);
    }

    const dedupedAnnotations = Array.from(
      new Map(
        annotations.map((annotation) => [`${annotation.type}-${annotation.cfi}`, annotation]),
      ).values(),
    );

    const updatedConfig = updateBooknotes(bookKey, dedupedAnnotations);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }
  };
  const handleAnnotate = () => {};
  const handleSearch = () => {};
  const handleDictionary = () => {};

  const buttons = [
    { tooltipText: 'Copy', Icon: FiCopy, onClick: handleCopy },
    { tooltipText: 'Highlight', Icon: PiHighlighterFill, onClick: handleHighlight },
    { tooltipText: 'Annotate', Icon: BsPencilSquare, onClick: handleAnnotate },
    { tooltipText: 'Search', Icon: FiSearch, onClick: handleSearch },
    { tooltipText: 'Dictionary', Icon: FaWikipediaW, onClick: handleDictionary },
  ];

  return (
    <div ref={popupRef}>
      {showPopup && trianglePosition && popupPosition && (
        <div>
          <div
            className='triangle absolute'
            style={{
              left: `${trianglePosition.point.x}px`,
              top: `${trianglePosition.point.y}px`,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: isPopupAbove ? 'none' : '6px solid #465563',
              borderTop: isPopupAbove ? '6px solid #465563' : 'none',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            className='selection-popup absolute rounded-lg bg-gray-600 px-4 text-white shadow-lg'
            style={{
              width: `${popupWidthPx}px`,
              height: `${popupHeightPx}px`,
              left: `${popupPosition.point.x}px`,
              top: `${popupPosition.point.y}px`,
            }}
          >
            <div className='flex h-11 items-center justify-between'>
              {buttons.map((button, index) => (
                <PopupButton
                  key={index}
                  tooltipText={button.tooltipText}
                  Icon={button.Icon}
                  onClick={button.onClick}
                />
              ))}
            </div>
          </div>
          {highlightOptionsVisible && (
            <HighlightOptions
              onHandleHighlight={handleHighlight}
              style={{
                width: `${popupWidthPx}px`,
                height: `${popupHeightPx}px`,
                left: `${popupPosition.point.x}px`,
                top: `${
                  popupPosition.point.y +
                  (highlightOptionsHeightPx + highlightOptionsPaddingPx) * (isPopupAbove ? -1 : 1)
                }px`,
              }}
            />
          )}
        </div>
      )}
      {toastMessage && (
        <div className='toast toast-center toast-middle'>
          <div className='alert flex items-center justify-center border-0 bg-gray-600 text-white'>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Annotator;
