import { useEffect, useState } from 'react';

const useFullScreen = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleSwitchFullScreen = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const currentWindow = getCurrentWindow();
    currentWindow.listen('will-enter-fullscreen', () => {
      console.log('Window entered fullscreen');
      setIsFullScreen(true);
    });

    currentWindow.listen('will-exit-fullscreen', () => {
      console.log('Window exited fullscreen');
      setIsFullScreen(false);
    });
  };

  useEffect(() => {
    handleSwitchFullScreen();
  }, []);

  return { isFullScreen };
};

export default useFullScreen;
