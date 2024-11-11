'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { SystemSettings } from '@/types/settings';

import Spinner from '@/components/Spinner';
import SideBar from './sidebar/SideBar';
import useBooks from '../hooks/useBooks';
import BookGrid from './BookGrid';
import useBookShortcuts from '../hooks/useBookShortcuts';
import Notebook from './notebook/Notebook';

const ReaderContent: React.FC<{ settings: SystemSettings }> = ({ settings }) => {
  const router = useRouter();
  const { envConfig } = useEnv();
  const { bookKeys, dismissBook, getNextBookKey, openSplitView } = useBooks();
  const { sideBarBookKey, getView, getConfig, setSideBarBookKey } = useReaderStore();
  const { getBookData, getViewState, clearViewState, saveConfig, saveSettings } = useReaderStore();

  useBookShortcuts({ sideBarBookKey, bookKeys, openSplitView, getNextBookKey });

  const saveConfigAndCloseBook = (bookKey: string) => {
    getView(bookKey)?.close();
    getView(bookKey)?.remove();
    const config = getConfig(bookKey);
    const { book } = getBookData(bookKey) || {};
    const { isPrimary } = getViewState(bookKey) || {};
    if (isPrimary && book && config) {
      saveConfig(envConfig, bookKey, config, settings);
    }
    clearViewState(bookKey);
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

  if (!bookKeys || bookKeys.length === 0) return null;
  const bookData = getBookData(bookKeys[0]!);
  if (!bookData || !bookData.book || !bookData.bookDoc) {
    return (
      <div className={'hero hero-content min-h-screen'}>
        <Spinner loading={true} />
      </div>
    );
  }

  return (
    <div className='flex h-screen'>
      <SideBar onGoToLibrary={handleCloseBooks} onOpenSplitView={openSplitView} />
      <BookGrid bookKeys={bookKeys} onCloseBook={handleCloseBook} />
      <Notebook />
    </div>
  );
};

export default ReaderContent;
