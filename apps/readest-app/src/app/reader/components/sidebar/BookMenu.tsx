import React from 'react';

import MenuItem from '@/components/MenuItem';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import useBooksManager from '../../hooks/useBooksManager';

interface BookMenuProps {
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const BookMenu: React.FC<BookMenuProps> = ({ setIsDropdownOpen }) => {
  const { openParallelView } = useBooksManager();
  const handleOpenSplitView = () => {
    openParallelView();
    setIsDropdownOpen?.(false);
  };
  const handleReloadPage = () => {
    window.location.reload();
    setIsDropdownOpen?.(false);
  };
  const showAboutReadest = () => {
    setAboutDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  return (
    <div
      tabIndex={0}
      className='book-menu dropdown-content dropdown-center border-base-100 z-20 mt-3 w-56 shadow-2xl'
    >
      <MenuItem label='Parallel Read' shortcut='Shift+P' onClick={handleOpenSplitView} />
      <MenuItem label='Reload Page' shortcut='Shift+R' onClick={handleReloadPage} />
      <hr className='border-base-200 my-1' />
      <MenuItem label='About Readest' onClick={showAboutReadest} />
    </div>
  );
};

export default BookMenu;
