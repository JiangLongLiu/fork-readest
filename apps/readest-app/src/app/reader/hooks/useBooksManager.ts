import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { uniqueId } from '@/utils/misc';

const useBooksManager = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig } = useEnv();
  const { bookKeys } = useReaderStore();
  const { setBookKeys, initViewState } = useReaderStore();
  const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKeys, shouldUpdateSearchParams]);

  // Append a new book and sync with bookKeys and URL
  const appendBook = (id: string, isPrimary: boolean) => {
    const newKey = `${id}-${uniqueId()}`;
    initViewState(envConfig, id, newKey, isPrimary);
    if (!bookKeys.includes(newKey)) {
      const updatedKeys = [...bookKeys, newKey];
      setBookKeys(updatedKeys);
    }
    setSideBarBookKey(newKey);
    setShouldUpdateSearchParams(true);
  };

  // Close a book and sync with bookKeys and URL
  const dismissBook = (bookKey: string) => {
    const updatedKeys = bookKeys.filter((key) => key !== bookKey);
    setBookKeys(updatedKeys);
    setShouldUpdateSearchParams(true);
  };

  const getNextBookKey = (bookKey: string) => {
    const index = bookKeys.findIndex((key) => key === bookKey);
    const nextIndex = (index + 1) % bookKeys.length;
    return bookKeys[nextIndex]!;
  };

  const openParallelView = () => {
    const sideBarBookId = sideBarBookKey?.split('-')[0];
    if (sideBarBookId) appendBook(sideBarBookId, false);
  };

  return {
    bookKeys,
    appendBook,
    dismissBook,
    getNextBookKey,
    openParallelView,
  };
};

export default useBooksManager;
