import React from 'react';
import { GiBookshelf } from 'react-icons/gi';
import { CiSearch } from 'react-icons/ci';
import { MdOutlineMenu, MdOutlinePushPin, MdPushPin } from 'react-icons/md';
import Dropdown from '@/components/Dropdown';
import BookMenu from './BookMenu';

const SidebarHeader: React.FC<{
  isPinned: boolean;
  onGoToLibrary: () => void;
  onOpenSplitView: () => void;
  handleSideBarTogglePin: () => void;
}> = ({ isPinned, onGoToLibrary, onOpenSplitView, handleSideBarTogglePin }) => (
  <div className='sidebar-header flex h-11 items-center justify-between pl-1.5 pr-3'>
    <div className='flex items-center'>
      <button className='btn btn-ghost h-8 min-h-8 w-8 p-0' onClick={onGoToLibrary}>
        <GiBookshelf size={20} className='fill-base-content' />
      </button>
    </div>
    <div className='flex size-[50%] min-w-20 items-center justify-between'>
      <button className='btn btn-ghost left-0 h-8 min-h-8 w-8 p-0'>
        <CiSearch size={20} className='fill-base-content' />
      </button>
      <Dropdown
        className='dropdown-bottom flex justify-center'
        buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
        toggleButton={<MdOutlineMenu size={20} />}
      >
        <BookMenu openSplitView={onOpenSplitView} />
      </Dropdown>
      <button
        onClick={handleSideBarTogglePin}
        className={`${isPinned ? 'bg-gray-300' : 'bg-base-300'} btn btn-ghost btn-circle right-0 h-6 min-h-6 w-6`}
      >
        {isPinned ? <MdPushPin size={14} /> : <MdOutlinePushPin size={14} />}
      </button>
    </div>
  </div>
);

export default SidebarHeader;
