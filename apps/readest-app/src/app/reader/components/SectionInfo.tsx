import clsx from 'clsx';
import React from 'react';

import { useReaderStore } from '@/store/readerStore';
import useTrafficLight from '@/hooks/useTrafficLight';

interface SectionInfoProps {
  chapter?: string;
  gapLeft: string;
}

const SectionInfo: React.FC<SectionInfoProps> = ({ chapter, gapLeft }) => {
  const { isSideBarVisible } = useReaderStore();
  const { isTrafficLightVisible } = useTrafficLight();
  return (
    <div
      className={clsx(
        'pageinfo absolute right-0 top-0 flex items-end',
        isTrafficLightVisible && !isSideBarVisible ? 'h-[44px]' : 'h-[30px]',
      )}
      style={{ left: gapLeft }}
    >
      <h2 className='text-center font-sans text-xs font-light text-slate-500'>{chapter || ''}</h2>
    </div>
  );
};

export default SectionInfo;
