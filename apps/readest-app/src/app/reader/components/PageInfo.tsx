import React from 'react';

interface PageInfoProps {
  bookFormat: string;
  section?: { current: number; total: number };
  pageinfo?: { current: number; total: number };
  gapRight: string;
}

const PageInfo: React.FC<PageInfoProps> = ({ bookFormat, section, pageinfo, gapRight }) => {
  const pageInfo =
    bookFormat === 'PDF'
      ? section
        ? `${section.current + 1} / ${section.total}`
        : ''
      : pageinfo
        ? `Loc. ${pageinfo.current + 1} / ${pageinfo.total}`
        : '';

  return (
    <div
      className='pageinfo absolute bottom-0 left-0 right-0 flex h-12 items-center justify-end'
      style={{ paddingRight: gapRight }}
    >
      <h2 className='text-right font-sans text-xs font-extralight text-slate-500'>{pageInfo}</h2>
    </div>
  );
};

export default PageInfo;
