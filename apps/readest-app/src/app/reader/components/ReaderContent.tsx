'use client';

import * as React from 'react';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BsLayoutSidebar } from 'react-icons/bs';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { BookDoc, DocumentLoader } from '@/libs/document';

import Spinner from '@/components/Spinner';
import FoliateViewer from './FoliateViewer';
import SideBar from './SideBar';

const ReaderContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [bookDoc, setBookDoc] = React.useState<BookDoc>();
  const { envConfig } = useEnv();
  const { books, settings, fetchBook, saveConfig, saveSettings } = useReaderStore();
  const defaultBookState = { loading: true, error: null, file: null, book: null, config: null };
  const bookState = id ? books[id] || defaultBookState : defaultBookState;

  const [sideBarWidth, setSideBarWidth] = useState(
    settings.globalReadSettings.sideBarWidth ?? '25%',
  );
  const [isSideBarPinned, setIsSideBarPinned] = useState(
    settings.globalReadSettings.isSideBarPinned ?? true,
  );
  const [isSideBarVisible, setSideBarVisibility] = useState(isSideBarPinned);
  const [isTopBarVisible, setTopBarVisibility] = useState(false);

  React.useEffect(() => {
    if (!id) {
      return;
    }
    const { file } = bookState;
    if (id && !file) {
      fetchBook(envConfig, id);
    }
    if (!bookDoc && file) {
      const loadDocument = async () => {
        if (file) {
          const { book } = await new DocumentLoader(file).open();
          setBookDoc(book);
        }
      };
      loadDocument();
    }
  }, [bookState.file, envConfig, fetchBook, id]);

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
    const { book, config } = bookState;
    if (book && config) {
      saveConfig(envConfig, book, config);
      saveSettings(envConfig, settings);
    }
    router.back();
  };

  const topBarWidth = isSideBarPinned && isSideBarVisible ? `calc(100% - ${sideBarWidth})` : '100%';

  if (!id || !bookDoc || !bookState.config || !bookState.book) {
    return (
      <div className={'flex-1 overflow-hidden'}>
        {bookState.loading && <Spinner loading={bookState.loading} />}
        {bookState.error && (
          <div className='text-center'>
            <h2 className='text-red-500'>{bookState.error}</h2>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='flex h-screen'>
      <SideBar
        book={bookState.book}
        tocData={bookDoc.toc}
        currentHref={bookState.config.href ?? null}
        width={sideBarWidth}
        isVisible={isSideBarVisible}
        isPinned={isSideBarPinned}
        onResize={handleResize}
        onTogglePin={handleTogglePin}
        onGoToLibrary={handleCloseBook}
        onSetVisibility={(visibility: boolean) => setSideBarVisibility(visibility)}
      />

      <div className={'flex-1 overflow-hidden'}>
        <div
          className={`topbar absolute top-0 z-10 h-10 border-b ${
            isTopBarVisible ? 'opacity-100' : 'opacity-0'
          } flex items-center px-4`}
          style={{ width: topBarWidth }}
          onMouseEnter={() => setTopBarVisibility(true)}
          onMouseLeave={() => setTopBarVisibility(false)}
        >
          <div className='absolute left-4 flex h-full items-center p-2'>
            <button onClick={() => setSideBarVisibility(!isSideBarVisible)}>
              <BsLayoutSidebar size={16} />
            </button>
          </div>
          <div className='absolute left-1/2 -translate-x-1/2 transform'>
            <h2 className='text-center text-sm font-semibold'>{bookState.book.title}</h2>
          </div>
        </div>
        <FoliateViewer bookId={id} bookDoc={bookDoc} bookConfig={bookState.config} />
      </div>
    </div>
  );
};

export default ReaderContent;
