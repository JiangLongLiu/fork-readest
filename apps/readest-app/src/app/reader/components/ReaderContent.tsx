'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { DEFAULT_BOOK_STATE, useReaderStore } from '@/store/readerStore';
import { SystemSettings } from '@/types/settings';

import Spinner from '@/components/Spinner';
import SideBar from './sidebar/SideBar';
import useBooks from '../hooks/useBooks';
import BookGrid from './BookGrid';
import useBookShortcuts from '../hooks/useBookShortcuts';

const ReaderContent: React.FC<{ settings: SystemSettings }> = ({ settings }) => {
  const router = useRouter();
  const { envConfig } = useEnv();
  const { bookKeys, dismissBook, getNextBookKey, openSplitView } = useBooks();
  const { sideBarBookKey, setSideBarBookKey } = useReaderStore();

  const { books, getFoliateView, clearBookState, saveConfig, saveSettings } = useReaderStore();
  const bookStates = bookKeys.map((key) => books[key] || DEFAULT_BOOK_STATE);

  useBookShortcuts({ sideBarBookKey, bookKeys, openSplitView, getNextBookKey });

  const saveConfigAndCloseBook = (bookKey: string) => {
    getFoliateView(bookKey)?.close();
    getFoliateView(bookKey)?.remove();
    const bookState = books[bookKey];
    if (!bookState) return;
    const { book, config, isPrimary } = bookState;
    if (isPrimary && book && config) {
      saveConfig(envConfig, bookKey, config, settings);
    }
    clearBookState(bookKey);
  };

  const saveSettingsAndGoToLibrary = () => {
    saveSettings(envConfig, settings);
    router.replace('/library');
  };

  const handleCloseBooks = () => {
    bookKeys.forEach((key) => {
      saveConfigAndCloseBook(key);
    });
    saveSettingsAndGoToLibrary();
  };

  const handleCloseBook = (bookKey: string) => {
    saveConfigAndCloseBook(bookKey);
    if (sideBarBookKey === bookKey) {
      setSideBarBookKey(getNextBookKey(sideBarBookKey));
    }
    dismissBook(bookKey);
    if (bookKeys.filter((key) => key !== bookKey).length == 0) {
      saveSettingsAndGoToLibrary();
    }
  };

  const bookState = bookStates[0];
  if (
    bookStates.length !== bookKeys.length ||
    !bookState ||
    !bookState.book ||
    !bookState.bookDoc
  ) {
    return (
      <div className={'hero hero-content min-h-screen'}>
        <Spinner loading={true} />
        {bookState?.error && (
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
        width={settings.globalReadSettings.sideBarWidth}
        isPinned={settings.globalReadSettings.isSideBarPinned}
        onGoToLibrary={handleCloseBooks}
        onOpenSplitView={openSplitView}
      />

      <BookGrid bookKeys={bookKeys} bookStates={bookStates} onCloseBook={handleCloseBook} />
    </div>
  );
};

export default ReaderContent;
