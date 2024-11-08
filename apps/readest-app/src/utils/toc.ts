import { TOCItem } from '@/libs/document';

export const findParentPath = (toc: TOCItem[], href: string): TOCItem[] => {
  for (const item of toc) {
    if (item.href === href) {
      return [item];
    }
    if (item.subitems) {
      const path = findParentPath(item.subitems, href);
      if (path.length) {
        return [item, ...path];
      }
    }
  }
  return [];
};

export const updateTocID = (items: TOCItem[], index = 0): number => {
  items.forEach((item) => {
    if (item.id === undefined) {
      item.id = index++;
    }
    if (item.subitems) {
      index = updateTocID(item.subitems, index);
    }
  });
  return index;
};
