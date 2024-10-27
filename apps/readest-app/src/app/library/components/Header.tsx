import React from 'react';
import { FaSearch } from 'react-icons/fa';
import { PiPlus } from 'react-icons/pi';
import { MdSelectAll } from 'react-icons/md';
import WindowButtons from '@/components/WindowButtons';

interface LibraryHeaderProps {
  onImportBooks: () => void;
  onToggleSelectMode: () => void;
}

const LibraryHeader: React.FC<LibraryHeaderProps> = ({ onImportBooks, onToggleSelectMode }) => {
  return (
    <div id='titlebar' className='titlebar fixed top-0 z-10 w-full bg-gray-100 px-8 py-6'>
      <div className='flex items-center justify-between'>
        <div className='sm:w relative flex w-full items-center'>
          <span className='absolute left-4 text-gray-500'>
            <FaSearch className='h-4 w-4' />
          </span>
          <input
            type='text'
            placeholder='Search books...'
            className='input input-sm rounded-badge w-full bg-gray-200 pl-10 pr-10 text-base focus:border-none focus:outline-none'
          />
          <div className='absolute right-4 flex items-center space-x-4 text-gray-500'>
            <span className='mx-2 h-5 w-[1px] bg-gray-300'></span>
            <span className='dropdown dropdown-end h-5 cursor-pointer text-gray-500'>
              <div className='lg:tooltip lg:tooltip-bottom' data-tip='Add books'>
                <PiPlus tabIndex={0} className='h-5 w-5' role='button' />
              </div>
              <ul
                tabIndex={0}
                className='dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow'
              >
                <li>
                  <button onClick={onImportBooks}>From Local File</button>
                </li>
              </ul>
            </span>
            <button onClick={onToggleSelectMode} aria-label='Select Multiple Books' className='h-6'>
              <div className='lg:tooltip lg:tooltip-bottom cursor-pointer' data-tip='Select books'>
                <MdSelectAll role='button' className='h-6 w-6' />
              </div>
            </button>
          </div>
        </div>
        <WindowButtons />
      </div>
    </div>
  );
};

export default LibraryHeader;
