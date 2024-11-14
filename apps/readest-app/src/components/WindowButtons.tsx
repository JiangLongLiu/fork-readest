import clsx from 'clsx';
import React, { useEffect, useRef } from 'react';

interface WindowButtonsProps {
  className?: string;
  headerRef?: React.RefObject<HTMLDivElement>;
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
}

const WindowButtons: React.FC<WindowButtonsProps> = ({
  className,
  headerRef,
  showMinimize = true,
  showMaximize = true,
  showClose = true,
  onMinimize,
  onToggleMaximize,
  onClose,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = async (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (
      target.closest('#titlebar-minimize') ||
      target.closest('#titlebar-maximize') ||
      target.closest('#titlebar-close')
    ) {
      return;
    }

    if (target.closest('#exclude-title-bar-mousedown')) {
      return;
    }

    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    if (e.buttons === 1) {
      if (e.detail === 2) {
        getCurrentWindow().toggleMaximize();
      } else {
        getCurrentWindow().startDragging();
      }
    }
  };

  useEffect(() => {
    const headerElement = headerRef?.current;
    headerElement?.addEventListener('mousedown', handleMouseDown);

    return () => {
      headerElement?.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleMinimize = async () => {
    if (onMinimize) {
      onMinimize();
    }
  };

  const handleMaximize = async () => {
    if (onToggleMaximize) {
      onToggleMaximize();
    }
  };

  const handleClose = async () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      ref={parentRef}
      className={clsx(
        'window-buttons flex h-8 items-center justify-end space-x-2 pl-6',
        showClose || showMaximize || showMinimize ? 'visible' : 'hidden',
        className,
      )}
    >
      {showMinimize && (
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
      )}

      {showMaximize && (
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
      )}

      {showClose && (
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
      )}
    </div>
  );
};

export default WindowButtons;
