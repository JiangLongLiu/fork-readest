import { useReaderStore } from '@/store/readerStore';
import clsx from 'clsx';
import React from 'react';

interface SectionInfoProps {
  chapter?: string;
  gapLeft: string;
}

const SectionInfo: React.FC<SectionInfoProps> = ({ chapter, gapLeft }) => {
  const { isSideBarVisible } = useReaderStore();
  return (
    <div
      className={clsx(
        'pageinfo absolute right-0 top-0 flex items-end',
        isSideBarVisible ? 'h-[30px]' : 'h-[44px]',
      )}
      style={{ left: gapLeft }}
    >
      <h2 className='text-center font-sans text-xs font-light text-slate-500'>{chapter || ''}</h2>
    </div>
  );
};

export default SectionInfo;
