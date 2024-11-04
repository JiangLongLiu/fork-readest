import React, { useEffect, useState } from 'react';
import { MdOutlineBookmarkAdd, MdOutlineBookmark } from 'react-icons/md';
import * as CFI from 'foliate-js/epubcfi.js';

import { useReaderStore } from '@/store/readerStore';
import { BookNote } from '@/types/book';

interface BookmarkTogglerProps {
  bookKey: string;
}

const BookmarkToggler: React.FC<BookmarkTogglerProps> = ({ bookKey }) => {
  const { books, updateBookmarks, setBookmarkRibbonVisibility } = useReaderStore();
  const bookState = books[bookKey]!;
  const config = bookState.config!;

  const [isBookmarked, setIsBookmarked] = useState(false);

  const toggleBookmark = () => {
    const { location: cfi, bookmarks = [] } = config;
    if (!cfi) return;
    if (!isBookmarked) {
      setIsBookmarked(true);
      const bookmark: BookNote = {
        type: 'bookmark',
        cfi,
        note: '',
        created: Date.now(),
      };
      bookmarks.push(bookmark);
      updateBookmarks(bookKey, bookmarks);
    } else {
      setIsBookmarked(false);
      const start = CFI.collapse(cfi);
      const end = CFI.collapse(cfi, true);
      updateBookmarks(
        bookKey,
        bookmarks.filter((item) => CFI.compare(start, item.cfi) * CFI.compare(end, item.cfi) > 0),
      );
    }
  };

  useEffect(() => {
    const { location: cfi, bookmarks = [] } = config;
    if (!cfi) return;

    const start = CFI.collapse(cfi);
    const end = CFI.collapse(cfi, true);
    const locationBookmarked = bookmarks.some(
      (item) => CFI.compare(start, item.cfi) * CFI.compare(end, item.cfi) <= 0,
    );
    setIsBookmarked(locationBookmarked);
    setBookmarkRibbonVisibility(bookKey, locationBookmarked);
  }, [config]);

  return (
    <button onClick={toggleBookmark} className='p-2'>
      {isBookmarked ? <MdOutlineBookmark size={20} /> : <MdOutlineBookmarkAdd size={20} />}
    </button>
  );
};

export default BookmarkToggler;
