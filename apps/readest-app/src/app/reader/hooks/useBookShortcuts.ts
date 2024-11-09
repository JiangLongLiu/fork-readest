import { useReaderStore } from '@/store/readerStore';
import useShortcuts from '@/hooks/useShortcuts';

interface UseBookShortcutsProps {
  sideBarBookKey: string | null;
  bookKeys: string[];
  openSplitView: () => void;
  getNextBookKey: (bookKey: string) => string;
}

const useBookShortcuts = ({
  sideBarBookKey,
  bookKeys,
  openSplitView,
  getNextBookKey,
}: UseBookShortcutsProps) => {
  const { getView, getConfig, toggleSideBar, setSideBarBookKey } = useReaderStore();
  const config = getConfig(sideBarBookKey);
  const viewSettings = config?.viewSettings;
  const fontSize = viewSettings?.defaultFontSize ?? 16;
  const lineHeight = viewSettings?.lineHeight ?? 1.6;
  const distance = fontSize * lineHeight * 3;

  const switchSideBar = () => {
    if (sideBarBookKey) setSideBarBookKey(getNextBookKey(sideBarBookKey));
  };

  const goLeft = () => {
    getView(sideBarBookKey)?.goLeft();
  };

  const goRight = () => {
    getView(sideBarBookKey)?.goRight();
  };

  const goPrev = () => {
    getView(sideBarBookKey)?.prev(distance);
  };

  const goNext = () => {
    getView(sideBarBookKey)?.next(distance);
  };

  const reloadPage = () => {
    window.location.reload();
  };

  useShortcuts(
    {
      onOpenSplitView: openSplitView,
      onSwitchSideBar: switchSideBar,
      onToggleSideBar: toggleSideBar,
      onReloadPage: reloadPage,
      onGoLeft: goLeft,
      onGoRight: goRight,
      onGoPrev: goPrev,
      onGoNext: goNext,
    },
    [sideBarBookKey, bookKeys],
  );
};

export default useBookShortcuts;
