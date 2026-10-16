import React from 'react';

export interface PropTypes {
  use?: 'head' | 'foot';
  children?: React.ReactNode;
  className?: string;
  forwardedRef?: React.Ref<HTMLTableElement>;
}
