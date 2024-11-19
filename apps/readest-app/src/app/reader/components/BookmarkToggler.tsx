import React, { useEffect, useState } from 'react';
import { MdOutlineBookmarkAdd, MdOutlineBookmark } from 'react-icons/md';
import * as CFI from 'foliate-js/epubcfi.js';

import { useReaderStore } from '@/store/readerStore';
import { useEnv } from '@/context/EnvContext';
import { BookNote } from '@/types/book';
import { uniqueId } from '@/utils/misc';

interface BookmarkTogglerProps {
  bookKey: string;
}

const BookmarkToggler: React.FC<BookmarkTogglerProps> = ({ bookKey }) => {
  const { envConfig } = useEnv();
  const { settings, saveConfig, updateBooknotes } = useReaderStore();
  const { getConfig, getProgress, setBookmarkRibbonVisibility } = useReaderStore();
  const config = getConfig(bookKey)!;
  const progress = getProgress(bookKey)!;

  const [isBookmarked, setIsBookmarked] = useState(false);

  const toggleBookmark = () => {
    const { booknotes: bookmarks = [] } = config;
    const { location: cfi, sectionHref: href, range } = progress;
    if (!cfi) return;
    if (!isBookmarked) {
      setIsBookmarked(true);
      const text = range?.startContainer.textContent?.slice(0, 128) || '';
      const truncatedText = text.length === 128 ? text + '...' : text;
      const bookmark: BookNote = {
        id: uniqueId(),
        type: 'bookmark',
        cfi,
        href,
        text: truncatedText,
        note: '',
        created: Date.now(),
      };
      bookmarks.push(bookmark);
      const updatedConfig = updateBooknotes(bookKey, bookmarks);
      if (updatedConfig) {
        saveConfig(envConfig, bookKey, updatedConfig, settings);
      }
    } else {
      setIsBookmarked(false);
      const start = CFI.collapse(cfi);
      const end = CFI.collapse(cfi, true);
      const updatedConfig = updateBooknotes(
        bookKey,
        bookmarks.filter(
          (item) =>
            item.type !== 'bookmark' ||
            CFI.compare(start, item.cfi) * CFI.compare(end, item.cfi) > 0,
        ),
      );
      if (updatedConfig) {
        saveConfig(envConfig, bookKey, updatedConfig, settings);
      }
    }
  };

  useEffect(() => {
    const { booknotes = [] } = config || {};
    const { location: cfi } = progress || {};
    if (!cfi) return;

    const start = CFI.collapse(cfi);
    const end = CFI.collapse(cfi, true);
    const locationBookmarked = booknotes
      .filter((booknote) => booknote.type === 'bookmark')
      .some((item) => CFI.compare(start, item.cfi) * CFI.compare(end, item.cfi) <= 0);
    setIsBookmarked(locationBookmarked);
    setBookmarkRibbonVisibility(bookKey, locationBookmarked);
  }, [config, progress]);

  return (
    <button onClick={toggleBookmark} className='p-2'>
      {isBookmarked ? (
        <MdOutlineBookmark size={20} className='text-base-content' />
      ) : (
        <MdOutlineBookmarkAdd size={20} className='text-base-content' />
      )}
    </button>
  );
};

export default BookmarkToggler;
