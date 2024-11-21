import React from 'react';
import { TbLayoutSidebarRight, TbLayoutSidebarRightFilled } from 'react-icons/tb';

import { useReaderStore } from '@/store/readerStore';
import Button from '@/components/Button';

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
    <Button
      icon={
        sideBarBookKey == bookKey && isNotebookVisible ? (
          <TbLayoutSidebarRightFilled size={20} className='text-base-content' />
        ) : (
          <TbLayoutSidebarRight size={20} className='text-base-content' />
        )
      }
      onClick={handleToggleSidebar}
      tooltip='Notebook'
      tooltipDirection='bottom'
    ></Button>
  );
};

export default NotebookToggler;
