import { Book } from '@/types/book';
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

import { TOCItem } from '@/libs/document';
import BookCard from './BookCard';
import TOCView from './TOCView';

const MIN_SIDEBAR_WIDTH = 0.15;
const MAX_SIDEBAR_WIDTH = 0.45;

const SideBar: React.FC<{
  book: Book;
  tocData: TOCItem[];
  currentHref: string | null;
  width: string;
  isVisible: boolean;
  isPinned: boolean;
  onSetVisibility: (visibility: boolean) => void;
  onTogglePin: () => void;
  onResize: (newWidth: string) => void;
  onGoToLibrary: () => void;
}> = ({
  book,
  tocData,
  currentHref,
  width,
  isPinned,
  isVisible,
  onTogglePin,
  onSetVisibility,
  onResize,
  onGoToLibrary,
}) => {
  const [activeTab, setActiveTab] = useState('toc');

  useEffect(() => {}, [isPinned, isVisible]);

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

  return (
    isVisible && (
      <div
        className='sidebar-container z-20 h-full bg-gray-200'
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
                <GiBookshelf size={20} className='text-gray-600' />
              </button>
            </div>
            <div className='flex size-[30%] min-w-20 items-center justify-between'>
              <button className='btn btn-ghost left-0 h-8 min-h-8 w-8 p-0'>
                <MdSearch size={20} className='text-gray-600' />
              </button>
              <button
                onClick={onTogglePin}
                className={`${isPinned ? 'bg-gray-400' : 'bg-gray-300'} btn btn-ghost btn-circle right-0 h-6 min-h-6 w-6`}
              >
                {isPinned ? <MdPushPin size={14} /> : <MdOutlinePushPin size={14} />}
              </button>
            </div>
          </div>
          <div className='border-b px-3 shadow-sm'>
            <BookCard cover={book.coverImageUrl!} title={book.title} author={book.author} />
          </div>
          <div className='sidebar-content overflow-y-auto'>
            {activeTab === 'toc' && (
              <TOCView toc={tocData} bookId={book.hash} currentHref={currentHref} />
            )}
            {activeTab === 'bookmarks' && <div>Bookmarks</div>}
            {activeTab === 'annotations' && <div>Annotations</div>}
          </div>
          <div className='bottom-tab absolute bottom-0 flex w-full bg-gray-200'>
            <button
              className={`m-1.5 flex-1 rounded-md p-2 ${activeTab === 'toc' ? 'bg-gray-300' : ''}`}
              onClick={() => setActiveTab('toc')}
            >
              <MdToc size={20} className='mx-auto' />
            </button>
            <button
              className={`m-1.5 flex-1 rounded-md p-2 ${activeTab === 'annotations' ? 'bg-gray-300' : ''}`}
              onClick={() => setActiveTab('annotations')}
            >
              <MdEditNote size={20} className='mx-auto' />
            </button>
            <button
              className={`m-1.5 flex-1 rounded-md p-2 ${activeTab === 'bookmarks' ? 'bg-gray-300' : ''}`}
              onClick={() => setActiveTab('bookmarks')}
            >
              <MdBookmarkBorder size={20} className='mx-auto' />
            </button>
          </div>
          <div
            className='drag-bar bg-base-300 absolute right-0 top-0 h-full w-0.5 cursor-col-resize'
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
