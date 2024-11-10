import { useCallback } from 'react';

const useDragBar = (handleDragMove: (e: MouseEvent) => void) => {
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleDragMove(e);
    },
    [handleDragMove],
  );

  const handleMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, handleMouseUp],
  );

  return { handleMouseDown };
};

export default useDragBar;
