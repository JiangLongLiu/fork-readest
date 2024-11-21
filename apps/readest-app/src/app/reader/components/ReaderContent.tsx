'use client';

import * as React from 'react';
import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { SystemSettings } from '@/types/settings';
import { uniqueId } from '@/utils/misc';

import useBooksManager from '../hooks/useBooksManager';
import useBookShortcuts from '../hooks/useBookShortcuts';
import Spinner from '@/components/Spinner';
import SideBar from './sidebar/SideBar';
import Notebook from './notebook/Notebook';
import BooksGrid from './BooksGrid';

const ReaderContent: React.FC<{ settings: SystemSettings }> = ({ settings }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig } = useEnv();
  const { bookKeys, dismissBook, getNextBookKey } = useBooksManager();
  const { sideBarBookKey, getView, getConfig, saveConfig, saveSettings, setSideBarBookKey } =
    useReaderStore();
  const { setBookKeys, getBookData, initViewState, getViewState, clearViewState } =
    useReaderStore();
  const isInitiating = useRef(false);
  const [loading, setLoading] = useState(false);

  useBookShortcuts({ sideBarBookKey, bookKeys });

  React.useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const initialIds = (searchParams.get('ids') || '').split(',').filter(Boolean);
    const initialBookKeys = initialIds.map((id) => `${id}-${uniqueId()}`);
    setBookKeys(initialBookKeys);
    const uniqueIds = new Set<string>();
    console.log('Initialize books', initialBookKeys);
    initialBookKeys.forEach((key, index) => {
      const id = key.split('-')[0]!;
      const isPrimary = !uniqueIds.has(id);
      uniqueIds.add(id);
      if (!getViewState(key)) {
        initViewState(envConfig, id, key, isPrimary);
        if (index === 0) setSideBarBookKey(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveConfigAndCloseBook = (bookKey: string) => {
    console.log('Closing book', bookKey);
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
    setTimeout(() => setLoading(true), 200);
    return (
      loading && (
        <div className={'hero hero-content min-h-screen'}>
          <Spinner loading={true} />
        </div>
      )
    );
  }

  return (
    <div className='flex h-screen'>
      <SideBar onGoToLibrary={handleCloseBooks} />
      <BooksGrid bookKeys={bookKeys} onCloseBook={handleCloseBook} />
      <Notebook />
    </div>
  );
};

export default ReaderContent;
