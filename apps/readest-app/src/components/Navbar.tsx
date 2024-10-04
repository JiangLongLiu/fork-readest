import * as React from 'react';
import { FaSearch, FaPlus } from 'react-icons/fa';

interface NavbarProps {
  onImportBooks: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onImportBooks }) => {
  return (
    <div className='fixed top-0 z-10 w-full bg-gray-100 p-6'>
      <div className='flex items-center justify-between'>
        {/* Search Input with Magnifier and Plus Icon */}
        <div className='sm:w relative flex w-full items-center'>
          {/* Magnifier Icon */}
          <span className='absolute left-4 text-gray-500'>
            <FaSearch className='w-3' />
          </span>
          {/* Search Input */}
          <input
            type='text'
            placeholder='Search books...'
            className='input input-sm rounded-badge w-full bg-gray-200 pl-10 pr-10 text-base focus:border-none focus:outline-none'
          />
          {/* Plus Icon */}
          <span className='dropdown dropdown-end absolute right-4 cursor-pointer text-gray-500'>
            <FaPlus tabIndex={0} className='w-3' role='button' />
            <ul
              tabIndex={0}
              className='dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow'
            >
              <li>
                <button onClick={onImportBooks}>From Local File</button>
              </li>
            </ul>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
