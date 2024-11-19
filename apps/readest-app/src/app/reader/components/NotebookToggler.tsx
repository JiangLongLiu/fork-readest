import React from 'react';
import { TbLayoutSidebarRight, TbLayoutSidebarRightFilled } from 'react-icons/tb';

import { useReaderStore } from '@/store/readerStore';

interface NotebookTogglerProps {
  bookKey: string;
}

const NotebookToggler: React.FC<NotebookTogglerProps> = ({ bookKey }) => {
  const { sideBarBookKey, isNotebookVisible, setSideBarBookKey, toggleNotebook } = useReaderStore();
  const handleToggleSidebar = () => {
    if (sideBarBookKey === bookKey) {
      toggleNotebook();
    } else {
      setSideBarBookKey(bookKey);
      if (!isNotebookVisible) toggleNotebook();
    }
  };
  return (
    <button onClick={handleToggleSidebar} className='p-2'>
      {sideBarBookKey == bookKey && isNotebookVisible ? (
        <TbLayoutSidebarRightFilled size={20} className='text-base-content' />
      ) : (
        <TbLayoutSidebarRight size={20} className='text-base-content' />
      )}
    </button>
  );
};

export default NotebookToggler;
