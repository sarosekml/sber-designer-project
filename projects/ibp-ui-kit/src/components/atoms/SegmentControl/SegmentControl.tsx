import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import {
  segmentedControlStyles,
  useDisabledStyles,
  useSegmentStyles,
  useSelectedSegment,
  useUnselectedSegment,
} from './SegmentControl.styles';
import { SegmentControlProps } from './SegmentControl.types';

export const SegmentControl = React.memo(
  ({ selectedIndex = 0, onIndexChange, segmentsText = [], disabled = false, size = 'md' }: SegmentControlProps) => {
    const segmentStyles = useSegmentStyles({ size });
    const unselectedSegment = useUnselectedSegment;
    const selectedSegment = useSelectedSegment;
    const disabledStyles = useDisabledStyles;
    const handleClick = useCallback(
      (index) => {
        onIndexChange && onIndexChange(index);
      },
      [onIndexChange],
    );

    return (
      <Box sx={segmentedControlStyles}>
        {segmentsText?.map((text, index: number) => {
          return (
            <Box
              key={index}
              sx={[
                ...(Array.isArray(segmentStyles) ? segmentStyles : [segmentStyles]),

                ...(Array.isArray(selectedSegment) && selectedIndex === index ? selectedSegment : []),

                ...(Array.isArray(unselectedSegment) && selectedIndex !== index ? unselectedSegment : []),

                ...(Array.isArray(disabledStyles) && disabled ? disabledStyles : []),
              ]}
              onClick={() => handleClick(index)}
            >
              <Box>{text ?? null}</Box>
            </Box>
          );
        })}
      </Box>
    );
  },
);

SegmentControl.displayName = 'SegmentedControl';
