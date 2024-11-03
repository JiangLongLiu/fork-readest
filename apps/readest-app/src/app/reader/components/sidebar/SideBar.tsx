import clsx from 'clsx';
import React, { useState, useEffect } from 'react';

import { BookState, DEFAULT_BOOK_STATE, useReaderStore } from '@/store/readerStore';
import SidebarHeader from './Header';
import SidebarContent from './Content';
import TabNavigation from './TabNavigation';
import BookCard from './BookCard';
import useSidebar from '../../hooks/useSidebar';
import useDragBar from '../../hooks/useDragBar';

const MIN_SIDEBAR_WIDTH = 0.15;
const MAX_SIDEBAR_WIDTH = 0.45;

const SideBar: React.FC<{
  width: string;
  isPinned: boolean;
  onGoToLibrary: () => void;
  onOpenSplitView: () => void;
}> = ({ width, isPinned, onGoToLibrary, onOpenSplitView }) => {
  const [activeTab, setActiveTab] = useState('toc');
  const { books } = useReaderStore();
  const [bookState, setBookState] = useState<BookState | null>(null);
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  const { sideBarBookKey } = useReaderStore();
  const {
    sideBarWidth,
    isSideBarVisible,
    handleSideBarResize,
    handleSideBarTogglePin,
    setSideBarVisibility,
  } = useSidebar(width, isPinned);
  const { handleMouseDown } = useDragBar(handleSideBarResize, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);

  useEffect(() => {
    if (!books || !sideBarBookKey) return;
    const bookState = books[sideBarBookKey] || DEFAULT_BOOK_STATE;
    const { config } = bookState;
    setBookState(bookState);
    setCurrentHref(config?.href || null);
  }, [books, sideBarBookKey]);

  const handleClickOverlay = () => {
    setSideBarVisibility(false);
  };

  if (!sideBarBookKey || !bookState || !bookState.book || !bookState.bookDoc) {
    return null;
  }

  const { book, bookDoc } = bookState;

  return isSideBarVisible ? (
    <>
      <div
        className={clsx(
          'sidebar-container bg-base-200 z-20 h-full min-w-60 select-none',
          'rounded-window-top-left rounded-window-bottom-left',
          !isPinned && 'shadow-2xl',
        )}
        style={{
          width: `${sideBarWidth}`,
          maxWidth: `${MAX_SIDEBAR_WIDTH * 100}%`,
          position: isPinned ? 'relative' : 'absolute',
        }}
      >
        <SidebarHeader
          isPinned={isPinned}
          onGoToLibrary={onGoToLibrary}
          onOpenSplitView={onOpenSplitView}
          handleSideBarTogglePin={handleSideBarTogglePin}
        />
        <div className='border-b px-3'>
          <BookCard cover={book.coverImageUrl!} title={book.title} author={book.author} />
        </div>
        <SidebarContent
          activeTab={activeTab}
          bookDoc={bookDoc}
          currentHref={currentHref}
          sideBarBookKey={sideBarBookKey!}
        />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div
          className='drag-bar absolute right-0 top-0 h-full w-0.5 cursor-col-resize'
          onMouseDown={handleMouseDown}
        ></div>
      </div>
      {!isPinned && (
        <div className='overlay fixed inset-0 z-10 bg-black/20' onClick={handleClickOverlay} />
      )}
    </>
  ) : null;
};

export default SideBar;
