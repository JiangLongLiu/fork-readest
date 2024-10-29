import { useEffect, useState } from 'react';
import { loadShortcuts, ShortcutConfig } from '../helpers/shortcuts';

interface KeyActionHandlers {
  onSwitchSidebar?: () => void;
  onToggleSidebar?: () => void;
  onOpenSplitView?: () => void;
  onReloadPage?: () => void;
  onGoLeft?: () => void;
  onGoRight?: () => void;
}

const useShortcuts = (actions: KeyActionHandlers, dependencies: React.DependencyList = []) => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(loadShortcuts);

  useEffect(() => {
    const handleShortcutUpdate = () => {
      setShortcuts(loadShortcuts());
    };

    window.addEventListener('shortcutUpdate', handleShortcutUpdate);
    return () => window.removeEventListener('shortcutUpdate', handleShortcutUpdate);
  }, []);

  const parseShortcut = (shortcut: string) => {
    const keys = shortcut.toLowerCase().split('+');
    return {
      ctrlKey: keys.includes('ctrl'),
      altKey: keys.includes('alt') || keys.includes('opt'),
      metaKey: keys.includes('meta'),
      shiftKey: keys.includes('shift'),
      key: keys.find((k) => !['ctrl', 'alt', 'opt', 'meta', 'shift'].includes(k)),
    };
  };

  const isShortcutMatch = (
    shortcut: string,
    key: string,
    ctrlKey: boolean,
    altKey: boolean,
    metaKey: boolean,
    shiftKey: boolean,
  ) => {
    const parsedShortcut = parseShortcut(shortcut);
    return (
      parsedShortcut.key === key.toLowerCase() &&
      parsedShortcut.ctrlKey === ctrlKey &&
      parsedShortcut.altKey === altKey &&
      parsedShortcut.metaKey === metaKey &&
      parsedShortcut.shiftKey === shiftKey
    );
  };

  const processKeyEvent = (
    key: string,
    ctrlKey: boolean,
    altKey: boolean,
    metaKey: boolean,
    shiftKey: boolean,
  ) => {
    if (
      shortcuts.switchSidebar.some((shortcut) =>
        isShortcutMatch(shortcut, key, ctrlKey, altKey, metaKey, shiftKey),
      )
    ) {
      actions.onSwitchSidebar?.();
      return true;
    }
    if (
      shortcuts.toggleSidebar.some((shortcut) =>
        isShortcutMatch(shortcut, key, ctrlKey, altKey, metaKey, shiftKey),
      )
    ) {
      actions.onToggleSidebar?.();
      return true;
    }
    if (
      shortcuts.openSplitView.some((shortcut) =>
        isShortcutMatch(shortcut, key, ctrlKey, altKey, metaKey, shiftKey),
      )
    ) {
      actions.onOpenSplitView?.();
      return true;
    }
    if (
      shortcuts.reloadPage.some((shortcut) =>
        isShortcutMatch(shortcut, key, ctrlKey, altKey, metaKey, shiftKey),
      )
    ) {
      actions.onReloadPage?.();
      return true;
    }
    if (
      shortcuts.goLeft.some((shortcut) =>
        isShortcutMatch(shortcut, key, ctrlKey, altKey, metaKey, shiftKey),
      )
    ) {
      actions.onGoLeft?.();
      return true;
    }
    if (
      shortcuts.goRight.some((shortcut) =>
        isShortcutMatch(shortcut, key, ctrlKey, altKey, metaKey, shiftKey),
      )
    ) {
      actions.onGoRight?.();
      return true;
    }
    return false;
  };

  const unifiedHandleKeyDown = (event: KeyboardEvent | MessageEvent) => {
    if (event instanceof KeyboardEvent) {
      const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
      const handled = processKeyEvent(key.toLowerCase(), ctrlKey, altKey, metaKey, shiftKey);
      if (handled) event.preventDefault();
    } else if (
      event instanceof MessageEvent &&
      event.data &&
      event.data.type === 'iframe-keydown'
    ) {
      const { key, ctrlKey, altKey, metaKey, shiftKey } = event.data;
      processKeyEvent(key.toLowerCase(), ctrlKey, altKey, metaKey, shiftKey);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', unifiedHandleKeyDown);
    window.addEventListener('message', unifiedHandleKeyDown);

    return () => {
      window.removeEventListener('keydown', unifiedHandleKeyDown);
      window.removeEventListener('message', unifiedHandleKeyDown);
    };
  }, [shortcuts, ...dependencies]);
};

export default useShortcuts;
