import React from 'react';
import { useState } from 'react';
import { BiMoon, BiSun } from 'react-icons/bi';
import { MdZoomOut, MdZoomIn, MdCheck } from 'react-icons/md';

interface ViewMenuProps {
  toggleDropdown?: () => void;
}

const ViewMenu: React.FC<ViewMenuProps> = ({}) => {
  const [isDarkMode, setDarkMode] = useState(false);
  const [isScrolledMode, setScrolledMode] = useState(false);
  const [isInvertedColors, setInvertedColors] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  const toggleDarkMode = () => setDarkMode(!isDarkMode);
  const toggleScrolledMode = () => setScrolledMode(!isScrolledMode);
  const toggleInvertedColors = () => setInvertedColors(!isInvertedColors);
  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 200));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));
  const resetZoom = () => setZoomLevel(100);

  const openFontLayoutMenu = () => {
    // open font layout menu
  };

  return (
    <div
      tabIndex={0}
      className='view-menu dropdown-content dropdown-right no-triangle z-20 mt-1 w-72 border bg-white shadow-2xl'
    >
      <div className='flex items-center justify-between rounded-md'>
        <button onClick={zoomOut} className='rounded-full p-2 hover:bg-gray-100'>
          <MdZoomOut size={20} />
        </button>
        <span
          className='btn btn-ghost h-8 min-h-8 w-[50%] rounded-md p-1 text-center hover:bg-gray-100'
          onClick={resetZoom}
        >
          {zoomLevel}%
        </span>
        <button onClick={zoomIn} className='rounded-full p-2 hover:bg-gray-100'>
          <MdZoomIn size={20} />
        </button>
      </div>
      <hr className='my-1' />
      <button
        className='flex w-full items-center rounded-md p-2 hover:bg-gray-100'
        onClick={toggleDarkMode}
      >
        <div className='flex items-center'>
          <span style={{ minWidth: '20px' }}>
            {isDarkMode ? <BiMoon size={20} /> : <BiSun size={20} />}
          </span>
        </div>
        <span className='ml-2'>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
      </button>
      <hr className='my-1' />

      <button
        className='flex w-full items-center justify-between rounded-md p-2 hover:bg-gray-100'
        onClick={openFontLayoutMenu}
      >
        <div className='flex items-center'>
          <span style={{ minWidth: '20px' }}></span>
          <span className='ml-2'>Font & Layout</span>
        </div>
        <span className='text-sm text-gray-400'>Shift+F</span>
      </button>
      <hr className='my-1' />
      <button
        className='flex w-full items-center justify-between rounded-md p-2 hover:bg-gray-100'
        onClick={toggleScrolledMode}
      >
        <div className='flex items-center'>
          <span style={{ minWidth: '20px' }}>
            {isScrolledMode && <MdCheck size={20} className='text-base-content' />}
          </span>
          <span className='ml-2'>Scrolled Mode</span>
        </div>
        <span className='text-sm text-gray-400'>Shift+J</span>
      </button>
      <button
        className='flex w-full items-center justify-between rounded-md p-2 hover:bg-gray-100'
        onClick={toggleInvertedColors}
      >
        <div className='flex items-center'>
          <span style={{ minWidth: '20px' }}>
            {isInvertedColors && <MdCheck size={20} className='text-base-content' />}
          </span>
          <span className='ml-2'>Invert Colors in Dark Mode</span>
        </div>
      </button>
    </div>
  );
};

export default ViewMenu;
