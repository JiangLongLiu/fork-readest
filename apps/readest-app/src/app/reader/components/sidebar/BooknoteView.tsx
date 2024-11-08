import React, { useEffect, useState } from 'react';

import * as CFI from 'foliate-js/epubcfi.js';
import { useReaderStore } from '@/store/readerStore';
import { findParentPath } from '@/utils/toc';
import { TOCItem } from '@/libs/document';
import { BookNote, BookNoteType } from '@/types/book';
import clsx from 'clsx';

interface BooknoteGroup {
  id: number;
  href: string;
  label: string;
  booknotes: BookNote[];
}

interface BooknoteItemProps {
  bookKey: string;
  item: BookNote;
}

const BooknoteItem: React.FC<BooknoteItemProps> = ({ bookKey, item }) => {
  const { getProgress, getView } = useReaderStore();
  const [isCurrentBookmark, setIsCurrentBookmark] = useState(false);

  const { text, cfi } = item;
  const progress = getProgress(bookKey)!;

  useEffect(() => {
    const { location } = progress;
    const start = CFI.collapse(location);
    const end = CFI.collapse(location, true);
    setIsCurrentBookmark(CFI.compare(start, cfi) * CFI.compare(end, cfi) <= 0);
  }, [progress]);

  const handleClickItem = (event: React.MouseEvent) => {
    event.preventDefault();
    getView(bookKey)?.goTo(cfi);
  };

  return (
    <li
      className={clsx(
        'my-2 cursor-pointer rounded-lg p-2 text-sm',
        isCurrentBookmark ? 'bg-base-300 hover:bg-gray-300' : 'hover:bg-base-300 bg-white',
      )}
      onClick={handleClickItem}
    >
      <div className='line-clamp-3 overflow-hidden'>
        <span
          className={clsx(
            'inline',
            (item.style === 'underline' || item.style === 'squiggly') && 'underline decoration-2',
            item.type === 'annotation' && item.style === 'highlight' && `bg-${item.color}-100`,
            item.type === 'annotation' &&
              item.style === 'underline' &&
              `decoration-${item.color}-400`,
            item.type === 'annotation' &&
              item.style === 'squiggly' &&
              `decoration-wavy decoration-${item.color}-400`,
          )}
        >
          {text || ''}
        </span>
      </div>
    </li>
  );
};

const BooknoteView: React.FC<{
  type: BookNoteType;
  bookKey: string;
  toc: TOCItem[];
}> = ({ type, bookKey, toc }) => {
  const { getConfig } = useReaderStore();
  const config = getConfig(bookKey)!;
  const { booknotes: allNotes = [] } = config;
  const booknotes = allNotes.filter((note) => note.type === type);

  const booknoteGroups: { [href: string]: BooknoteGroup } = {};
  for (const booknote of booknotes) {
    const parentPath = findParentPath(toc, booknote.href);
    if (parentPath.length > 0) {
      const href = parentPath[0]!.href || '';
      const label = parentPath[0]!.label || '';
      const id = toc.findIndex((item) => item.href === href) || Infinity;
      booknote.href = href;
      if (!booknoteGroups[href]) {
        booknoteGroups[href] = { id, href, label, booknotes: [] };
      }
      booknoteGroups[href].booknotes.push(booknote);
    }
  }

  Object.values(booknoteGroups).forEach((group) => {
    group.booknotes.sort((a, b) => {
      return CFI.compare(a.cfi, b.cfi);
    });
  });

  const sortedGroups = Object.values(booknoteGroups).sort((a, b) => {
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
                {group.booknotes.map((item, index) => (
                  <BooknoteItem key={`${index}-${item.cfi}`} bookKey={bookKey} item={item} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BooknoteView;
