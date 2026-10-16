import { CSSProperties } from 'react';
import { createTheme } from '@mui/material';
import { unstable_ClassNameGenerator as ClassNameGenerator } from '@mui/material/className';

import { breakpoints } from './breakpoints';
import { components } from './components';
import { palette } from './palette';
import { typography } from './typography';

/**
 * @docs - Material original docs
 * Every Material UI component has ${componentName}-${slot} classname format.
 * For example, the component name of Chip is MuiChip,
 * which is used as a global class name for every <Chip /> element.
 * You can remove/change the Mui prefix.
 *
 * * ClassNameGenerator.configure must be called before any Material UI components import
 * * You should always use [component]Classes for theming/customization to get the correct generated class name.
 * * This API should only be used at build-time
 * * The configuration is applied to all of the components across the application.
 *   You cannot target a specific part of the application.
 * */
export const addDmbPrefix = (componentName: string) => `dmb-uikit-${componentName}`;
ClassNameGenerator.configure(addDmbPrefix);

/** Create general UI-KIT theme with full own parameters from design system */
export const theme = createTheme({
  spacing: 4,
  shape: { borderRadius: 4 },
  breakpoints: {
    values: {
      xs: breakpoints.xs,
      sm: breakpoints.sm,
      md: breakpoints.md,
      lg: breakpoints.lg,
      lp: breakpoints.lp,
      xl: breakpoints.xl,
    },
  },
  typography,
  components,
  palette,
});

/**
 * Declaration need because of this typings rewrite base mui type to own ui-kit type which we want to use.
 * This is official variant from mui team:
 * https://mui.com/material-ui/customization/breakpoints/
 * https://mui.com/material-ui/customization/typography/
 * https://mui.com/material-ui/customization/palette/
 *
 * P.S. Need to write it here, because all overriding should be in one declare module - consequentially
 * */
declare module '@mui/material/styles' {
  /** Override for breakpoints base type */
  interface BreakpointOverrides {
    xs: true;
    sm: true;
    md: true;
    lg: true;
    lp: true;
    xl: true;
  }

  /** Override for palette base type */
  type BGPalette =
    | 'BGPopup'
    | 'BGTile'
    | 'BGTableDefault'
    | 'BGMainMenu'
    | 'BGHint'
    | 'BGTableDefaultHover'
    | 'BGTableDefaultFocus'
    | 'BGTableAccent'
    | 'BGTableAccentHover'
    | 'BGTableAccentFocus'
    | 'BGPageLinearStart'
    | 'BGPageLinearEnd'
    | 'BGSecondaryLight';
  type BorderPalette = 'BorderPrimary' | 'BorderLight' | 'BorderDark';
  type TextPalette = 'TextPrimary' | 'TextSecondary' | 'TextInactive' | 'TextBlack' | 'TextOnTertiary' | 'TextOnDark';
  type PrimaryPalette =
    | 'Primary'
    | 'PrimaryDark'
    | 'PrimaryLight'
    | 'PrimaryBG'
    | 'PrimaryBGLight'
    | 'PrimaryBGSemiTransparent';
  type SecondaryPalette = 'Secondary' | 'SecondaryDark' | 'SecondaryLight' | 'SecondaryBG' | 'SecondaryBGDark';
  type TertiaryPalette = 'Tertiary' | 'TertiaryDark' | 'TertiaryLight';
  type ErrorPalette = 'Error' | 'ErrorDark' | 'ErrorLight' | 'ErrorBGLight' | 'ErrorBG' | 'ErrorBGDark';
  type WarningPalette = 'Warning' | 'WarningBG' | 'WarningDark' | 'WarningLight';
  type SuccessPalette = 'Success' | 'SuccessBG' | 'SuccessDark' | 'SuccessLight';
  type InfoPalette = 'Info' | 'InfoBG' | 'InfoDark' | 'InfoLight' | 'InfoBlue';
  type LinkPalette = 'Link' | 'LinkDark' | 'LinkLight';
  type DisabledPalette = 'Disabled' | 'DisabledBG' | 'DisabledBorder' | 'DisabledBGSemiTransparent';
  type StatusPalette =
    | 'StGreen'
    | 'StGreenLight'
    | 'StGreenDark'
    | 'StGreenMid'
    | 'StGreenMidLight'
    | 'StOrange'
    | 'StOrangeLight'
    | 'StOrangeDark'
    | 'StOrangeMid'
    | 'StOrangeMidLight'
    | 'StRed'
    | 'StRedMid'
    | 'StRedMidLight'
    | 'StRedLight'
    | 'StRedDark'
    | 'StGrey'
    | 'StGreyLight'
    | 'StGreyMid'
    | 'StGreyMidLight'
    | 'StGreyDark'
    | 'SGrey'
    | 'SGreyLight'
    | 'SRed'
    | 'SRedLight'
    | 'SEmeraldLight'
    | 'SEmerald'
    | 'StLBlueDark'
    | 'StLBlue'
    | 'StLBlueMid'
    | 'StLBlueMidLight'
    | 'StLBlueLight'
    | 'StDPurpleDark'
    | 'StDPurple'
    | 'StDPurpleLight'
    | 'StDPurpleMid'
    | 'StDPurpleMidLight'
    | 'StSystemDark'
    | 'StSystem'
    | 'StSystemMid'
    | 'StSystemMidLight'
    | 'StSystemLight'
    | 'StDisabledDark'
    | 'StDisabled'
    | 'StDisabledMid'
    | 'StDisabledMidLight'
    | 'StDisabledLight';
  type ProductPalette = 'PGreen' | 'PBlue' | 'PViolet' | 'PKhaki' | 'POrange' | 'PGrey' | 'PGreyLight';
  type RatePalette =
    | 'RGreen'
    | 'RBlue'
    | 'RPurple'
    | 'ROrange'
    | 'RLightGreen'
    | 'RLightBlue'
    | 'RLightPurple'
    | 'RLightOrange';
  type ChartPalette =
    | 'CGreen'
    | 'CGreenDark'
    | 'CRed'
    | 'CRedDark'
    | 'COrange'
    | 'COrangeDark'
    | 'CPurple'
    | 'CPurpleDark'
    | 'CBlue';

