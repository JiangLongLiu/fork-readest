import { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';

/**
 * Custom hook to get the visibility of the traffic light (window control buttons on macOS)
 * based on the fullscreen state of the application window.
 *
 * @returns {Object} An object containing:
 * - `isTrafficLightVisible` (boolean): A state indicating whether the traffic light is visible.
 */
const useTrafficLight = () => {
  const { appService } = useEnv();
  const [isTrafficLightVisible, setVisible] = useState(appService?.hasTrafficLight ?? false);
  let unlistenEnterFullScreen: () => void;
  let unlistenExitFullScreen: () => void;

  const handleSwitchFullScreen = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const currentWindow = getCurrentWindow();
    const isFullscreen = await currentWindow.isFullscreen();
    if (appService?.hasTrafficLight) setVisible(!isFullscreen);

    unlistenEnterFullScreen = await currentWindow.listen('will-enter-fullscreen', () => {
      if (appService?.hasTrafficLight) setVisible(false);
    });

    unlistenExitFullScreen = await currentWindow.listen('will-exit-fullscreen', () => {
      if (appService?.hasTrafficLight) setVisible(true);
    });
  };

  useEffect(() => {
    if (!appService?.hasTrafficLight) return;

    handleSwitchFullScreen();

    return () => {
      unlistenEnterFullScreen?.();
      unlistenExitFullScreen?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isTrafficLightVisible };
};

export default useTrafficLight;
