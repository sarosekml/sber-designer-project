import React from 'react';

export type FindOneOfElementsCallback = (names: string[]) => Element | undefined;

export interface FormScrollerProps {
  children: React.ReactNode;
  onFindElement: FindOneOfElementsCallback;
}
