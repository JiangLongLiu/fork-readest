import React from 'react';
import Image from 'next/image';

import MenuItem from '@/components/MenuItem';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import useBooksManager from '../../hooks/useBooksManager';
import { useLibraryStore } from '@/store/libraryStore';

interface BookMenuProps {
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const BookMenu: React.FC<BookMenuProps> = ({ setIsDropdownOpen }) => {
  const { library } = useLibraryStore();
  const { openParallelView } = useBooksManager();
  const handleParallelView = (id: string) => {
    openParallelView(id);
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
      className='book-menu dropdown-content dropdown-center border-base-100 z-20 mt-3 w-60 shadow-2xl'
    >
      <MenuItem label='Parallel Read' noIcon>
        <ul className='max-h-60 overflow-y-auto'>
          {library.slice(0, 20).map((book) => (
            <MenuItem
              key={book.hash}
              icon={
                <Image
                  src={book.coverImageUrl!}
                  alt={book.title}
                  width={56}
                  height={80}
                  className='aspect-auto max-h-8 max-w-6 rounded-sm shadow-md'
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              }
              label={book.title}
              onClick={() => handleParallelView(book.hash)}
            />
          ))}
        </ul>
      </MenuItem>
      <MenuItem label='Reload Page' noIcon shortcut='Shift+R' onClick={handleReloadPage} />
      <hr className='border-base-200 my-1' />
      <MenuItem label='About Readest' noIcon onClick={showAboutReadest} />
    </div>
  );
};

export default BookMenu;
