import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface BookMenuProps {
  bookId: string;
  toggleDropdown?: () => void;
}

const BookMenu: React.FC<BookMenuProps> = ({ bookId, toggleDropdown }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const openSplitView = () => {
    const params = new URLSearchParams(searchParams.toString());
    const ids = (params.get('ids') || '').split(',');
    const updatedIds = [...ids, bookId].join(',');
    params.set('ids', updatedIds);
    router.push(`?${params.toString()}`);
    toggleDropdown?.();
  };
  const reloadPage = () => {
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
        className='flex w-full items-center rounded-md p-2 hover:bg-gray-100'
        onClick={openSplitView}
      >
        <span className='ml-2'>Split View</span>
      </button>
      <button
        className='flex w-full items-center rounded-md p-2 hover:bg-gray-100'
        onClick={reloadPage}
      >
        <span className='ml-2'>Reload Page</span>
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
