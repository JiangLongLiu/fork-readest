'use client';

import * as React from 'react';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore, DEFAULT_BOOK_STATE } from '@/store/readerStore';

import Spinner from '@/components/Spinner';
import FoliateViewer from './FoliateViewer';
import SideBar from './SideBar';
import PageInfo from './PageInfo';
import HeaderBar from './HeaderBar';
import FooterBar from './FooterBar';
import SectionInfo from './SectionInfo';

const ReaderContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ids = (searchParams.get('ids') || '').split(',');

  const { envConfig } = useEnv();
  const { books, settings, initBookState, saveConfig, saveSettings } = useReaderStore();

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
  const [hoveredBookKey, setHoveredBookKey] = useState('');

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

  const handleSideBarResize = (newWidth: string) => {
    setSideBarWidth(newWidth);
    settings.globalReadSettings.sideBarWidth = newWidth;
  };

  const handleSideBarTogglePin = () => {
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

  const getGridTemplate = () => {
    const count = ids.length;
    const aspectRatio = window.innerWidth / window.innerHeight;

    if (count <= 1) {
      // One book, full screen
      return { columns: '1fr', rows: '1fr' };
    } else if (count === 2) {
      if (aspectRatio < 1) {
        // portrait mode: horizontal split
        return { columns: '1fr', rows: '1fr 1fr' };
      } else {
        // landscape mode: vertical split
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
        onResize={handleSideBarResize}
        onTogglePin={handleSideBarTogglePin}
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
          const { section, pageinfo, progress, chapter } = config;
          return (
            <div key={key} className='relative h-full w-full overflow-hidden'>
              <HeaderBar
                bookKey={key}
                bookTitle={book?.title}
                isHoveredAnim={ids.length > 1}
                hoveredBookKey={hoveredBookKey}
                isSideBarVisible={isSideBarVisible}
                sideBarBookKey={sideBarBookKey}
                setSideBarVisibility={setSideBarVisibility}
                setSideBarBookKey={setSideBarBookKey}
                setHoveredBookKey={setHoveredBookKey}
              />
              <FoliateViewer bookKey={key} bookDoc={bookDoc!} bookConfig={config!} />
              <SectionInfo chapter={chapter} />
              <PageInfo bookFormat={book.format} section={section} pageinfo={pageinfo} />
              <FooterBar
                bookKey={key}
                progress={progress}
                isHoveredAnim={false}
                hoveredBookKey={hoveredBookKey}
                sideBarBookKey={sideBarBookKey}
                setHoveredBookKey={setHoveredBookKey}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReaderContent;
