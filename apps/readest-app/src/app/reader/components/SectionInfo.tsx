import React from 'react';

interface SectionInfoProps {
  chapter?: string;
}

const SectionInfo: React.FC<SectionInfoProps> = ({ chapter }) => {
  return (
    <div className='pageinfo absolute left-[4%] right-0 top-0 flex h-9 items-end'>
      <h2
        className='text-center font-sans font-extralight text-slate-500'
        style={{ fontSize: '10px' }}
      >
        {chapter || ''}
      </h2>
    </div>
  );
};

export default SectionInfo;
