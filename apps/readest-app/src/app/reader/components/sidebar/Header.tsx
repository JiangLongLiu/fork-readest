import clsx from 'clsx';
import React from 'react';
import { GiBookshelf } from 'react-icons/gi';
import { FiSearch } from 'react-icons/fi';
import { MdOutlineMenu, MdOutlinePushPin, MdPushPin } from 'react-icons/md';

import useTrafficLight from '@/hooks/useTrafficLight';
import Dropdown from '@/components/Dropdown';
import BookMenu from './BookMenu';

const SidebarHeader: React.FC<{
  isPinned: boolean;
  onGoToLibrary: () => void;
  handleTogglePin: () => void;
}> = ({ isPinned, onGoToLibrary, handleTogglePin }) => {
  const { isTrafficLightVisible } = useTrafficLight();
  return (
    <div
      className={clsx(
        'sidebar-header flex h-11 items-center justify-between pr-2',
        isTrafficLightVisible ? 'pl-20' : 'pl-1.5',
      )}
    >
      <div className='flex items-center'>
        <button className='btn btn-ghost h-8 min-h-8 w-8 p-0' onClick={onGoToLibrary}>
          <GiBookshelf size={20} className='fill-base-content' />
        </button>
      </div>
      <div className='flex size-[70%] min-w-24 max-w-32 items-center justify-between'>
        <button className='btn btn-ghost left-0 h-8 min-h-8 w-8 p-0'>
          <FiSearch size={18} />
        </button>
        <Dropdown
          className='dropdown-bottom flex justify-center'
          buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
          toggleButton={<MdOutlineMenu size={20} />}
        >
          <BookMenu />
        </Dropdown>
        <div className='right-0 flex h-8 w-8 items-center justify-center'>
          <button
            onClick={handleTogglePin}
            className={`${isPinned ? 'bg-gray-300' : 'bg-base-300'} btn btn-ghost btn-circle h-6 min-h-6 w-6`}
          >
            {isPinned ? <MdPushPin size={14} /> : <MdOutlinePushPin size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidebarHeader;
