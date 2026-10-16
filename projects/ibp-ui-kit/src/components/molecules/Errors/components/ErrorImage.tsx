import React from 'react';

import { Forbidden, FrontendFail, NothingHereYet, ServerFail } from '@/assets';
import SvgNotFound from '@/assets/images/NotFound';

import { ErrorReason } from '../ErrorSection/ErrorSection.types';

interface ErrorImageProps {
  reason: ErrorReason;
}

export const ErrorImage = ({ reason }: ErrorImageProps) => {
  if (reason === 'Forbidden') return <Forbidden />;
  if (reason === 'ServerFail') return <ServerFail />;
  if (reason === 'FrontendFail') return <FrontendFail />;
  if (reason === 'NothingHereYet') return <NothingHereYet />;
  return <SvgNotFound />;
};
