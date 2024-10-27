import React, { useEffect } from 'react';

const WindowButtons: React.FC = () => {
  useEffect(() => {
    const handleMouseDown = async (e: MouseEvent) => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (e.buttons === 1) {
        if (e.detail === 2) {
          getCurrentWindow().toggleMaximize();
        } else {
          getCurrentWindow().startDragging();
        }
      }
    };

    const header = document.getElementById('titlebar');
    header?.addEventListener('mousedown', handleMouseDown);
    return () => {
      header?.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleMinimize = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().close();
  };

  return (
    <div className='window-buttons ml-6 flex h-8 items-center justify-end space-x-2'>
      <button
        onClick={handleMinimize}
        className='window-button'
        aria-label='Minimize'
        id='titlebar-minimize'
      >
        <svg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'>
          <path fill='currentColor' d='M20 14H4v-2h16' />
        </svg>
      </button>

      <button
        onClick={handleMaximize}
        className='window-button'
        aria-label='Maximize/Restore'
        id='titlebar-maximize'
      >
        <svg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'>
          <path fill='currentColor' d='M4 4h16v16H4zm2 4v10h12V8z' />
        </svg>
      </button>

      <button
        onClick={handleClose}
        className='window-button'
        aria-label='Close'
        id='titlebar-close'
      >
        <svg xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' viewBox='0 0 24 24'>
          <path
            fill='currentColor'
            d='M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z'
          />
        </svg>
      </button>
    </div>
  );
};

export default WindowButtons;
