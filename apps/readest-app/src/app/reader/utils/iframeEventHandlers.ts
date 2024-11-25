const doubleClickThreshold = 250;
const longHoldThreshold = 500;
let lastClickTime = 0;
let longHoldTimeout: ReturnType<typeof setTimeout> | null = null;

export const handleKeydown = (bookKey: string, event: KeyboardEvent) => {
  if (['Backspace', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
  }
  window.postMessage(
    {
      type: 'iframe-keydown',
      bookKey,
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    },
    '*',
  );
};

export const handleMousedown = (bookKey: string, event: MouseEvent) => {
  longHoldTimeout = setTimeout(() => {
    longHoldTimeout = null;
  }, longHoldThreshold);
  window.postMessage(
    {
      type: 'iframe-mousedown',
      bookKey,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    },
    '*',
  );
};

export const handleMouseup = (bookKey: string, event: MouseEvent) => {
  window.postMessage(
    {
      type: 'iframe-mouseup',
      bookKey,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    },
    '*',
  );
};

export const handleClick = (bookKey: string, event: MouseEvent) => {
  const now = Date.now();

  if (now - lastClickTime < doubleClickThreshold) {
    lastClickTime = now;
    window.postMessage(
      {
        type: 'iframe-double-click',
        bookKey,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: event.offsetX,
        offsetY: event.offsetY,
      },
      '*',
    );
    return;
  }

  lastClickTime = now;

  setTimeout(() => {
    if (Date.now() - lastClickTime >= doubleClickThreshold) {
      let element: HTMLElement | null = event.target as HTMLElement;
      while (element) {
        if (element.tagName.toLowerCase() === 'a') {
          return;
        }
        element = element.parentElement;
      }

      if (!longHoldTimeout) {
        return;
      }

      window.postMessage(
        {
          type: 'iframe-single-click',
          bookKey,
          screenX: event.screenX,
          screenY: event.screenY,
          clientX: event.clientX,
          clientY: event.clientY,
          offsetX: event.offsetX,
          offsetY: event.offsetY,
        },
        '*',
      );
    }
  }, doubleClickThreshold);
};
