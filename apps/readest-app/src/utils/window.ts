export const tauriHandleMinimize = async () => {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  getCurrentWindow().minimize();
};

export const tauriHandleToggleMaximize = async () => {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  getCurrentWindow().toggleMaximize();
};

export const tauriHandleClose = async () => {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  getCurrentWindow().close();
};
