import React from 'react';
import clsx from 'clsx';
import { RiArrowLeftWideLine, RiArrowRightWideLine } from 'react-icons/ri';

import { useReaderStore } from '@/store/readerStore';

interface FooterBarProps {
  bookKey: string;
  pageinfo: { current: number; total: number } | undefined;
  isHoveredAnim: boolean;
}

const FooterBar: React.FC<FooterBarProps> = ({ bookKey, pageinfo, isHoveredAnim }) => {
  const { isSideBarVisible, hoveredBookKey, setHoveredBookKey, getView } = useReaderStore();

  const handleProgressChange = (event: React.ChangeEvent) => {
    const newProgress = parseInt((event.target as HTMLInputElement).value, 10);
    getView(bookKey)?.goToFraction(newProgress / 100.0);
  };

  const handleGoPrev = () => {
    getView(bookKey)?.goLeft();
  };

  const handleGoNext = () => {
    getView(bookKey)?.goRight();
  };
  const pageinfoValid = pageinfo && pageinfo.total > 0 && pageinfo.current >= 0;
  const progressFraction = pageinfoValid ? pageinfo.current / pageinfo.total : 0;
  return (
    <div
      className={clsx(
        'footer-bar absolute bottom-0 z-10 flex h-12 w-full items-center px-4',
        'shadow-xs bg-base-100 rounded-window-bottom-right transition-opacity duration-300',
        !isSideBarVisible && 'rounded-window-bottom-left',
        isHoveredAnim && 'hover-bar-anim',
        hoveredBookKey === bookKey ? `opacity-100` : `opacity-0`,
      )}
      onMouseEnter={() => setHoveredBookKey(bookKey)}
      onMouseLeave={() => setHoveredBookKey('')}
    >
      <button className='btn btn-ghost mx-2 h-8 min-h-8 w-8 p-0' onClick={handleGoPrev}>
        <RiArrowLeftWideLine size={20} />
      </button>
      <span className='mx-2 text-center text-sm text-black'>
        {pageinfoValid ? `${Math.round(progressFraction * 100)}%` : ''}
      </span>
      <input
        type='range'
        className='mx-2 w-full'
        min={0}
        max={100}
        value={pageinfoValid ? progressFraction * 100 : 0}
        onChange={(e) => handleProgressChange(e)}
      />
      <button className='btn btn-ghost mx-2 h-8 min-h-8 w-8 p-0' onClick={handleGoNext}>
        <RiArrowRightWideLine size={20} />
      </button>
    </div>
  );
};

export default FooterBar;
