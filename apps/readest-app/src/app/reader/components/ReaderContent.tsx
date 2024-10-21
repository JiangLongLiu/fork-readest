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

interface ReaderContentProps {}

const ReaderContent: React.FC<ReaderContentProps> = ({}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [bookDoc, setBookDoc] = React.useState<BookDoc>();
  const { envConfig } = useEnv();
  const { library, books, settings, fetchBook, setLibrary } = useReaderStore();
  const defaultBookState = { loading: true, error: null, file: null, book: null, config: null };
  const bookState = id ? books[id] || defaultBookState : defaultBookState;

  const [sideBarWidth, setSideBarWidth] = useState(
    settings.globalReadSettings.sideBarWidth ?? '20%',
  );
  const [isSideBarPinned, setIsSideBarPinned] = useState(
    settings.globalReadSettings.isSideBarPinned ?? true,
  );
  const [isSideBarVisible, setSideBarVisibility] = useState(isSideBarPinned);
  const [isClosingBook, setClosingBook] = useState(false);
  const [isTopBarVisible, setTopBarVisibility] = useState(false);

  React.useEffect(() => {
    if (!id) {
      return;
    }
    const { file, book, config } = bookState;
    if (isClosingBook) {
      if (book && config) {
        book.lastUpdated = Date.now();
        const bookIndex = library.findIndex((b) => b.hash === book.hash);
        if (bookIndex !== -1) {
          library[bookIndex] = book;
        }
        setLibrary(library);
        envConfig.getAppService().then((appService) => {
          config.lastUpdated = Date.now();
          appService.saveBookConfig(book, config);
          appService.saveLibraryBooks(library);
          appService.saveSettings(settings);
        });
      }
      return;
    }
    if (id && !file) {
      fetchBook(envConfig, id);
    }
    if (!bookDoc && bookState.file) {
      const loadDocument = async () => {
        if (file) {
          const { book } = await new DocumentLoader(file).open();
          setBookDoc(book);
        }
      };
      loadDocument();
    }
  }, [isClosingBook, bookState.file, envConfig, fetchBook, id]);

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
    setClosingBook(true);
    router.back();
  };

  const topBarWidth = isSideBarPinned && isSideBarVisible ? `calc(100% - ${sideBarWidth})` : '100%';

  if (!id || !bookDoc || !bookState.config || !bookState.book) {
    return null;
  }

  return (
    <div className='flex h-screen overflow-hidden'>
      <SideBar
        book={bookState.book}
        width={sideBarWidth}
        isVisible={isSideBarVisible}
        isPinned={isSideBarPinned}
        onResize={handleResize}
        onTogglePin={handleTogglePin}
        onGoToLibrary={handleCloseBook}
        onSetVisibility={(visibility: boolean) => setSideBarVisibility(visibility)}
      />

      <div className={`flex-1`}>
        {bookState.loading && <Spinner loading={bookState.loading} />}
        {bookState.error && (
          <div className='text-center'>
            <h2 className='text-red-500'>{bookState.error}</h2>
          </div>
        )}
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
