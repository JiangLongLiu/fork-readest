import React from 'react';

import { BookState, useReaderStore } from '@/store/readerStore';

import FoliateViewer from './FoliateViewer';
import getGridTemplate from '@/utils/grid';
import SectionInfo from './SectionInfo';
import HeaderBar from './HeaderBar';
import FooterBar from './FooterBar';
import PageInfo from './PageInfo';
import Ribbon from './Ribbon';
import SettingsDialog from './settings/SettingsDialog';
import Annotator from './annotator/Annotator';

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
        const { book, config, progress, bookDoc } = bookState;
        if (!book || !config || !progress || !bookDoc) return null;
        const { section, pageinfo, tocLabel: chapter } = progress;
        const marginGap = config.viewSettings ? `${config.viewSettings!.gapPercent!}%` : '';

        return (
          <div
            id={`gridcell-${bookKey}`}
            key={bookKey}
            className='relative h-full w-full overflow-hidden'
          >
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
            <Annotator bookKey={bookKey} />
            <FooterBar bookKey={bookKey} pageinfo={pageinfo} isHoveredAnim={false} />
            {isFontLayoutSettingsDialogOpen && <SettingsDialog bookKey={bookKey} config={config} />}
          </div>
        );
      })}
    </div>
  );
};

export default BookGrid;
