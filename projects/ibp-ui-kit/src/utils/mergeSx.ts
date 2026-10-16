import type { SxProps, Theme } from '@mui/material';

export type PureSx = Exclude<SxProps<Theme>, ReadonlyArray<any>>;
export type SxArray = Array<PureSx>;
export type Sx = SxProps<Theme>;

export const isSxArray = (sx: SxProps<Theme>): sx is any[] => Array.isArray(sx);

/** @deprecated Use actual version from core lib "./src/utils/customLodash" */
export const isNotEmpty = <T>(item: T | false | undefined | null): item is T => !!item;

/**
 * the type system for mergeSx is  simplified **intentionally** so as not to overload TS processing
 */
export const mergeSx = (...styles: (SxProps<Theme> | false | undefined)[]): SxArray =>
  styles
    .filter(isNotEmpty)
    .reduce<SxArray>((acc, sx) => (isSxArray(sx) ? ([...acc, ...sx] as SxArray) : ([...acc, sx] as SxArray)), []);