  interface Palette {
    BG: Record<BGPalette, string>;
    Border: Record<BorderPalette, string>;
    Text: Record<TextPalette, string>;
    Primary: Record<PrimaryPalette, string>;
    Secondary: Record<SecondaryPalette, string>;
    Tertiary: Record<TertiaryPalette, string>;
    Error: Record<ErrorPalette, string>;
    Warning: Record<WarningPalette, string>;
    Success: Record<SuccessPalette, string>;
    Info: Record<InfoPalette, string>;
    Link: Record<LinkPalette, string>;
    Disabled: Record<DisabledPalette, string>;
    Status: Record<StatusPalette, string>;
    Product: Record<ProductPalette, string>;
    Rate: Record<RatePalette, string>;
    Chart: Record<ChartPalette, string>;
  }

  interface PaletteOptions {
    BG: Record<BGPalette, string>;
    Border: Record<BorderPalette, string>;
    Text: Record<TextPalette, string>;
    Primary: Record<PrimaryPalette, string>;
    Secondary: Record<SecondaryPalette, string>;
    Tertiary: Record<TertiaryPalette, string>;
    Error: Record<ErrorPalette, string>;
    Warning: Record<WarningPalette, string>;
    Success: Record<SuccessPalette, string>;
    Info: Record<InfoPalette, string>;
    Link: Record<LinkPalette, string>;
    Disabled: Record<DisabledPalette, string>;
    Status: Record<StatusPalette, string>;
    Product: Record<ProductPalette, string>;
    Rate: Record<RatePalette, string>;
    Chart: Record<ChartPalette, string>;
  }

  /** Override for typography base type */
  export interface TypographyVariants {
    lineHeight: string;
    fontWeight: number;
    H1Light: CSSProperties;
    H2Light: CSSProperties;
    H3StrongSmb: CSSProperties;
    H3Reg: CSSProperties;
    H4StrongExtensiveSmb: CSSProperties;
    H4StrongSmb: CSSProperties;
    H4Reg: CSSProperties;
    H5StrongSmb: CSSProperties;
    H5Reg: CSSProperties;
    H6StrongSmb: CSSProperties;
    H6Reg: CSSProperties;
    BodyXLReg: CSSProperties;
    BodyXLStrongSmb: CSSProperties;
    BodyLReg: CSSProperties;
    BodyLStrongSmb: CSSProperties;
    BodyMExtensive: CSSProperties;
    BodyMReg: CSSProperties;
    BodyMStrongSmb: CSSProperties;
    BodySReg: CSSProperties;
    BodySStrongSmb: CSSProperties;
    BodyXSExtensive: CSSProperties;
    BodyXSReg: CSSProperties;
    DisplayL: CSSProperties;
    DisplayM: CSSProperties;
    DisplayS: CSSProperties;
    ButtonL: CSSProperties;
    ButtonM: CSSProperties;
    ButtonS: CSSProperties;
    ButtonXS: CSSProperties;
  }

  interface TypographyVariantsOptions {
    lineHeight: string;
    fontWeight: number;
    H1Light: CSSProperties;
    H2Light: CSSProperties;
    H3StrongSmb: CSSProperties;
    H3Reg: CSSProperties;
    H4StrongExtensiveSmb: CSSProperties;
    H4StrongSmb: CSSProperties;
    H4Reg: CSSProperties;
    H5StrongSmb: CSSProperties;
    H5Reg: CSSProperties;
    H6StrongSmb: CSSProperties;
    H6Reg: CSSProperties;
    BodyXLReg: CSSProperties;
    BodyXLStrongSmb: CSSProperties;
    BodyLReg: CSSProperties;
    BodyLStrongSmb: CSSProperties;
    BodyMExtensive: CSSProperties;
    BodyMReg: CSSProperties;
    BodyMStrongSmb: CSSProperties;
    BodySReg: CSSProperties;
    BodySStrongSmb: CSSProperties;
    BodyXSExtensive: CSSProperties;
    BodyXSReg: CSSProperties;
    DisplayL: CSSProperties;
    DisplayM: CSSProperties;
    DisplayS: CSSProperties;
    ButtonL: CSSProperties;
    ButtonM: CSSProperties;
    ButtonS: CSSProperties;
    ButtonXS: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  /** Override for breakpoints base type */
  interface TypographyPropsVariantOverrides {
    lineHeight: true;
    fontWeight: true;
    H1Light: true;
    H2Light: true;
    H3StrongSmb: true;
    H3Reg: true;
    H4StrongExtensiveSmb: true;
    H4StrongSmb: true;
    H4Reg: true;
    H5StrongSmb: true;
    H5Reg: true;
    H6StrongSmb: true;
    H6Reg: true;
    BodyXLReg: true;
    BodyXLStrongSmb: true;
    BodyLReg: true;
    BodyLStrongSmb: true;
    BodyMExtensive: true;
    BodyMReg: true;
    BodyMStrongSmb: true;
    BodySReg: true;
    BodySStrongSmb: true;
    BodyXSExtensive: true;
    BodyXSReg: true;
    DisplayL: true;
    DisplayM: true;
    DisplayS: true;
    ButtonL: true;
    ButtonM: true;
    ButtonS: true;
    ButtonXS: true;
  }
}
