import React from 'react';

interface BookMenuProps {
  openSplitView: () => void;
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const BookMenu: React.FC<BookMenuProps> = ({ openSplitView, setIsDropdownOpen }) => {
  const handleOpenSplitView = () => {
    openSplitView();
    setIsDropdownOpen?.(false);
  };
  const handleReloadPage = () => {
    window.location.reload();
    setIsDropdownOpen?.(false);
  };
  const showAboutReadest = () => {
    setIsDropdownOpen?.(false);
  };

  return (
    <div
      tabIndex={0}
      className='book-menu dropdown-content dropdown-center z-20 mt-3 w-56 border bg-white shadow-2xl'
    >
      <button
        className='flex w-full items-center justify-between rounded-md p-2 hover:bg-gray-100'
        onClick={handleOpenSplitView}
      >
        <span className='ml-2'>Parallel Read</span>
        <span className='text-sm text-gray-400'>Shift+P</span>
      </button>
      <button
        className='flex w-full items-center justify-between rounded-md p-2 hover:bg-gray-100'
        onClick={handleReloadPage}
      >
        <span className='ml-2'>Reload Page</span>
        <span className='text-sm text-gray-400'>Shift+R</span>
      </button>
      <hr className='my-1' />
      <button
        className='flex w-full items-center rounded-md p-2 hover:bg-gray-100'
        onClick={showAboutReadest}
      >
        <span className='ml-2'>About Readest</span>
      </button>
    </div>
  );
};

export default BookMenu;
