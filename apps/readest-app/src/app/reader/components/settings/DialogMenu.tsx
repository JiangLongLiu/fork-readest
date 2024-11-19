import React from 'react';
import { useReaderStore } from '@/store/readerStore';
import { MdCheck } from 'react-icons/md';

interface DialogMenuProps {
  toggleDropdown?: () => void;
}

const DialogMenu: React.FC<DialogMenuProps> = ({ toggleDropdown }) => {
  const { isFontLayoutSettingsGlobal, setFontLayoutSettingsGlobal } = useReaderStore();

  const handleToggleGlobal = () => {
    setFontLayoutSettingsGlobal(!isFontLayoutSettingsGlobal);
    toggleDropdown?.();
  };

  return (
    <div
      tabIndex={0}
      className='dropdown-content dropdown-right no-triangle border-base-200 z-20 mt-1 w-44 border shadow-2xl'
    >
      <button
        className='hover:bg-base-200 text-base-content flex w-full items-center justify-between rounded-md p-2'
        onClick={handleToggleGlobal}
      >
        <div className='flex items-center'>
          <span style={{ minWidth: '20px' }}>
            {isFontLayoutSettingsGlobal && <MdCheck size={20} className='text-base-content' />}
          </span>
          <div className='tooltip' data-tip='Uncheck for current book settings'>
            <span className='ml-2'>Global Settings</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default DialogMenu;
