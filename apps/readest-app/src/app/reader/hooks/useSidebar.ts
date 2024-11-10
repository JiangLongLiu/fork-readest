import { useReaderStore } from '@/store/readerStore';
import { useEffect } from 'react';

const useSidebar = (initialWidth: string, isPinned: boolean) => {
  const { settings } = useReaderStore();
  const {
    sideBarWidth,
    isSideBarVisible,
    isSideBarPinned,
    setSideBarWidth,
    setSideBarVisible,
    setSideBarPin,
    toggleSideBar,
    toggleSideBarPin,
  } = useReaderStore();

  useEffect(() => {
    setSideBarWidth(initialWidth);
    setSideBarPin(isPinned);
    setSideBarVisible(isPinned);
  }, []);

  const handleSideBarResize = (newWidth: string) => {
    setSideBarWidth(newWidth);
    settings.globalReadSettings.sideBarWidth = newWidth;
  };

  const handleSideBarTogglePin = () => {
    toggleSideBarPin();
    settings.globalReadSettings.isSideBarPinned = !isSideBarPinned;
    if (isSideBarPinned && isSideBarVisible) setSideBarVisible(false);
  };

  return {
    sideBarWidth,
    isSideBarPinned,
    isSideBarVisible,
    handleSideBarResize,
    handleSideBarTogglePin,
    setSideBarVisible,
    toggleSideBar,
  };
};

export default useSidebar;
