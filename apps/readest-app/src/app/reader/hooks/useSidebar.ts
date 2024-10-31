import { useReaderStore } from '@/store/readerStore';
import { useEffect } from 'react';

const useSidebar = (initialWidth: string, isPinned: boolean) => {
  const { settings } = useReaderStore();
  const {
    sideBarWidth,
    setSideBarWidth,
    isSideBarVisible,
    setSideBarVisibility,
    toggleSideBar,
    isSideBarPinned,
    setSideBarPin,
    toggleSideBarPin,
  } = useReaderStore();

  useEffect(() => {
    setSideBarWidth(initialWidth);
    setSideBarPin(isPinned);
    setSideBarVisibility(isPinned);
  }, []);

  const handleSideBarResize = (newWidth: string) => {
    setSideBarWidth(newWidth);
    settings.globalReadSettings.sideBarWidth = newWidth;
  };

  const handleSideBarTogglePin = () => {
    toggleSideBarPin();
    settings.globalReadSettings.isSideBarPinned = !isSideBarPinned;
    if (isSideBarPinned && isSideBarVisible) setSideBarVisibility(false);
  };

  return {
    sideBarWidth,
    isSideBarPinned,
    isSideBarVisible,
    handleSideBarResize,
    handleSideBarTogglePin,
    setSideBarVisibility,
    toggleSideBar,
  };
};

export default useSidebar;
