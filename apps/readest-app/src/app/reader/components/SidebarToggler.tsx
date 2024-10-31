import React from 'react';
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff } from 'react-icons/vsc';

interface SidebarTogglerProps {
  isSidebarVisible: boolean;
  isCurrentBook: boolean;
  toggleSidebar: () => void;
}

const SidebarToggler: React.FC<SidebarTogglerProps> = ({
  isSidebarVisible,
  isCurrentBook,
  toggleSidebar,
}) => (
  <button onClick={toggleSidebar} className='p-2'>
    {isCurrentBook && isSidebarVisible ? (
      <VscLayoutSidebarLeft size={16} />
    ) : (
      <VscLayoutSidebarLeftOff size={16} />
    )}
  </button>
);

export default SidebarToggler;
