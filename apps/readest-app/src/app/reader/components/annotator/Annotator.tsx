import React, { useState, useEffect } from 'react';
import { FiSearch } from 'react-icons/fi';
import { FiCopy } from 'react-icons/fi';
import { PiHighlighterFill } from 'react-icons/pi';
import { FaWikipediaW } from 'react-icons/fa';
import { BsPencilSquare } from 'react-icons/bs';
import { RiDeleteBinLine } from 'react-icons/ri';

import { Overlayer } from 'foliate-js/overlayer.js';
import { useEnv } from '@/context/EnvContext';
import { BookNote, HighlightColor, HighlightStyle } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import { useFoliateEvents } from '../../hooks/useFoliateEvents';
import { getPopupPosition, getPosition, Position } from '@/utils/sel';
import Toast from '@/components/Toast';
import useOutsideClick from '@/hooks/useOutsideClick';
import AnnotationPopup from './AnnotationPopup';

interface TextSelection {
  annotated?: boolean;
  text: string;
  range: Range;
  index: number;
}

const Annotator: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const { envConfig } = useEnv();
  const { settings, getConfig, saveConfig, getProgress, updateBooknotes, getView } =
    useReaderStore();
  const globalReadSettings = settings.globalReadSettings;
  const config = getConfig(bookKey)!;
  const progress = getProgress(bookKey)!;
  const view = getView(bookKey);

  const [selection, setSelection] = useState<TextSelection | null>();
  const [showPopup, setShowPopup] = useState(false);
  const [trianglePosition, setTrianglePosition] = useState<Position>();
  const [popupPosition, setPopupPosition] = useState<Position>();
  const [toastMessage, setToastMessage] = useState('');
  const [highlightOptionsVisible, setHighlightOptionsVisible] = useState(false);

  const [selectedStyle, setSelectedStyle] = useState<HighlightStyle>(
    globalReadSettings.highlightStyle,
  );
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(
    globalReadSettings.highlightStyles[selectedStyle],
  );

  const popupWidth = 240;
  const popupHeight = 44;
  const popupPadding = 10;

  const onLoad = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { doc, index } = detail;
    const handlePointerup = () => {
      const sel = doc.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        setSelection({ text: sel.toString(), range: sel.getRangeAt(0), index });
      }
    };
    detail.doc?.addEventListener('pointerup', handlePointerup);
  };

  const onDrawAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { draw, annotation, doc, range } = detail;
    const { style, color } = annotation as BookNote;
    if (style === 'highlight') {
      draw(Overlayer.highlight, { color });
    } else if (['underline', 'squiggly'].includes(style as string)) {
      const { defaultView } = doc;
      const node = range.startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const { writingMode } = defaultView.getComputedStyle(el);
      draw(Overlayer[style as keyof typeof Overlayer], { writingMode, color });
    }
  };

  const onShowAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { value: cfi, index, range } = detail;
    const { booknotes = [] } = config;
    const annotations = booknotes.filter((booknote) => booknote.type === 'annotation');
    const annotation = annotations.find((annotation) => annotation.cfi === cfi);
    if (!annotation) return;
    const selection = { annotated: true, text: annotation.text, range, index };
    setSelectedStyle(annotation.style!);
    setSelectedColor(annotation.color!);
    setSelection(selection as TextSelection);
  };

  useFoliateEvents(view, { onLoad, onDrawAnnotation, onShowAnnotation }, [config]);

  const popupRef = useOutsideClick<HTMLDivElement>(() => {
    setShowPopup(false);
    setSelection(null);
  });

  useEffect(() => {
    setHighlightOptionsVisible(!!(selection && selection.annotated));
    if (selection && selection.text.trim().length > 0) {
      const gridFrame = document.querySelector(`#gridcell-${bookKey}`);
      if (!gridFrame) return;
      const rect = gridFrame.getBoundingClientRect();
      const triangPos = getPosition(selection.range, rect);
      const popupPos = getPopupPosition(triangPos, rect, popupWidth, popupHeight, popupPadding);
      setShowPopup(true);
      setPopupPosition(popupPos);
      setTrianglePosition(triangPos);
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

  const handleHighlight = (update = false) => {
    if (!selection || !selection.text) return;
    setHighlightOptionsVisible(true);
    const { booknotes: annotations = [] } = config;
    const { tocHref: href } = progress;
    const cfi = view?.getCFI(selection.index, selection.range);
    if (!cfi) return;
    const style = globalReadSettings.highlightStyle;
    const color = globalReadSettings.highlightStyles[style];
    const text = selection.text;
    const type = 'annotation';
    const created = Date.now();
    const note = '';
    const annotation: BookNote = { type, cfi, href, style, color, text, note, created };
    const existingIndex = annotations.findIndex(
      (annotation) => annotation.cfi === cfi && annotation.type === 'annotation',
    );
    if (existingIndex !== -1) {
      view?.addAnnotation(annotation, true);
      if (update) {
        annotations[existingIndex] = annotation;
        view?.addAnnotation(annotation);
      } else {
        annotations.splice(existingIndex, 1);
        setShowPopup(false);
      }
    } else {
      annotations.push(annotation);
      view?.addAnnotation(annotation);
      setSelection({ ...selection, annotated: true });
    }

    const dedupedAnnotations = Array.from(
      new Map(annotations.map((item) => [`${item.type}-${item.cfi}`, item])).values(),
    );
    const updatedConfig = updateBooknotes(bookKey, dedupedAnnotations);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }
  };
  const handleAnnotate = () => {};
  const handleSearch = () => {};
  const handleDictionary = () => {};

  const selectionAnnotated = selection?.annotated;
  const buttons = [
    { tooltipText: 'Copy', Icon: FiCopy, onClick: handleCopy },
    {
      tooltipText: selectionAnnotated ? 'Delete Highlight' : 'Highlight',
      Icon: selectionAnnotated ? RiDeleteBinLine : PiHighlighterFill,
      onClick: handleHighlight,
    },
    { tooltipText: 'Annotate', Icon: BsPencilSquare, onClick: handleAnnotate },
    { tooltipText: 'Search', Icon: FiSearch, onClick: handleSearch },
    { tooltipText: 'Dictionary', Icon: FaWikipediaW, onClick: handleDictionary },
  ];

  return (
    <div ref={popupRef}>
      {showPopup && trianglePosition && popupPosition && (
        <AnnotationPopup
          buttons={buttons}
          position={popupPosition}
          trianglePosition={trianglePosition}
          highlightOptionsVisible={highlightOptionsVisible}
          selectedStyle={selectedStyle}
          selectedColor={selectedColor}
          popupWidth={popupWidth}
          popupHeight={popupHeight}
          onHighlight={handleHighlight}
        />
      )}
      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
};

export default Annotator;
