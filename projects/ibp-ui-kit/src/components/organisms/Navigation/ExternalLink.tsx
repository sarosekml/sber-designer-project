import React from 'react';

import { Link } from '@/components/atoms/Link';

export const ExternalLink = React.forwardRef<any, { to: string }>(({ to, ...props }, ref) => (
  <Link dataTestId={to} href={to} target={'_blank'} referer="noreferer" innerRef={ref} {...props} />
));
