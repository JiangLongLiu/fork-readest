import React, { useEffect, useState } from 'react';

import * as CFI from 'foliate-js/epubcfi.js';
import { useReaderStore } from '@/store/readerStore';
import { findParentPath } from '@/utils/toc';
import { TOCItem } from '@/libs/document';
import { BookNote } from '@/types/book';
import clsx from 'clsx';

interface BookmarkGroup {
  id: number;
  href: string;
  label: string;
  bookmarks: BookNote[];
}

interface BookmarkItemProps {
  bookKey: string;
  text: string;
  cfi: string;
  toc: TOCItem[];
}

const BookmarkItem: React.FC<BookmarkItemProps> = ({ bookKey, text, cfi }) => {
  const { getFoliateView } = useReaderStore();
  const { books } = useReaderStore();
  const [isCurrentBookmark, setIsCurrentBookmark] = useState(false);

  const bookState = books[bookKey]!;
  const progress = bookState.progress!;

  useEffect(() => {
    const { location } = progress;
    const start = CFI.collapse(location);
    const end = CFI.collapse(location, true);
    setIsCurrentBookmark(CFI.compare(start, cfi) * CFI.compare(end, cfi) <= 0);
  }, [progress]);

  const handleClickItem = (event: React.MouseEvent) => {
    event.preventDefault();
    getFoliateView(bookKey)?.goTo(cfi);
  };
  console.log('isCurrentBookmark', isCurrentBookmark);
  return (
    <li
      className={clsx(
        'my-2 cursor-pointer rounded-lg p-2 text-sm',
        isCurrentBookmark ? 'bg-base-300 hover:bg-gray-300' : 'hover:bg-base-300 bg-white',
      )}
      onClick={handleClickItem}
    >
      <span className='line-clamp-3'>{text}</span>
    </li>
  );
};

const BookmarkView: React.FC<{
  bookKey: string;
  toc: TOCItem[];
}> = ({ bookKey, toc }) => {
  const { books } = useReaderStore();
  const bookState = books[bookKey]!;
  const config = bookState.config!;
  const { bookmarks = [] } = config;

  const bookmarkGroups: { [href: string]: BookmarkGroup } = {};
  for (const bookmark of bookmarks) {
    const parentPath = findParentPath(toc, bookmark.href);
    if (parentPath.length > 0) {
      const href = parentPath[0]!.href || '';
      const label = parentPath[0]!.label || '';
      const id = toc.findIndex((item) => item.href === href) || Infinity;
      bookmark.href = href;
      if (!bookmarkGroups[href]) {
        bookmarkGroups[href] = { id, href, label, bookmarks: [] };
      }
      bookmarkGroups[href].bookmarks.push(bookmark);
    }
  }

  Object.values(bookmarkGroups).forEach((group) => {
    group.bookmarks.sort((a, b) => {
      return CFI.compare(a.cfi, b.cfi);
    });
  });

  const sortedGroups = Object.values(bookmarkGroups).sort((a, b) => {
    return a.id - b.id;
  });

  return (
    <div className='relative'>
      <div className='max-h-[calc(100vh-173px)] overflow-y-auto rounded pt-2'>
        <ul role='tree' className='overflow-y-auto px-2'>
          {sortedGroups.map((group) => (
            <li key={group.href} className='p-2'>
              <h3 className='line-clamp-1 font-normal'>{group.label}</h3>
              <ul>
                {group.bookmarks.map((item) => (
                  <BookmarkItem
                    key={item.cfi}
                    bookKey={bookKey}
                    text={item.text || ''}
                    cfi={item.cfi}
                    toc={toc}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BookmarkView;
