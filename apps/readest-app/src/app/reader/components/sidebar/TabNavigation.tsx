import React from 'react';
import { MdToc, MdEditNote, MdBookmarkBorder } from 'react-icons/md';

const TabNavigation: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ activeTab, onTabChange }) => (
  <div className='bottom-tab border-base-300/50 flex w-full border-t'>
    {['toc', 'annotations', 'bookmarks'].map((tab) => (
      <button
        key={tab}
        className={`m-1.5 flex-1 rounded-md p-2 ${activeTab === tab ? 'bg-base-300' : ''}`}
        onClick={() => onTabChange(tab)}
      >
        {tab === 'toc' && <MdToc size={20} className='mx-auto' />}
        {tab === 'annotations' && <MdEditNote size={20} className='mx-auto' />}
        {tab === 'bookmarks' && <MdBookmarkBorder size={20} className='mx-auto' />}
      </button>
    ))}
  </div>
);

export default TabNavigation;
