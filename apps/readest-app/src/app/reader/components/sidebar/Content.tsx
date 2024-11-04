import React from 'react';

import { BookDoc } from '@/libs/document';
import TOCView from './TOCView';
import BookmarkView from './BookmarkView';

const SidebarContent: React.FC<{
  activeTab: string;
  bookDoc: BookDoc;
  currentHref: string | null;
  sideBarBookKey: string;
}> = ({ activeTab, bookDoc, currentHref, sideBarBookKey }) => (
  <div className='sidebar-content overflow-y-auto font-sans text-sm font-light shadow-inner'>
    {activeTab === 'toc' && bookDoc.toc && (
      <TOCView toc={bookDoc.toc} bookKey={sideBarBookKey} currentHref={currentHref} />
    )}
    {activeTab === 'annotations' && <div>Annotations</div>}
    {activeTab === 'bookmarks' && <BookmarkView toc={bookDoc.toc} bookKey={sideBarBookKey} />}
  </div>
);

export default SidebarContent;
