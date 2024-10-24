'use client';

import * as React from 'react';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff } from 'react-icons/vsc';
import { RiArrowLeftWideLine, RiArrowRightWideLine } from 'react-icons/ri';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore, DEFAULT_BOOK_STATE } from '@/store/readerStore';

import Spinner from '@/components/Spinner';
import FoliateViewer from './FoliateViewer';
import SideBar from './SideBar';

const ReaderContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ids = searchParams.getAll('id') || [];

  const { envConfig } = useEnv();
  const { books, settings, initBookState, saveConfig, saveSettings } = useReaderStore();
  const { getFoliateView } = useReaderStore();

  const [sideBarWidth, setSideBarWidth] = useState(
    settings.globalReadSettings.sideBarWidth ?? '25%',
  );
  const [isSideBarPinned, setIsSideBarPinned] = useState(
    settings.globalReadSettings.isSideBarPinned ?? true,
  );
  const [isSideBarVisible, setSideBarVisibility] = useState(isSideBarPinned);

  const getKey = (id: string, index: number) => `${id}-${index}`;
  const bookStates = ids.map((id, index) => books[getKey(id, index)] || DEFAULT_BOOK_STATE);
  const [sideBarBookKey, setSideBarBookKey] = useState(getKey(ids[0] ?? '', 0));

  let sliderProgress = 0;

  React.useEffect(() => {
    if (ids.length === 0) return;
    const uniqueIds = new Set<string>();
    ids.forEach((id, index) => {
      const isPrimary = !uniqueIds.has(id);
      uniqueIds.add(id);
      const key = getKey(id, index);
      if (books[key]) return;
      console.log('fetching book', key);
      initBookState(envConfig, id, key, isPrimary);
    });
  }, [ids, settings]);

  const handleResize = (newWidth: string) => {
    setSideBarWidth(newWidth);
    settings.globalReadSettings.sideBarWidth = newWidth;
  };

  const handleTogglePin = () => {
    if (isSideBarPinned && isSideBarVisible) {
      setSideBarVisibility(false);
    }
    setIsSideBarPinned(!isSideBarPinned);
    settings.globalReadSettings.isSideBarPinned = !isSideBarPinned;
  };

  const handleCloseBook = () => {
    bookStates.forEach((bookState) => {
      const { book, config, isPrimary } = bookState;
      if (isPrimary && book && config) {
        saveConfig(envConfig, book, config);
      }
    });
    saveSettings(envConfig, settings);
    router.back();
  };

  const handleProgressChange = (bookKey: string, event: React.ChangeEvent) => {
    console.log('progress change', bookKey, event);
    const newProgress = parseInt((event.target as HTMLInputElement).value, 10);
    sliderProgress = newProgress;
    const foliateView = getFoliateView(bookKey);
    foliateView?.goToFraction(newProgress / 100.0);
  };

  const handleGoPrev = (bookKey: string) => {
    const foliateView = getFoliateView(bookKey);
    foliateView?.goLeft();
  };

  const handleGoNext = (bookKey: string) => {
    const foliateView = getFoliateView(bookKey);
    foliateView?.goRight();
  };

  const getGridTemplate = () => {
    const count = ids.length;
    const aspectRatio = window.innerWidth / window.innerHeight;

    if (count === 1) {
      // One book, full screen
      return { columns: '1fr', rows: '1fr' };
    } else if (count === 2) {
      if (aspectRatio < 1) {
        // portrait mode: vertical split
        return { columns: '1fr', rows: '1fr 1fr' };
      } else {
        // landscape mode: horizontal split
        return { columns: '1fr 1fr', rows: '1fr' };
      }
    } else if (count === 3 || count === 4) {
      // Three or four books, 2x2 grid
      return { columns: '1fr 1fr', rows: '1fr 1fr' };
    } else {
      // Five or more books, a 3x3 grid
      return { columns: '1fr 1fr 1fr', rows: '1fr 1fr 1fr' };
    }
  };

  const bookState = bookStates[0];
  if (bookStates.length !== ids.length || !bookState || !bookState.book || !bookState.bookDoc) {
    return (
      <div className={'flex-1'}>
        <Spinner loading={true} />
        {bookState?.error && (
          <div className='text-center'>
            <h2 className='text-red-500'>{bookState.error}</h2>
          </div>
        )}
      </div>
    );
  }

  const gridWidth = isSideBarPinned && isSideBarVisible ? `calc(100% - ${sideBarWidth})` : '100%';

  return (
    <div className='flex h-screen'>
      <SideBar
        bookKey={sideBarBookKey}
        width={sideBarWidth}
        isVisible={isSideBarVisible}
        isPinned={isSideBarPinned}
        onResize={handleResize}
        onTogglePin={handleTogglePin}
        onGoToLibrary={handleCloseBook}
        onSetVisibility={(visibility: boolean) => setSideBarVisibility(visibility)}
      />

      <div
        className='grid h-full'
        style={{
          width: gridWidth,
          gridTemplateColumns: getGridTemplate().columns,
          gridTemplateRows: getGridTemplate().rows,
        }}
      >
        {bookStates.map((bookState, index) => {
          const key = getKey(ids[index]!, index);
          const { book, config, bookDoc } = bookState;
          if (!book || !config || !bookDoc) return null;
          const { section, pageinfo, progress } = config;
          const pageInfo =
            book.format === 'PDF'
              ? section
                ? `${section.current + 1} / ${section.total}`
                : ''
              : pageinfo
                ? `Loc. ${pageinfo.current + 1} / ${pageinfo.total}`
                : '';
          const progressInfo = progress ? `${Math.round(progress * 100)}%` : '';
          sliderProgress = progress ? progress * 100 : 0;
          return (
            <div key={key} className='relative h-full w-full overflow-hidden'>
              <div
                className={`absolute top-0 z-10 flex h-10 w-full items-center px-4 ${
                  ids.length > 1 ? 'header-bar-anim' : 'header-bar'
                } shadow-xs opacity-0 transition-opacity duration-300 hover:opacity-100`}
              >
                <div className='absolute inset-0 flex items-center justify-center'>
                  <h2 className='line-clamp-1 max-w-[90%] px-2 text-center text-xs font-semibold'>
                    {book?.title}
                  </h2>
                </div>
                <div className='absolute left-4 flex h-full items-center p-2'>
                  <button
                    onClick={() => {
                      if (!isSideBarVisible) {
                        setSideBarVisibility(true);
                      } else if (sideBarBookKey === key) {
                        setSideBarVisibility(false);
                      }
                      setSideBarBookKey(key);
                    }}
                  >
                    {sideBarBookKey == key && isSideBarVisible ? (
                      <VscLayoutSidebarLeft size={16} />
                    ) : (
                      <VscLayoutSidebarLeftOff size={16} />
                    )}
                  </button>
                </div>
              </div>
              <FoliateViewer bookKey={key} bookDoc={bookDoc!} bookConfig={config!} />
              <div className='pageinfo absolute bottom-0 left-0 right-0 flex h-12 items-center justify-center'>
                <h2 className='px-2 text-center font-sans text-xs font-extralight text-slate-500'>
                  {pageInfo}
                </h2>
              </div>
              <div className='footer-bar shadow-xs absolute bottom-0 flex h-12 w-full items-center bg-gray-100 px-4 opacity-0 transition-opacity duration-300 hover:opacity-100'>
                <button
                  className='btn btn-ghost mx-2 h-8 min-h-8 w-8 p-0'
                  onClick={() => handleGoPrev(key)}
                >
                  <RiArrowLeftWideLine size={20} />
                </button>
                <span className='mx-2 text-center text-sm text-black'>{progressInfo}</span>
                <input
                  type='range'
                  className='mx-2 w-full'
                  min={0}
                  max={100}
                  value={sliderProgress}
                  onChange={(e) => handleProgressChange(key, e)}
                />
                <button
                  className='btn btn-ghost mx-2 h-8 min-h-8 w-8 p-0'
                  onClick={() => handleGoNext(key)}
                >
                  <RiArrowRightWideLine size={20} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReaderContent;
