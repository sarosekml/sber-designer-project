import * as React from 'react';
import { SVGProps } from 'react';

const SvgNothingHereYet = (props: SVGProps<SVGSVGElement>) => (
  <svg width={195} height={140} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <clipPath id="NothingHereYet_svg__b">
        <path fill="#fff" fillOpacity={0} d="M0 0h195v140H0z" />
      </clipPath>
      <clipPath id="NothingHereYet_svg__a">
        <path fill="#fff" fillOpacity={0} d="M0 0h195v140H0z" />
      </clipPath>
    </defs>
    <g clipPath="url(#NothingHereYet_svg__a)">
      <g clipPath="url(#NothingHereYet_svg__b)">
        <path
          d="M97.41 28.73c3.16 1.77 5.07.53 5.72-1.98l1.07-4.13c1.14-4.42 5.43-4.36 10.27-1.66l46.24 26.01c5.26 2.94 7.42 5.53 5.71 11.74s-21.69 71.03-22.84 74.02c-1.14 2.99-4.78 4.44-10.66 1.15L43.31 83.73c-6.95-3.88-7.62-9.55-7.62-15.84L53.39 11c.96-2.93 3.08-5.23 6.66-3.18l37.36 20.91Z"
          fill="#A3CCC9"
        />
        <path
          d="M62.17 37.36c3.16 1.77 5.32 1.14 4.82-1.38l-.71-3.66c-.74-3.87 2.57-4.82 7.41-2.15l44.99 25.19c5.26 2.95 10.2 8.75 11.01 12.96l12.24 63.12c.91 4.71-3.12 5.86-9.01 2.56L43.31 83.86c-6.95-3.89-13.45-11.54-14.53-17.1l-9.46-48.79c-.55-2.87 1.9-3.56 5.48-1.56l37.37 20.95Z"
          fill="#B8D6D3"
        />
        <path
          d="M60.84 38.4c3.16 1.76 5.3 1.18 4.77-1.31l-.78-3.6c-.81-3.82 2.46-4.71 7.3-2.01l44.99 25.18c5.27 2.95 10.25 8.69 11.14 12.88l13.22 62.15c1 4.64-2.98 5.74-8.86 2.44L43 83.96c-6.95-3.89-13.53-11.48-14.69-16.95L18.09 18.96c-.6-2.82 1.81-3.48 5.39-1.47L60.84 38.4Z"
          fill="#E0F3F1"
        />
        <path
          d="M49.8 73.32c31.43 7.16 60.92 3.17 76.12-8.65 1.08 1.45 1.87 3.1 2.33 4.84l13.23 62.15c1 4.64-2.98 5.73-8.86 2.44L43 83.96c-6.95-3.89-13.53-11.48-14.69-16.95l-.09-.42c6.99 2.81 14.21 5.06 21.58 6.73Z"
          fill="#E0F3F1"
          opacity={0.3}
          style={{
            mixBlendMode: 'multiply',
          }}
        />
      </g>
    </g>
  </svg>
);
export default SvgNothingHereYet;
