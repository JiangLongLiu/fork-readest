import React from 'react';
import TOCView from './TOCView';
import { BookDoc } from '@/libs/document';

const SidebarContent: React.FC<{
  activeTab: string;
  bookDoc: BookDoc;
  currentHref: string | null;
  sideBarBookKey: string;
}> = ({ activeTab, bookDoc, currentHref, sideBarBookKey }) => (
  <div className='sidebar-content overflow-y-auto shadow-inner'>
    {activeTab === 'toc' && bookDoc.toc && (
      <TOCView toc={bookDoc.toc} bookKey={sideBarBookKey} currentHref={currentHref} />
    )}
    {activeTab === 'annotations' && <div>Annotations</div>}
    {activeTab === 'bookmarks' && <div>Bookmarks</div>}
  </div>
);

export default SidebarContent;
