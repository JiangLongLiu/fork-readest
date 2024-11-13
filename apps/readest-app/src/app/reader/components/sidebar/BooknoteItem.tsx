import clsx from 'clsx';
import React from 'react';

import { useEnv } from '@/context/EnvContext';
import { BookNote } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import useScrollToItem from '../../hooks/useScrollToItem';

interface BooknoteItemProps {
  bookKey: string;
  item: BookNote;
  editable?: boolean;
}

const BooknoteItem: React.FC<BooknoteItemProps> = ({ bookKey, item, editable = false }) => {
  const { envConfig } = useEnv();
  const { settings, getConfig, saveConfig, getProgress, getView } = useReaderStore();
  const { updateBooknotes, setNotebookEditAnnotation, setNotebookVisible } = useReaderStore();

  const { text, cfi, note } = item;
  const progress = getProgress(bookKey);
  const { isCurrent, viewRef } = useScrollToItem(cfi, progress);

  const handleClickItem = (event: React.MouseEvent) => {
    event.preventDefault();
    getView(bookKey)?.goTo(cfi);
    if (note) {
      setNotebookVisible(true);
    }
  };

  const deleteNote = (note: BookNote) => {
    if (!bookKey) return;
    const config = getConfig(bookKey);
    if (!config) return;
    const { booknotes = [] } = config;
    const updatedNotes = booknotes.filter((item) => item.id !== note.id);
    const updatedConfig = updateBooknotes(bookKey, updatedNotes);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }
  };

  const editNote = (note: BookNote) => {
    setNotebookEditAnnotation(note);
  };

  return (
    <li
      ref={viewRef}
      className={clsx(
        'border-base-300 my-2 cursor-pointer rounded-lg p-2 text-sm',
        editable && 'collapse-arrow collapse',
        isCurrent ? 'bg-base-300 hover:bg-gray-300/70' : 'hover:bg-base-300 bg-white',
      )}
      tabIndex={0}
      onClick={handleClickItem}
    >
      <div
        className={clsx('collapse-title min-h-4 p-0', editable && 'pr-4')}
        style={
          {
            '--top-override': '0.7rem',
            '--end-override': '0.3rem',
          } as React.CSSProperties
        }
      >
        {item.note && <span className='line-clamp-3 font-normal'>{item.note}</span>}
        <div className='flex items-start'>
          {item.note && (
            <div className='my-1 mr-2 min-h-full self-stretch border-l-2 border-gray-300'></div>
          )}
          <div className='line-clamp-3'>
            <span
              className={clsx(
                'inline',
                item.note && 'text-xs text-gray-500',
                (item.style === 'underline' || item.style === 'squiggly') &&
                  'underline decoration-2',
                item.style === 'highlight' && `bg-${item.color}-100`,
                item.style === 'underline' && `decoration-${item.color}-400`,
                item.style === 'squiggly' && `decoration-wavy decoration-${item.color}-400`,
              )}
            >
              {text || ''}
            </span>
          </div>
        </div>
      </div>
      {editable && (
        <div
          className={clsx('collapse-content invisible !p-0 text-xs')}
          style={
            {
              '--bottom-override': 0,
            } as React.CSSProperties
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div className='flex justify-end space-x-3'>
            <button
              className={clsx(
                'btn btn-ghost settings-content hover:bg-transparent',
                'flex h-4 min-h-4 items-end p-0',
              )}
              onClick={editNote.bind(null, item)}
            >
              <div className='align-bottom text-xs text-blue-400'>Edit</div>
            </button>
            <button
              className={clsx(
                'btn btn-ghost settings-content hover:bg-transparent',
                'flex h-4 min-h-4 items-end p-0',
              )}
              onClick={deleteNote.bind(null, item)}
            >
              <div className='align-bottom text-xs text-red-400'>Delete</div>
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

export default BooknoteItem;
