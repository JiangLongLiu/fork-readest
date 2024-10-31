import clsx from 'clsx';
import React from 'react';

interface SectionInfoProps {
  chapter?: string;
  gapLeft: string;
}

const SectionInfo: React.FC<SectionInfoProps> = ({ chapter, gapLeft }) => {
  return (
    <div
      className={clsx('pageinfo absolute right-0 top-0 flex h-8 items-end')}
      style={{ left: gapLeft }}
    >
      <h2 className='text-center font-sans font-light text-slate-500' style={{ fontSize: '10px' }}>
        {chapter || ''}
      </h2>
    </div>
  );
};

export default SectionInfo;
