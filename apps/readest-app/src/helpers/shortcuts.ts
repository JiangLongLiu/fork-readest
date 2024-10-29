export interface ShortcutConfig {
  switchSidebar: string[];
  toggleSidebar: string[];
  openSplitView: string[];
  reloadPage: string[];
  goLeft: string[];
  goRight: string[];
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  switchSidebar: ['ctrl+Tab', 'opt+Tab', 'alt+Tab'],
  toggleSidebar: ['t'],
  openSplitView: ['shift+s'],
  reloadPage: ['shift+r'],
  goLeft: ['ArrowLeft', 'PageUp', 'h'],
  goRight: ['ArrowRight', 'PageDown', 'l'],
};

// Load shortcuts from localStorage or fallback to defaults
export const loadShortcuts = (): ShortcutConfig => {
  const storedShortcuts = localStorage.getItem('customShortcuts');
  return storedShortcuts ? JSON.parse(storedShortcuts) : DEFAULT_SHORTCUTS;
};

// Save custom shortcuts to localStorage
export const saveShortcuts = (shortcuts: ShortcutConfig) => {
  localStorage.setItem('customShortcuts', JSON.stringify(shortcuts));
};
