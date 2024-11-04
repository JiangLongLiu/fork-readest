import React from 'react';

import { BookState, useReaderStore } from '@/store/readerStore';

import SettingsDialog from './settings/SettingsDialog';
import FoliateViewer from './FoliateViewer';
import getGridTemplate from '@/utils/grid';
import SectionInfo from './SectionInfo';
import HeaderBar from './HeaderBar';
import FooterBar from './FooterBar';
import PageInfo from './PageInfo';
import Ribbon from './Ribbon';

interface BookGridProps {
  bookKeys: string[];
  bookStates: BookState[];
  onCloseBook: (bookKey: string) => void;
}

const BookGrid: React.FC<BookGridProps> = ({ bookKeys, bookStates, onCloseBook }) => {
  const { isSideBarPinned, isSideBarVisible, sideBarWidth, bookmarkRibbons } = useReaderStore();
  const { isFontLayoutSettingsDialogOpen, setFontLayoutSettingsDialogOpen } = useReaderStore();
  const gridWidth = isSideBarPinned && isSideBarVisible ? `calc(100% - ${sideBarWidth})` : '100%';
  const gridTemplate = getGridTemplate(bookKeys.length, window.innerWidth / window.innerHeight);

  return (
    <div
      className='grid h-full'
      style={{
        width: gridWidth,
        gridTemplateColumns: gridTemplate.columns,
        gridTemplateRows: gridTemplate.rows,
      }}
    >
      {bookStates.map((bookState, index) => {
        const bookKey = bookKeys[index]!;
        const isBookmarked = bookmarkRibbons[bookKey];
        const { book, config, bookDoc } = bookState;
        if (!book || !config || !bookDoc) return null;
        const { section, pageinfo, progress, chapter } = config;
        const marginGap = config.viewSettings ? `${config.viewSettings!.gapPercent!}%` : '';

        return (
          <div key={bookKey} className='relative h-full w-full overflow-hidden'>
            {isBookmarked && <Ribbon width={marginGap} />}
            <HeaderBar
              bookKey={bookKey}
              bookTitle={book.title}
              isHoveredAnim={bookStates.length > 2}
              onCloseBook={onCloseBook}
              onSetSettingsDialogOpen={setFontLayoutSettingsDialogOpen}
            />
            <FoliateViewer bookKey={bookKey} bookDoc={bookState.bookDoc!} bookConfig={config} />
            {config.viewSettings!.scrolled ? null : (
              <>
                <SectionInfo chapter={chapter} gapLeft={marginGap} />
                <PageInfo
                  bookFormat={book.format}
                  section={section}
                  pageinfo={pageinfo}
                  gapRight={marginGap}
                />
              </>
            )}
            <FooterBar bookKey={bookKey} progress={progress} isHoveredAnim={false} />
            {isFontLayoutSettingsDialogOpen && <SettingsDialog bookKey={bookKey} config={config} />}
          </div>
        );
      })}
    </div>
  );
};

export default BookGrid;
