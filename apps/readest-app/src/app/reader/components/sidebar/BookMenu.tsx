import React from 'react';

interface BookMenuProps {
  openSplitView: () => void;
  toggleDropdown?: () => void;
}

const BookMenu: React.FC<BookMenuProps> = ({ openSplitView, toggleDropdown }) => {
  const handleOpenSplitView = () => {
    openSplitView();
    toggleDropdown?.();
  };
  const handleReloadPage = () => {
    window.location.reload();
    toggleDropdown?.();
  };
  const showAboutReadest = () => {
    toggleDropdown?.();
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
        <span className='ml-2'>Split View</span>
        <span className='text-sm text-gray-400'>Shift+S</span>
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
