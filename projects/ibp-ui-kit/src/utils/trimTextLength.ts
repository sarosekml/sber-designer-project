import React from 'react';

export const trimTextLength = (itemTitle: React.ReactNode, trimLength: number): NonNullable<React.ReactNode> =>
  itemTitle && typeof itemTitle === 'string' && itemTitle.length > trimLength
    ? `${itemTitle.slice(0, trimLength).trim()}...`
    : itemTitle ?? '';
