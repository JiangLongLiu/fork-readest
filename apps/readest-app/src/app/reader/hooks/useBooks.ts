import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { uniqueId } from '@/utils/misc';

const useBooks = () => {
  const { envConfig } = useEnv();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sideBarBookKey, initViewState, getViewState, setSideBarBookKey } = useReaderStore();

  const initialIds = (searchParams.get('ids') || '').split(',').filter(Boolean);
  const [bookKeys, setBookKeys] = useState<string[]>(() => {
    return initialIds.map((id) => `${id}-${uniqueId()}`);
  });

  const [shouldUpdateSearchParams, setShouldUpdateSearchParams] = useState(false);
  useEffect(() => {
    if (shouldUpdateSearchParams) {
      const ids = bookKeys.map((key) => key.split('-')[0]).join(',');
      if (ids) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('ids', ids);
        router.replace(`?${params.toString()}`, { scroll: false });
      }
      setShouldUpdateSearchParams(false);
    }
  }, [bookKeys, shouldUpdateSearchParams]);

  // Append a new book and sync with bookKeys and URL
  const appendBook = (id: string, isPrimary: boolean) => {
    const newKey = `${id}-${uniqueId()}`;
    initViewState(envConfig, id, newKey, isPrimary);
    setBookKeys((prevKeys) => {
      if (!prevKeys.includes(newKey)) {
        prevKeys.push(newKey);
      }
      return prevKeys;
    });
    setSideBarBookKey(newKey);
    setShouldUpdateSearchParams(true);
  };

  // Close a book and sync with bookKeys and URL
  const dismissBook = (bookKey: string) => {
    setBookKeys((prevKeys) => {
      const updatedKeys = prevKeys.filter((key) => key !== bookKey);
      return updatedKeys;
    });
    setShouldUpdateSearchParams(true);
  };

  const getNextBookKey = (bookKey: string) => {
    const index = bookKeys.findIndex((key) => key === bookKey);
    const nextIndex = (index + 1) % bookKeys.length;
    return bookKeys[nextIndex]!;
  };

  const openSplitView = () => {
    const sideBarBookId = sideBarBookKey?.split('-')[0];
    if (sideBarBookId) appendBook(sideBarBookId, false);
  };

  // Initialize all book states on first load
  useEffect(() => {
    const uniqueIds = new Set<string>();
    console.log('Initialize books', bookKeys);
    bookKeys.forEach((key, index) => {
      const id = key.split('-')[0]!;
      const isPrimary = !uniqueIds.has(id);
      uniqueIds.add(id);
      if (!getViewState(key)) {
        initViewState(envConfig, id, key, isPrimary);
        if (index === 0) setSideBarBookKey(key);
      }
    });
  }, []);

  return {
    bookKeys,
    appendBook,
    dismissBook,
    getNextBookKey,
    openSplitView,
  };
};

export default useBooks;
