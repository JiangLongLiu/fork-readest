import clsx from 'clsx';
import React, { useEffect } from 'react';
import { useState } from 'react';
import { BiMoon, BiSun } from 'react-icons/bi';
import { MdZoomOut, MdZoomIn, MdCheck } from 'react-icons/md';

import { useReaderStore } from '@/store/readerStore';

interface ViewMenuProps {
  bookKey: string;
  toggleDropdown?: () => void;
  onSetSettingsDialogOpen: (open: boolean) => void;
}

const ViewMenu: React.FC<ViewMenuProps> = ({
  bookKey,
  toggleDropdown,
  onSetSettingsDialogOpen,
}) => {
  const { books, setConfig, getFoliateView } = useReaderStore();
  const bookState = books[bookKey]!;
  const config = bookState.config!;

  const [isDarkMode, setDarkMode] = useState(config.viewSettings!.theme === 'dark');
  const [isScrolledMode, setScrolledMode] = useState(config.viewSettings!.scrolled);
  const [isInvertedColors, setInvertedColors] = useState(config.viewSettings!.invert);
  const [zoomLevel, setZoomLevel] = useState(config.viewSettings!.zoomLevel!);

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 200));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));
  const resetZoom = () => setZoomLevel(100);
  const toggleScrolledMode = () => setScrolledMode(!isScrolledMode);
  const toggleDarkMode = () => setDarkMode(!isDarkMode);
  const toggleInvertedColors = () => setInvertedColors(!isInvertedColors);

  const openFontLayoutMenu = () => {
    toggleDropdown?.();
    onSetSettingsDialogOpen(true);
  };

  useEffect(() => {
    const view = getFoliateView(bookKey);
    view?.renderer.setAttribute('flow', isScrolledMode ? 'scrolled' : 'paginated');
    config.viewSettings!.scrolled = isScrolledMode;
    setConfig(bookKey, config);
  }, [isScrolledMode]);

  useEffect(() => {
    document.body.classList.toggle('invert', isInvertedColors);
  }, [isInvertedColors]);

  useEffect(() => {
    const view = getFoliateView(bookKey);
    if (!view) return;
    if ('setStyles' in view.renderer) {
      // FIXME: zoom level is not working in paginated mode
      if (!config.viewSettings?.scrolled) return;
      view.renderer.setStyles(`body { zoom: ${zoomLevel}%; }`);
      config.viewSettings!.zoomLevel = zoomLevel;
      setConfig(bookKey, config);
    }
  }, [zoomLevel]);

  return (
    <div
      id='exclude-title-bar-mousedown'
      tabIndex={0}
      className='view-menu dropdown-content dropdown-right no-triangle z-20 mt-1 w-72 border bg-white shadow-2xl'
    >
      <div
        className={clsx(
          'flex items-center justify-between rounded-md',
          !isScrolledMode && 'text-gray-400',
        )}
      >
        <button
          onClick={zoomOut}
          className={clsx('rounded-full p-2 hover:bg-gray-100', !isScrolledMode && 'btn-disabled')}
        >
          <MdZoomOut size={20} />
        </button>
        <button
          className={clsx(
            'h-8 min-h-8 w-[50%] rounded-md p-1 text-center hover:bg-gray-100',
            !isScrolledMode && 'btn-disabled',
          )}
          onClick={resetZoom}
        >
          {zoomLevel}%
        </button>
        <button
          onClick={zoomIn}
          className={clsx('rounded-full p-2 hover:bg-gray-100', !isScrolledMode && 'btn-disabled')}
        >
          <MdZoomIn size={20} />
        </button>
      </div>

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
      <button
        className={clsx(
          'flex w-full items-center justify-between rounded-md p-2 hover:bg-gray-100',
          !isDarkMode && 'btn-disabled text-gray-400',
        )}
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
