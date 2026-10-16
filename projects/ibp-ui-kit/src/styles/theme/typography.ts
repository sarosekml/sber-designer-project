import { TypographyVariantsOptions } from '@mui/material';

export const fontFamilies = {
  SBDisplay: 'SB Sans Display, sans-serif',
  SBText: 'SB Sans Text, sans-serif',
  SBTextCond: 'SB Sans Text Cond, sans-serif',
  SBScreen: 'SB Sans Screen, sans-serif',
};

export type TextTypes = keyof Pick<
  TypographyVariantsOptions,
  | 'H1Light'
  | 'H2Light'
  | 'H3StrongSmb'
  | 'H3Reg'
  | 'H4StrongExtensiveSmb'
  | 'H4StrongSmb'
  | 'H4Reg'
  | 'H5StrongSmb'
  | 'H5Reg'
  | 'H6StrongSmb'
  | 'H6Reg'
  | 'BodyXLReg'
  | 'BodyXLStrongSmb'
  | 'BodyLReg'
  | 'BodyLStrongSmb'
  | 'BodyMExtensive'
  | 'BodyMReg'
  | 'BodyMStrongSmb'
  | 'BodySReg'
  | 'BodySStrongSmb'
  | 'BodyXSExtensive'
  | 'BodyXSReg'
  | 'DisplayL'
  | 'DisplayM'
  | 'DisplayS'
  | 'ButtonL'
  | 'ButtonM'
  | 'ButtonS'
  | 'ButtonXS'
>;

export const typography: TypographyVariantsOptions = {
  fontFamily: ['SB Sans Text', 'sans-serif'].join(','),
  fontSize: 16,
  lineHeight: '20px',
  fontWeight: 400,

  /** Header text */
  H1Light: {
    fontSize: '52px',
    fontWeight: 400,
    lineHeight: '68px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H2Light: {
    fontSize: '42px',
    fontWeight: 400,
    lineHeight: '52px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H3StrongSmb: {
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: '32px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H3Reg: {
    fontSize: '28px',
    fontWeight: 400,
    lineHeight: '32px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H4StrongExtensiveSmb: {
    fontSize: '22px',
    fontWeight: 600,
    lineHeight: '28px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H4StrongSmb: {
    fontSize: '22px',
    fontWeight: 600,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H4Reg: {
    fontSize: '22px',
    fontWeight: 400,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H5StrongSmb: {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H5Reg: {
    fontSize: '18px',
    fontWeight: 400,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H6StrongSmb: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '20px',
    fontFamily: fontFamilies.SBDisplay,
  },
  H6Reg: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '20px',
    fontFamily: fontFamilies.SBDisplay,
  },

  /** Page text */
  BodyXLReg: {
    fontSize: '24px',
    fontWeight: 400,
    lineHeight: '32px',
    fontFamily: fontFamilies.SBText,
  },
  BodyXLStrongSmb: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: '32px',
    fontFamily: fontFamilies.SBText,
  },
  BodyLReg: {
    fontSize: '18px',
    fontWeight: 400,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBText,
  },
  BodyLStrongSmb: {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBText,
  },
  BodyMExtensive: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBText,
  },
  BodyMReg: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '20px',
    fontFamily: fontFamilies.SBText,
  },
  BodyMStrongSmb: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '20px',
    fontFamily: fontFamilies.SBText,
  },
  BodySReg: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '16px',
    fontFamily: fontFamilies.SBText,
  },
  BodySStrongSmb: {
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: '16px',
    fontFamily: fontFamilies.SBText,
  },
  BodyXSExtensive: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '20px',
    fontFamily: fontFamilies.SBText,
  },
  BodyXSReg: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '16px',
    fontFamily: fontFamilies.SBText,
  },

  DisplayL: {
    fontSize: '36px',
    fontWeight: 400,
    lineHeight: '48px',
    fontFamily: fontFamilies.SBTextCond,
  },
  DisplayM: {
    fontSize: '24px',
    fontWeight: 400,
    lineHeight: '40px',
    fontFamily: fontFamilies.SBTextCond,
  },
  DisplayS: {
    fontSize: '20px',
    fontWeight: 400,
    lineHeight: '32px',
    fontFamily: fontFamilies.SBTextCond,
  },

  ButtonL: {
    fontSize: '24px',
    fontWeight: 400,
    lineHeight: '32px',
    fontFamily: fontFamilies.SBScreen,
  },
  ButtonM: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    fontFamily: fontFamilies.SBScreen,
  },
  ButtonS: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '20px',
    fontFamily: fontFamilies.SBScreen,
  },
  ButtonXS: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '16px',
    fontFamily: fontFamilies.SBScreen,
  },
};
