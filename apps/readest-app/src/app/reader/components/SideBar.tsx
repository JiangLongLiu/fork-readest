import React, { useState, useEffect } from 'react';
import {
  MdSearch,
  MdOutlinePushPin,
  MdPushPin,
  MdToc,
  MdEditNote,
  MdBookmarkBorder,
} from 'react-icons/md';
import { GiBookshelf } from 'react-icons/gi';

import BookCard from './BookCard';
import TOCView from './TOCView';
import { BookState, DEFAULT_BOOK_STATE, useReaderStore } from '@/store/readerStore';

const MIN_SIDEBAR_WIDTH = 0.15;
const MAX_SIDEBAR_WIDTH = 0.45;

const SideBar: React.FC<{
  bookKey: string;
  width: string;
  isVisible: boolean;
  isPinned: boolean;
  onSetVisibility: (visibility: boolean) => void;
  onTogglePin: () => void;
  onResize: (newWidth: string) => void;
  onGoToLibrary: () => void;
}> = ({
  bookKey,
  width,
  isPinned,
  isVisible,
  onTogglePin,
  onSetVisibility,
  onResize,
  onGoToLibrary,
}) => {
  const [activeTab, setActiveTab] = useState('toc');
  const { books } = useReaderStore();
  const [bookState, setBookState] = useState<BookState | null>(null);
  const [currentHref, setCurrentHref] = useState<string | null>(null);

  useEffect(() => {
    if (!books) return;
    const bookState = books[bookKey] || DEFAULT_BOOK_STATE;
    const { config } = bookState;
    setBookState(bookState);
    setCurrentHref(config?.href || null);
  }, [bookKey]);

  const handleClickOverlay = () => {
    onSetVisibility(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const newWidthPx = e.clientX;
    const width = `${Math.round((newWidthPx / window.innerWidth) * 10000) / 100}%`;
    const minWidthPx = MIN_SIDEBAR_WIDTH * window.innerWidth;
    const maxWidthPx = MAX_SIDEBAR_WIDTH * window.innerWidth;
    if (newWidthPx >= minWidthPx && newWidthPx <= maxWidthPx) {
      onResize(width);
    }
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  if (!bookState || !bookState.book || !bookState.bookDoc) {
    return null;
  }

  const { book, bookDoc } = bookState;

  return (
    isVisible && (
      <div
        className='sidebar-container bg-base-200 z-20 h-full select-none'
        style={{
          width: `${width}`,
          minWidth: `${MIN_SIDEBAR_WIDTH * 100}%`,
          maxWidth: `${MAX_SIDEBAR_WIDTH * 100}%`,
          position: isPinned ? 'relative' : 'absolute',
        }}
      >
        <div className={'sidebar h-full'}>
          <div className='flex h-10 items-center justify-between pl-1.5 pr-3'>
            <div className='flex items-center'>
              <button className='btn btn-ghost h-8 min-h-8 w-8 p-0' onClick={onGoToLibrary}>
                <GiBookshelf size={20} className='fill-base-content' />
              </button>
            </div>
            <div className='flex size-[30%] min-w-20 items-center justify-between'>
              <button className='btn btn-ghost left-0 h-8 min-h-8 w-8 p-0'>
                <MdSearch size={20} className='fill-base-content' />
              </button>
              <button
                onClick={onTogglePin}
                className={`${isPinned ? 'bg-gray-300' : 'bg-base-300'} btn btn-ghost btn-circle right-0 h-6 min-h-6 w-6`}
              >
                {isPinned ? <MdPushPin size={14} /> : <MdOutlinePushPin size={14} />}
              </button>
            </div>
          </div>
          <div className='border-b px-3'>
            <BookCard cover={book.coverImageUrl!} title={book.title} author={book.author} />
          </div>
          <div className='sidebar-content overflow-y-auto border-b shadow-inner'>
            {activeTab === 'toc' && bookDoc!.toc && (
              <TOCView toc={bookDoc!.toc} bookKey={bookKey} currentHref={currentHref} />
            )}
            {activeTab === 'bookmarks' && <div>Bookmarks</div>}
            {activeTab === 'annotations' && <div>Annotations</div>}
          </div>
          <div className='bottom-tab absolute bottom-0 flex w-full'>
            <button
              className={`m-1.5 flex-1 rounded-md p-2 ${activeTab === 'toc' ? 'bg-base-300' : ''}`}
              onClick={() => setActiveTab('toc')}
            >
              <MdToc size={20} className='mx-auto' />
            </button>
            <button
              className={`m-1.5 flex-1 rounded-md p-2 ${activeTab === 'annotations' ? 'bg-base-300' : ''}`}
              onClick={() => setActiveTab('annotations')}
            >
              <MdEditNote size={20} className='mx-auto' />
            </button>
            <button
              className={`m-1.5 flex-1 rounded-md p-2 ${activeTab === 'bookmarks' ? 'bg-base-300' : ''}`}
              onClick={() => setActiveTab('bookmarks')}
            >
              <MdBookmarkBorder size={20} className='mx-auto' />
            </button>
          </div>
          <div
            className='drag-bar absolute right-0 top-0 h-full w-0.5 cursor-col-resize'
            onMouseDown={handleMouseDown}
          ></div>
        </div>
        {!isPinned && (
          <div
            className='overlay fixed top-0'
            style={{
              left: width,
              width: `calc(100% - ${width})`,
              height: '100%',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
            onClick={() => handleClickOverlay()}
          />
        )}
      </div>
    )
  );
};

export default SideBar;
