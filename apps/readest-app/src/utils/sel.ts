export interface Frame {
  top: number;
  left: number;
}

export interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Point {
  x: number;
  y: number;
}

export type PositionDir = 'up' | 'down';

export interface Position {
  point: Point;
  dir?: PositionDir;
}

const frameRect = (frame: Frame, rect: Rect, sx = 1, sy = 1) => {
  const left = sx * rect.left + frame.left;
  const right = sx * rect.right + frame.left;
  const top = sy * rect.top + frame.top;
  const bottom = sy * rect.bottom + frame.top;
  return { left, right, top, bottom };
};

const pointIsInView = ({ x, y }: Point) =>
  x > 0 && y > 0 && x < window.innerWidth && y < window.innerHeight;

const getIframeElement = (range: Range): HTMLIFrameElement | null => {
  let node: Node | null = range.commonAncestorContainer;

  while (node) {
    if (node.nodeType === Node.DOCUMENT_NODE) {
      const doc = node as Document;
      if (doc.defaultView && doc.defaultView.frameElement) {
        return doc.defaultView.frameElement as HTMLIFrameElement;
      }
    }
    node = node.parentNode;
  }

  return null;
};

export const getPosition = (target: Range, offset = { x: 0, y: 0 }) => {
  // TODO: vertical text
  const frameElement = getIframeElement(target);
  const transform = frameElement ? getComputedStyle(frameElement).transform : '';
  const match = transform.match(/matrix\((.+)\)/);
  const [sx, , , sy] = match?.[1]?.split(/\s*,\s*/)?.map((x) => parseFloat(x)) ?? [];

  const frame = frameElement?.getBoundingClientRect() ?? { top: 0, left: 0 };
  const rects = Array.from(target.getClientRects());
  const first = frameRect(frame, rects[0] as Rect, sx, sy);
  const last = frameRect(frame, rects.at(-1) as Rect, sx, sy);
  const start = {
    point: { x: (first.left + first.right) / 2 - offset.x, y: first.top - offset.y },
    dir: 'up',
  } as Position;
  const end = {
    point: { x: (last.left + last.right) / 2 - offset.x, y: last.bottom - offset.y },
    dir: 'down',
  } as Position;
  const startInView = pointIsInView(start.point);
  const endInView = pointIsInView(end.point);
  if (!startInView && !endInView) return { point: { x: 0, y: 0 } };
  if (!startInView) return end;
  if (!endInView) return start;
  return start.point.y > window.innerHeight - end.point.y ? start : end;
};
