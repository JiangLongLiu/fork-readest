import { useEffect, useRef } from 'react';

function useOutsideClick<T extends HTMLElement>(callback: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | Event) => {
      if (event instanceof MouseEvent) {
        if (ref.current && !ref.current.contains(event.target as Node)) {
          callback();
        }
      } else if (event instanceof MessageEvent) {
        if (event.data && event.data.type === 'iframe-mousedown') {
          callback();
        }
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('message', handleClickOutside);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('message', handleClickOutside);
    };
  }, []);

  return ref;
}

export default useOutsideClick;
