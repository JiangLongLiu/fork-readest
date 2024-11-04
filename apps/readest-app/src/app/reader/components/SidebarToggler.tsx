import React from 'react';
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff } from 'react-icons/vsc';

import { useReaderStore } from '@/store/readerStore';

interface SidebarTogglerProps {
  bookKey: string;
}

const SidebarToggler: React.FC<SidebarTogglerProps> = ({ bookKey }) => {
  const { isSideBarVisible, setSideBarBookKey, sideBarBookKey, toggleSideBar } = useReaderStore();
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
        <VscLayoutSidebarLeft size={16} />
      ) : (
        <VscLayoutSidebarLeftOff size={16} />
      )}
    </button>
  );
};

export default SidebarToggler;
