import React from 'react';
import clsx from 'clsx';
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff } from 'react-icons/vsc';

import WindowButtons from '@/components/WindowButtons';

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
}) => {
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
      id='titlebar'
      className={clsx(
        `header-bar absolute top-0 z-10 flex h-11 w-full items-center px-4`,
        `shadow-xs bg-base-100 rounded-window transition-opacity duration-300`,
        isHoveredAnim && 'hover-bar-anim',
        hoveredBookKey === bookKey ? `opacity-100` : `opacity-0`,
      )}
      onMouseEnter={() => setHoveredBookKey(bookKey)}
      onMouseLeave={() => setHoveredBookKey('')}
    >
      <div className='absolute inset-0 flex items-center justify-center'>
        <h2 className='line-clamp-1 max-w-[80%] px-2 text-center text-xs font-semibold'>
          {bookTitle}
        </h2>
      </div>
      <div className='absolute left-4 flex h-full items-center p-2'>
        <button onClick={toggleSideBar}>
          {sideBarBookKey === bookKey && isSideBarVisible ? (
            <VscLayoutSidebarLeft size={16} />
          ) : (
            <VscLayoutSidebarLeftOff size={16} />
          )}
        </button>
      </div>
      <div className='absolute right-4 flex h-full items-center'>
        <WindowButtons />
      </div>
    </div>
  );
};

export default HeaderBar;
