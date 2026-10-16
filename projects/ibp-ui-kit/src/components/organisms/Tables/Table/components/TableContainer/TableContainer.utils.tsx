import React from 'react';

export const shouldSkipScrollEvent = (e) => {
  const node = e.target;

  /**
   * Prevent nested scroll
   */
  return node !== e.currentTarget;
};

export const makeScrollEventChannel = (tableCode: string) => `ScrollChannel_${tableCode}`;
