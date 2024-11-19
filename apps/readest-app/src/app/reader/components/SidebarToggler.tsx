import React from 'react';
import { TbLayoutSidebar, TbLayoutSidebarFilled } from 'react-icons/tb';

import { useReaderStore } from '@/store/readerStore';

interface SidebarTogglerProps {
  bookKey: string;
}

const SidebarToggler: React.FC<SidebarTogglerProps> = ({ bookKey }) => {
  const { sideBarBookKey, isSideBarVisible, setSideBarBookKey, toggleSideBar } = useReaderStore();
  const handleToggleSidebar = () => {
    if (sideBarBookKey === bookKey) {
      toggleSideBar();
    } else {
      setSideBarBookKey(bookKey);
      if (!isSideBarVisible) toggleSideBar();
    }
  };
  return (
    <button onClick={handleToggleSidebar} className='p-2'>
      {sideBarBookKey == bookKey && isSideBarVisible ? (
        <TbLayoutSidebarFilled size={20} className='text-base-content' />
      ) : (
        <TbLayoutSidebar size={20} className='text-base-content' />
      )}
    </button>
  );
};

export default SidebarToggler;
