import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff } from 'react-icons/vsc';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';

import WindowButtons from '@/components/WindowButtons';
import Dropdown from '@/components/Dropdown';
import ViewMenu from './ViewMenu';

interface HeaderBarProps {
  bookKey: string;
  bookTitle: string;
  isHoveredAnim: boolean;
  hoveredBookKey: string;
  isSideBarVisible: boolean;
  sideBarBookKey: string | null;
  setSideBarVisibility: (visibility: boolean) => void;
  setSideBarBookKey: (key: string) => void;
  setHoveredBookKey: (key: string) => void;
  onCloseBook: (bookKey: string) => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  bookKey,
  bookTitle,
  isHoveredAnim,
  hoveredBookKey,
  isSideBarVisible,
  sideBarBookKey,
  setSideBarVisibility,
  setSideBarBookKey,
  setHoveredBookKey,
  onCloseBook,
}) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleSideBar = () => {
    if (!isSideBarVisible) {
      setSideBarVisibility(true);
    } else if (sideBarBookKey === bookKey) {
      setSideBarVisibility(false);
    }
    setSideBarBookKey(bookKey);
  };

  return (
    <div
      ref={headerRef}
      className={clsx(
        `header-bar absolute top-0 z-10 flex h-11 w-full items-center px-4`,
        `shadow-xs bg-base-100 rounded-window-top-right transition-opacity duration-300`,
        isHoveredAnim && 'hover-bar-anim',
        hoveredBookKey === bookKey || isDropdownOpen ? `opacity-100` : `opacity-0`,
        isDropdownOpen && 'header-bar-pinned',
      )}
      onMouseEnter={() => setHoveredBookKey(bookKey)}
      onMouseLeave={() => setHoveredBookKey('')}
    >
      <div className='sidebar-toggler mr-auto flex h-full items-center'>
        <button onClick={toggleSideBar} className='p-2'>
          {sideBarBookKey === bookKey && isSideBarVisible ? (
            <VscLayoutSidebarLeft size={16} />
          ) : (
            <VscLayoutSidebarLeftOff size={16} />
          )}
        </button>
      </div>

      <div className='header-title flex flex-1 items-center justify-center'>
        <h2 className='line-clamp-1 max-w-[80%] text-center text-xs font-semibold'>{bookTitle}</h2>
      </div>

      <div className='ml-auto flex h-full items-center space-x-2'>
        <Dropdown
          className='dropdown-bottom dropdown-end'
          buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
          toggleButton={<PiDotsThreeVerticalBold size={16} />}
          onToggle={setIsDropdownOpen}
        >
          <ViewMenu bookKey={bookKey} />
        </Dropdown>

        <WindowButtons
          className='window-buttons flex h-full items-center'
          headerRef={headerRef}
          showMinimize={false}
          showMaximize={false}
          onClose={() => onCloseBook(bookKey)}
        />
      </div>
    </div>
  );
};

export default HeaderBar;
