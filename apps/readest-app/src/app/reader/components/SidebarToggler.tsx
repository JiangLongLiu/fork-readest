import React from 'react';
import { TbLayoutSidebar, TbLayoutSidebarFilled } from 'react-icons/tb';

import { useReaderStore } from '@/store/readerStore';
import Button from '@/components/Button';

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
    <Button
      icon={
        sideBarBookKey === bookKey && isSideBarVisible ? (
          <TbLayoutSidebarFilled size={20} className='text-base-content' />
        ) : (
          <TbLayoutSidebar size={20} className='text-base-content' />
        )
      }
      onClick={handleToggleSidebar}
      tooltip='Sidebar'
      tooltipDirection='bottom'
    />
  );
};

export default SidebarToggler;
