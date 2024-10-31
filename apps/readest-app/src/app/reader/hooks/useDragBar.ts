import { useCallback } from 'react';

const useDragBar = (
  handleSideBarResize: (width: string) => void,
  minWidth: number,
  maxWidth: number,
) => {
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const newWidthPx = e.clientX;
      const width = `${Math.round((newWidthPx / window.innerWidth) * 10000) / 100}%`;
      const minWidthPx = minWidth * window.innerWidth;
      const maxWidthPx = maxWidth * window.innerWidth;
      if (newWidthPx >= minWidthPx && newWidthPx <= maxWidthPx) {
        handleSideBarResize(width);
      }
    },
    [handleSideBarResize, minWidth, maxWidth],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', handleMouseMove);
    });
  };

  return { handleMouseDown };
};

export default useDragBar;
