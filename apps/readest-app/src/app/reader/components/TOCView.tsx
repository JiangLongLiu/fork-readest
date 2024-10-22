import React, { useEffect, useRef, useState } from 'react';

import { TOCItem } from '@/libs/document';
import { useReaderStore } from '@/store/readerStore';
import { useFoliateEvents } from '../hooks/useFoliateEvents';

const findParentPath = (toc: TOCItem[], href: string): TOCItem[] => {
  for (const item of toc) {
    if (item.href === href) {
      return [item];
    }
    if (item.subitems) {
      const path = findParentPath(item.subitems, href);
      if (path.length) {
        return [item, ...path];
      }
    }
  }
  return [];
};

const createExpanderIcon = (isExpanded: boolean) => {
  return (
    <svg
      viewBox='0 0 8 10'
      width='8'
      height='10'
      className={`transform transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
      style={{ transformOrigin: 'center' }}
    >
      <polygon points='0 0, 8 5, 0 10' />
    </svg>
  );
};

const TOCItemView: React.FC<{
  bookId: string;
  item: TOCItem;
  depth: number;
  setCurrentHref: (href: string) => void;
  currentHref: string | null;
  expandedItems: string[];
}> = ({ bookId, item, depth, setCurrentHref, currentHref, expandedItems }) => {
  const [isExpanded, setIsExpanded] = useState(expandedItems.includes(item.href || ''));
  const { foliateView } = useReaderStore();

  const handleToggleExpand = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleClickItem = (event: React.MouseEvent) => {
    event.preventDefault();
    if (item.href) {
      foliateView?.goTo(item.href);
      setCurrentHref(item.href);
    }
  };

  const isActive = currentHref === item.href;

  useEffect(() => {
    setIsExpanded(expandedItems.includes(item.href || ''));
  }, [expandedItems, item.href]);

  return (
    <li className='w-full' style={{ paddingTop: '1px' }}>
      <span
        role='treeitem'
        tabIndex={-1}
        onClick={item.href ? handleClickItem : undefined}
        style={{ paddingInlineStart: `${(depth + 1) * 12}px` }}
        aria-expanded={isExpanded ? 'true' : 'false'}
        aria-selected={isActive ? 'true' : 'false'}
        data-href={item.href}
        className={`flex w-full cursor-pointer items-center rounded-md py-2 ${
          isActive ? 'bg-gray-300 hover:bg-gray-400' : 'hover:bg-gray-300'
        }`}
      >
        {item.subitems && (
          <span onClick={handleToggleExpand} className='inline-block cursor-pointer'>
            {createExpanderIcon(isExpanded)}
          </span>
        )}
        <span
          className='ml-2 truncate text-ellipsis font-sans text-sm font-light'
          style={{
            maxWidth: 'calc(100% - 24px)',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {item.label}
        </span>
      </span>
      {item.subitems && isExpanded && (
        <ol role='group'>
          {item.subitems.map((subitem) => (
            <TOCItemView
              bookId={bookId}
              key={subitem.label}
              item={subitem}
              depth={depth + 1}
              setCurrentHref={setCurrentHref}
              currentHref={currentHref}
              expandedItems={expandedItems}
            />
          ))}
        </ol>
      )}
    </li>
  );
};

const TOCView: React.FC<{
  bookId: string;
  toc: TOCItem[];
  currentHref: string | null;
}> = ({ bookId, toc, currentHref: href }) => {
  const [currentHref, setCurrentHref] = useState<string | null>(href);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { foliateView } = useReaderStore();
  const tocRef = useRef<HTMLUListElement | null>(null);

  const tocRelocateHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { tocItem } = detail;
    if (tocItem?.href) {
      setCurrentHref(tocItem.href);
    }
  };

  useFoliateEvents(foliateView, bookId, { onRelocate: tocRelocateHandler });

  const expandParents = (toc: TOCItem[], href: string) => {
    const parentPath = findParentPath(toc, href).map((item) => item.href);
    setExpandedItems(parentPath.filter(Boolean) as string[]);
  };

  useEffect(() => {
    const currentItem = tocRef.current?.querySelector(`[data-href="${currentHref}"]`);
    if (currentItem) {
      const rect = currentItem.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!isVisible) {
        (currentItem as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      (currentItem as HTMLElement).setAttribute('aria-current', 'page');
    }
    if (currentHref) {
      expandParents(toc, currentHref);
    }
  }, [toc, currentHref]);

  return (
    <div className='relative'>
      <div className='max-h-[calc(100vh-168px)] overflow-y-auto rounded border'>
        <ul role='tree' ref={tocRef} className='overflow-y-auto px-2'>
          {toc &&
            toc.map((item) => (
              <TOCItemView
                bookId={bookId}
                key={item.label}
                item={item}
                depth={0}
                setCurrentHref={setCurrentHref}
                currentHref={currentHref}
                expandedItems={expandedItems}
              />
            ))}
        </ul>
      </div>
    </div>
  );
};

export default TOCView;
