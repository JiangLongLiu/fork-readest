import clsx from 'clsx';
import React from 'react';

import { BookDoc } from '@/libs/document';
import TOCView from './TOCView';
import BooknoteView from './BooknoteView';
import TabNavigation from './TabNavigation';

const SidebarContent: React.FC<{
  activeTab: string;
  bookDoc: BookDoc;
  sideBarBookKey: string;
  onTabChange: (tab: string) => void;
}> = ({ activeTab, bookDoc, sideBarBookKey, onTabChange }) => (
  <>
    <div
      className={clsx(
        'sidebar-content flex min-h-0 flex-grow flex-col',
        'font-sans text-sm font-light shadow-inner',
      )}
    >
      <div className='overflow-y-auto'>
        {activeTab === 'toc' && bookDoc.toc && (
          <TOCView toc={bookDoc.toc} bookKey={sideBarBookKey} />
        )}
        {activeTab === 'annotations' && (
          <BooknoteView type='annotation' toc={bookDoc.toc} bookKey={sideBarBookKey} />
        )}
        {activeTab === 'bookmarks' && (
          <BooknoteView type='bookmark' toc={bookDoc.toc} bookKey={sideBarBookKey} />
        )}
      </div>
    </div>
    <div className='flex-shrink-0'>
      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  </>
);

export default SidebarContent;
