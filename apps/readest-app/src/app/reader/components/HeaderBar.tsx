import clsx from 'clsx';
import React, { useRef, useState } from 'react';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';

import WindowButtons from '@/components/WindowButtons';
import Dropdown from '@/components/Dropdown';
import SidebarToggler from './SidebarToggler';
import ViewMenu from './ViewMenu';
import { useReaderStore } from '@/store/readerStore';

interface HeaderBarProps {
  bookKey: string;
  bookTitle: string;
  isHoveredAnim: boolean;
  onCloseBook: (bookKey: string) => void;
  onSetSettingsDialogOpen: (open: boolean) => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  bookKey,
  bookTitle,
  isHoveredAnim,
  onCloseBook,
  onSetSettingsDialogOpen,
}) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { hoveredBookKey, setHoveredBookKey, sideBarBookKey, setSideBarBookKey } = useReaderStore();
  const { isSideBarVisible, toggleSideBar } = useReaderStore();

  const toggleSidebarForBook = (bookKey: string) => {
    if (sideBarBookKey === bookKey) {
      toggleSideBar();
    } else {
      setSideBarBookKey(bookKey);
      if (!isSideBarVisible) toggleSideBar();
    }
  };

  return (
    <div
      ref={headerRef}
      className={clsx(
        `header-bar absolute top-0 z-10 flex h-11 w-full items-center px-4`,
        `shadow-xs bg-base-100 rounded-window-top-right transition-opacity duration-300`,
        !isSideBarVisible && 'rounded-window-top-left',
        isHoveredAnim && 'hover-bar-anim',
        hoveredBookKey === bookKey || isDropdownOpen ? `opacity-100` : `opacity-0`,
        isDropdownOpen && 'header-bar-pinned',
      )}
      onMouseEnter={() => setHoveredBookKey(bookKey)}
      onMouseLeave={() => setHoveredBookKey('')}
    >
      <div className='sidebar-toggler mr-auto flex h-full items-center'>
        <SidebarToggler
          isSidebarVisible={isSideBarVisible}
          isCurrentBook={sideBarBookKey === bookKey}
          toggleSidebar={() => toggleSidebarForBook(bookKey)}
        ></SidebarToggler>
      </div>

      <div className='header-title flex flex-1 items-center justify-center'>
        <h2 className='line-clamp-1 max-w-[80%] text-center text-xs font-semibold'>{bookTitle}</h2>
      </div>

      <div className='flex h-full items-center space-x-2'>
        <Dropdown
          className='dropdown-bottom dropdown-end'
          buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
          toggleButton={<PiDotsThreeVerticalBold size={16} />}
          onToggle={setIsDropdownOpen}
        >
          <ViewMenu bookKey={bookKey} onSetSettingsDialogOpen={onSetSettingsDialogOpen} />
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
