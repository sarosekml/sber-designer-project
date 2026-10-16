#!/usr/bin/env node
/**
 * Generate Tokens Studio JSON from code.
 * Outputs:
 *   tokens/primitive/color.json
 *   tokens/semantic/palette.json
 *   tokens/semantic/typography.json
 *
 * Source of truth: src/styles/colors/*.ts, src/styles/theme/palette.ts, src/styles/theme/typography.ts.
 *
 * Run: node scripts/build-tokens.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ---------- helpers ----------
function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

function alphaToHex2(a) {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255);
  return v.toString(16).padStart(2, '0').toUpperCase();
}

function applyAlphaToHex(hex, alpha) {
  // hex like #RRGGBB → return #RRGGBBAA
  const clean = hex.replace('#', '').toUpperCase();
  if (clean.length !== 6) throw new Error(`bad hex ${hex}`);
  return `#${clean}${alphaToHex2(alpha)}`;
}

// ---------- 1) primitive/color.json — parse src/styles/colors/*.ts ----------
function parsePaletteFile(name) {
  const txt = read(`src/styles/colors/${name}.ts`);
  // Match lines like:   50: '#EEF2F1',  or  A100: '#F5F7F7',
  const re = /^\s*([A-Za-z0-9]+):\s*'(#[0-9A-Fa-f]{6,8})'/gm;
  const shades = {};
  let m;
  while ((m = re.exec(txt)) !== null) {
    shades[m[1]] = m[2].toUpperCase();
  }
  return shades;
}

const paletteNames = [
  'amber', 'blue', 'brown', 'cGrey', 'cyan', 'deepOrange', 'deepPurple', 'emerald',
  'green', 'indigo', 'lightBlue', 'lightGreen', 'lime', 'mGrey', 'orange',
  'pink', 'purple', 'red', 'swamp', 'yellow',
];

const colorPrimitives = { color: {} };
const palettesData = {};
for (const name of paletteNames) {
  const shades = parsePaletteFile(name);
  palettesData[name] = shades;
  colorPrimitives.color[name] = {};
  for (const [shade, hex] of Object.entries(shades)) {
    colorPrimitives.color[name][shade] = { value: hex, type: 'color' };
  }
}

// ---------- 2) semantic/palette.json — parse src/styles/theme/palette.ts ----------
// Strategy: regex-extract the palette object literal, then evaluate each leaf
// to either {color.<palette>.<shade>} reference or alpha-applied hex.

const paletteTxt = read('src/styles/theme/palette.ts');

/**
 * Build a token leaf for a code expression like:
 *   emerald[500]            → { value: "{color.emerald.500}", type: "color" }
 *   alpha(emerald[500], .06) → { value: "#00AA9B0F", type: "color" }
 *   swamp['A700']           → { value: "{color.swamp.A700}", type: "color" }
 *   '#1234'                 → { value: "#1234", type: "color" }
 */
function leafFromExpr(expr) {
  const e = expr.trim().replace(/,$/, '').trim();

  // Direct hex
  const hexMatch = e.match(/^['"](#[0-9A-Fa-f]+)['"]$/);
  if (hexMatch) return { value: hexMatch[1].toUpperCase(), type: 'color' };

  // alpha(palette[shade], num)
  const alphaMatch = e.match(/^alpha\(\s*([A-Za-z]+)\s*\[\s*['"]?([A-Za-z0-9]+)['"]?\s*\]\s*,\s*([0-9.]+)\s*\)$/);
  if (alphaMatch) {
    const [, pal, shade, a] = alphaMatch;
    const hex = palettesData[pal]?.[shade];
    if (!hex) throw new Error(`alpha(): unknown ${pal}[${shade}]`);
    return { value: applyAlphaToHex(hex, parseFloat(a)), type: 'color' };
  }

  // palette[shade]
  const refMatch = e.match(/^([A-Za-z]+)\s*\[\s*['"]?([A-Za-z0-9]+)['"]?\s*\]$/);
  if (refMatch) {
    const [, pal, shade] = refMatch;
    if (!palettesData[pal]) throw new Error(`unknown palette ${pal}`);
    if (palettesData[pal][shade] === undefined) throw new Error(`palette ${pal} has no shade ${shade}`);
    return { value: `{color.${pal}.${shade}}`, type: 'color' };
  }

  throw new Error(`Cannot parse expr: ${expr}`);
}

/**
 * Tokenise the palette.ts contents into {GroupName: {Key: leaf}}.
 * We detect each top-level group block in the export.
 * The parser is line-based (works because palette.ts is well-formatted).
 */
function parsePaletteSource(src) {
  // Strip comments to make regex-line easier
  const cleaned = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  // Find the export block
  const exportStart = cleaned.indexOf('export const palette');
  if (exportStart < 0) throw new Error('export not found');
  const body = cleaned.slice(exportStart);

  // Walk top-level keys: "GroupName: { ... }," — supports nested braces.
  // We do a small bracket-match.
  const result = {};
  let i = body.indexOf('{') + 1;
  while (i < body.length) {
    // skip whitespace/commas
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (body[i] === '}') break; // end of palette

    // read key
    const keyMatch = body.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (!keyMatch) break;
    const key = keyMatch[1];
    i += keyMatch[0].length;

    // read value (object) — track braces
    while (i < body.length && body[i] !== '{') i++;
    if (body[i] !== '{') break;
    let depth = 1;
    const start = i + 1;
    i++;
    while (i < body.length && depth > 0) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') depth--;
      if (depth > 0) i++;
    }
    const objBody = body.slice(start, i);
    i++; // past closing }

    // parse inner key: expr,
    const obj = {};
    const lines = objBody.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?),?\s*$/);
      if (!m) continue;
      const innerKey = m[1];
      let expr = m[2].replace(/,\s*$/, '');
      try {
        obj[innerKey] = leafFromExpr(expr);
      } catch (e) {
        // skip non-color computed expressions silently? actually fail loud
        throw new Error(`In ${key}.${innerKey}: ${e.message}\nLine: ${line}`);
      }
    }
    if (Object.keys(obj).length) {
      result[key] = obj;
    }
  }

  return result;
}

const paletteParsed = parsePaletteSource(paletteTxt);

const semanticPalette = { palette: {} };
for (const [group, leaves] of Object.entries(paletteParsed)) {
  // skip MUI-default lowercase primary/secondary — keep PascalCase ones; drop deprecated S* in Status
  semanticPalette.palette[group] = {};
  for (const [k, leaf] of Object.entries(leaves)) {
    // Drop deprecated SGrey / SRed / SEmerald keys per discussion
    if (group === 'Status' && /^S[A-Z]/.test(k) && !/^St/.test(k)) continue;
    semanticPalette.palette[group][k] = leaf;
  }
}

// ---------- 3) semantic/typography.json — parse src/styles/theme/typography.ts ----------
const typographyTxt = read('src/styles/theme/typography.ts');

// fontFamilies object
function parseFontFamilies(src) {
  const m = src.match(/export const fontFamilies\s*=\s*\{([\s\S]*?)\};/);
  if (!m) throw new Error('fontFamilies not found');
  const out = {};
  const re = /([A-Za-z]+)\s*:\s*['"]([^'"]+)['"]/g;
  let mm;
  while ((mm = re.exec(m[1])) !== null) out[mm[1]] = mm[2];
  return out;
}

const fontFamiliesData = parseFontFamilies(typographyTxt);

// Each variant: name → { fontSize, fontWeight, lineHeight, fontFamily }
function parseTypographyVariants(src) {
  const start = src.indexOf('export const typography');
  if (start < 0) throw new Error('typography not found');
  const body = src.slice(start);
  const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  // Find each VariantName: { ... } block
  const variants = {};
  // We skip top-level fontFamily/fontSize/lineHeight/fontWeight on root level (those are MUI defaults)
  const re = /([A-Z][A-Za-z0-9]+)\s*:\s*\{([\s\S]*?)\}\s*,/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const name = m[1];
    const body = m[2];
    const obj = {};
    // fontSize: '52px',
    const fsM = body.match(/fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/);
    if (fsM) obj.fontSize = parseFloat(fsM[1]);
    // fontWeight: 400,
    const fwM = body.match(/fontWeight\s*:\s*(\d+)/);
    if (fwM) obj.fontWeight = parseInt(fwM[1], 10);
    // lineHeight: '68px',
    const lhM = body.match(/lineHeight\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/);
    if (lhM) obj.lineHeight = parseFloat(lhM[1]);
    // fontFamily: fontFamilies.SBDisplay,
    const ffM = body.match(/fontFamily\s*:\s*fontFamilies\.([A-Za-z]+)/);
    if (ffM) obj.fontFamily = ffM[1];
    if (obj.fontSize !== undefined && obj.fontFamily !== undefined) {
      variants[name] = obj;
    }
  }
  return variants;
}

const typographyVariants = parseTypographyVariants(typographyTxt);

// Build typography tokens
// Primitives:
//   font/family/<name>: { value, type: fontFamilies }
//   font/weight/<n>: { value: 400|600, type: fontWeights }
//   font/size/<n>: { value: 16, type: fontSizes }
//   font/lineHeight/<n>: { value: 24, type: lineHeights }
// Composite:
//   typography/<Variant>: { value: { fontFamily: {...ref}, fontWeight: {...ref}, fontSize: {...ref}, lineHeight: {...ref} }, type: typography }

const fontWeights = new Set();
const fontSizes = new Set();
const lineHeights = new Set();
for (const v of Object.values(typographyVariants)) {
  fontWeights.add(v.fontWeight);
  fontSizes.add(v.fontSize);
  lineHeights.add(v.lineHeight);
}

const semanticTypography = { font: { family: {}, weight: {}, size: {}, lineHeight: {} }, typography: {} };

// Font families
for (const [k, v] of Object.entries(fontFamiliesData)) {
  semanticTypography.font.family[k] = { value: v, type: 'fontFamilies' };
}

// Weights / sizes / line-heights with numeric keys
for (const w of [...fontWeights].sort((a, b) => a - b)) {
  semanticTypography.font.weight[String(w)] = { value: String(w), type: 'fontWeights' };
}
for (const s of [...fontSizes].sort((a, b) => a - b)) {
  semanticTypography.font.size[String(s)] = { value: String(s), type: 'fontSizes' };
}
for (const lh of [...lineHeights].sort((a, b) => a - b)) {
  semanticTypography.font.lineHeight[String(lh)] = { value: String(lh), type: 'lineHeights' };
}

// Composite typography variants
for (const [name, v] of Object.entries(typographyVariants)) {
  semanticTypography.typography[name] = {
    value: {
      fontFamily: `{font.family.${v.fontFamily}}`,
      fontWeight: `{font.weight.${v.fontWeight}}`,
      lineHeight: `{font.lineHeight.${v.lineHeight}}`,
      fontSize: `{font.size.${v.fontSize}}`,
      letterSpacing: '0',
      paragraphSpacing: '0',
      textCase: 'none',
      textDecoration: 'none',
    },
    type: 'typography',
  };
}

// ---------- 4) component/button.json — derive from Button.const.ts + Button.utils.ts ----------
// We don't re-parse the TS heavily; the values are stable and small enough to encode
// directly here. If they ever drift, the spot-checks against Pixso (4 sizes verified)
// will catch it.

const SPACING_UNIT = 4; // theme/theme.ts: spacing: 4
const sp = (n) => `${n * SPACING_UNIT}`;
const spStr = (...vals) => vals.map((n) => sp(n)).join(' ');

// Button.const.ts
const buttonHeights = { lg: 12, md: 10, sm: 8, xs: 6 };
const buttonRadius = { lg: 2, md: 2, sm: 1.5, xs: 1 };
const buttonIconSizes = { lg: 6, md: 5, sm: 4, xs: 4 };
const buttonIconSpacings = { lg: 2, md: 1.5, sm: 1, xs: 1 };
const buttonFontVariants = { lg: 'ButtonL', md: 'ButtonM', sm: 'ButtonS', xs: 'ButtonS' };

// Button.utils.ts → getPaddingByContent table
const buttonPadding = {
  lg: {
    onlyText: [2, 5],
    textAndStartIcon: [2, 5, 2, 4],
    textAndLoader: [2, 5, 2, 4],
    textAndEndIcon: [2, 4, 2, 5],
    textAndBothIcons: [2, 4],
    onlyIcon: [3],
  },
  md: {
    onlyText: [2, 4],
    textAndStartIcon: [2, 4, 2, 3],
    textAndLoader: [2, 4, 2, 3],
    textAndEndIcon: [2, 3, 2, 4],
    textAndBothIcons: [2, 3],
    onlyIcon: [2.5],
  },
  sm: {
    onlyText: [1.5, 3],
    textAndStartIcon: [1.5, 3, 1.5, 2.5],
    textAndLoader: [1.5, 3, 1.5, 2.5],
    textAndEndIcon: [1.5, 2.5, 1.5, 3],
    textAndBothIcons: [1.5, 2.5],
    onlyIcon: [2],
  },
  xs: {
    onlyText: [0.5, 2],
    textAndStartIcon: [1, 2, 1, 1.5],
    textAndLoader: [1, 2, 1, 1.5],
    textAndEndIcon: [1, 1.5, 1, 2],
    textAndBothIcons: [1, 1.5],
    onlyIcon: [1],
  },
};

function buildButtonSize(sz) {
  return {
    height: { value: sp(buttonHeights[sz]), type: 'sizing' },
    borderRadius: { value: sp(buttonRadius[sz]), type: 'borderRadius' },
    icon: {
      size: { value: sp(buttonIconSizes[sz]), type: 'sizing' },
      spacing: { value: sp(buttonIconSpacings[sz]), type: 'spacing' },
    },
    padding: Object.fromEntries(
      Object.entries(buttonPadding[sz]).map(([k, units]) => [
        k,
        { value: spStr(...units), type: 'spacing' },
      ]),
    ),
    typography: { value: `{typography.${buttonFontVariants[sz]}}`, type: 'typography' },
  };
}

// Color refs to palette tokens
const cref = (path) => ({ value: `{palette.${path}}`, type: 'color' });
const transparentColor = { value: '#00000000', type: 'color' };

// Accent (Button.styles.ts → getButtonAccentStyles)
const accent = {
  default: {
    bg: cref('Primary.Primary'),
    text: cref('Text.TextOnDark'),
    icon: cref('Text.TextOnDark'),
    border: transparentColor,
  },
  hover: {
    bg: cref('Primary.PrimaryDark'),
    text: cref('Text.TextOnDark'),
    icon: cref('Text.TextOnDark'),
    border: transparentColor,
  },
  active: {
    bg: cref('Primary.PrimaryLight'),
    text: cref('Text.TextOnDark'),
    icon: cref('Text.TextOnDark'),
    border: cref('Primary.PrimaryLight'),
  },
  disabled: {
    bg: cref('Disabled.Disabled'),
    text: cref('Text.TextOnDark'),
    icon: cref('Text.TextOnDark'),
    border: transparentColor,
  },
};

// Outlined color schemes (Button.utils.ts → getOutlinedButtonColorScheme)
const outlined = {
  default: {
    default: { border: cref('Secondary.Secondary'),       text: cref('Primary.Primary'),       bg: transparentColor },
    hover:   { border: cref('Secondary.SecondaryDark'),   text: cref('Primary.PrimaryDark'),   bg: cref('Primary.PrimaryBG') },
    active:  { border: cref('Secondary.SecondaryLight'),  text: cref('Primary.PrimaryLight'),  bg: transparentColor },
  },
  primary: {
    default: { border: cref('Primary.Primary'),       text: cref('Primary.Primary'),       bg: transparentColor },
    hover:   { border: cref('Primary.PrimaryDark'),   text: cref('Primary.PrimaryDark'),   bg: cref('Secondary.SecondaryBG') },
    active:  { border: cref('Primary.PrimaryLight'),  text: cref('Primary.PrimaryLight'),  bg: transparentColor },
  },
  secondary: {
    default: { border: cref('Secondary.Secondary'),       text: cref('Secondary.Secondary'),       bg: transparentColor },
    hover:   { border: cref('Secondary.SecondaryDark'),   text: cref('Secondary.SecondaryDark'),   bg: cref('Secondary.SecondaryBG') },
    active:  { border: cref('Secondary.SecondaryLight'),  text: cref('Secondary.SecondaryLight'),  bg: transparentColor },
  },
  info: {
    default: { border: cref('Info.Info'), text: cref('Info.Info'), bg: transparentColor },
    hover:   { border: cref('Info.Info'), text: cref('Info.Info'), bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { border: cref('Info.Info'), text: cref('Text.TextOnDark'), bg: cref('Info.Info') },
  },
  success: {
    default: { border: cref('Success.Success'), text: cref('Success.Success'), bg: transparentColor },
    hover:   { border: cref('Success.Success'), text: cref('Success.Success'), bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { border: cref('Success.Success'), text: cref('Text.TextOnDark'), bg: cref('Success.Success') },
  },
  warning: {
    default: { border: cref('Warning.Warning'), text: cref('Warning.Warning'), bg: transparentColor },
    hover:   { border: cref('Warning.Warning'), text: cref('Warning.Warning'), bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { border: cref('Warning.Warning'), text: cref('Text.TextOnDark'), bg: cref('Warning.Warning') },
  },
  error: {
    default: { border: cref('Error.Error'), text: cref('Error.Error'), bg: transparentColor },
    hover:   { border: cref('Error.Error'), text: cref('Error.Error'), bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { border: cref('Error.Error'), text: cref('Text.TextOnDark'), bg: cref('Error.Error') },
  },
  disabled: {
    border: cref('Disabled.Disabled'),
    text:   cref('Disabled.Disabled'),
    icon:   cref('Disabled.Disabled'),
    bg:     transparentColor,
  },
};

// Transparent (Button.styles.ts → getButtonTransparentStyles): copies outlined color logic
// minus the border. We build it by referencing the same color sources.
const transparent = {
  default: {
    default: { text: cref('Primary.Primary'),       bg: transparentColor },
    hover:   { text: cref('Primary.PrimaryDark'),   bg: cref('Primary.PrimaryBG') },
    active:  { text: cref('Primary.PrimaryLight'),  bg: transparentColor },
  },
  primary: {
    default: { text: cref('Primary.Primary'),       bg: transparentColor },
    hover:   { text: cref('Primary.PrimaryDark'),   bg: cref('Secondary.SecondaryBG') },
    active:  { text: cref('Primary.PrimaryLight'),  bg: transparentColor },
  },
  secondary: {
    default: { text: cref('Secondary.Secondary'),       bg: transparentColor },
    hover:   { text: cref('Secondary.SecondaryDark'),   bg: cref('Secondary.SecondaryBG') },
    active:  { text: cref('Secondary.SecondaryLight'),  bg: transparentColor },
  },
  info: {
    default: { text: cref('Info.Info'),  bg: transparentColor },
    hover:   { text: cref('Info.Info'),  bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { text: cref('Text.TextOnDark'), bg: cref('Info.Info') },
  },
  success: {
    default: { text: cref('Success.Success'), bg: transparentColor },
    hover:   { text: cref('Success.Success'), bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { text: cref('Text.TextOnDark'), bg: cref('Success.Success') },
  },
  warning: {
    default: { text: cref('Warning.Warning'), bg: transparentColor },
    hover:   { text: cref('Warning.Warning'), bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { text: cref('Text.TextOnDark'), bg: cref('Warning.Warning') },
  },
  error: {
    default: { text: cref('Error.Error'), bg: transparentColor },
    hover:   { text: cref('Error.Error'), bg: cref('Primary.PrimaryBGSemiTransparent') },
    active:  { text: cref('Text.TextOnDark'), bg: cref('Error.Error') },
  },
  disabled: {
    text: cref('Disabled.Disabled'),
    bg:   transparentColor,
  },
};

const componentButton = {
  button: {
    size: {
      lg: buildButtonSize('lg'),
      md: buildButtonSize('md'),
      sm: buildButtonSize('sm'),
      xs: buildButtonSize('xs'),
    },
    border: {
      width: { value: '1', type: 'borderWidth' },
      style: { value: 'solid', type: 'other' },
    },
    accent,
    outlined,
    transparent,
  },
};

// ---------- 5) component/inputtext.json — derive from BaseInput.styles.ts + InputText ----------
// BaseInput.styles.ts → getPaddingBySize, getHeightBySize, getFontBySize per size.
// State styling: default/hover/focus/error/error.focus/disabled/disabled.coloredBg.

const inputPad = { lg: 3, md: 2.5, sm: 2 };          // theme.spacing units → 12/10/8
const inputContentH = { lg: 6, md: 5, sm: 4 };       // theme.spacing units → 24/20/16
const inputFontSize = { lg: 18, md: 16, sm: 14 };    // BodyLReg/BodyMReg/BodySReg fontSize
const inputLineHeight = { lg: 24, md: 20, sm: 16 };  // overrides! md/sm tighter than typography

function buildInputSize(sz) {
  const padding = inputPad[sz] * SPACING_UNIT;
  const contentH = inputContentH[sz] * SPACING_UNIT;
  const inputBoxH = padding * 2 + contentH;
  const labelH = 16;          // theme.spacing(4)
  const labelGap = 4;          // theme.spacing(1)
  const helperH = 16;
  const helperGap = 4;
  return {
    input: {
      height:  { value: String(inputBoxH), type: 'sizing' },
      padding: { value: String(padding),   type: 'spacing' },
    },
    content: {
      height:     { value: String(contentH), type: 'sizing' },
      // References into semantic/typography primitives — not literal numbers.
      // BodyMReg/BodySReg lineHeight differs from input lineHeight, so we
      // reference font.lineHeight.<n> directly instead of a typography composite.
      fontSize:   { value: `{font.size.${inputFontSize[sz]}}`,         type: 'fontSizes' },
      lineHeight: { value: `{font.lineHeight.${inputLineHeight[sz]}}`, type: 'lineHeights' },
    },
    total: {
      noHelper:   { value: String(labelH + labelGap + inputBoxH),                      type: 'sizing' },
      withHelper: { value: String(labelH + labelGap + inputBoxH + helperGap + helperH), type: 'sizing' },
    },
  };
}

const componentInputText = {
  inputtext: {
    borderRadius: { value: '4', type: 'borderRadius' },  // MUI default theme.shape.borderRadius
    border: {
      width: { value: '1',     type: 'borderWidth' },
      style: { value: 'solid', type: 'other' },
    },
    size: {
      lg: buildInputSize('lg'),
      md: buildInputSize('md'),
      sm: buildInputSize('sm'),
    },
    label: {
      height: { value: '16', type: 'sizing' },
      gap:    { value: '4',  type: 'spacing' },
    },
    helper: {
      height:     { value: '16', type: 'sizing' },
      gap:        { value: '4',  type: 'spacing' },
      typography: { value: '{typography.BodyXSReg}', type: 'typography' },
    },
    state: {
      default: {
        bg:     cref('BG.BGPopup'),
        border: cref('Border.BorderPrimary'),
        text:   cref('Text.TextPrimary'),
        label:  cref('Text.TextSecondary'),
      },
      hover: {
        bg:     cref('BG.BGPopup'),
        border: cref('Primary.Primary'),
        text:   cref('Text.TextPrimary'),
      },
      focus: {
        bg:      cref('BG.BGPopup'),
        border:  cref('Primary.Primary'),
        outline: cref('Primary.Primary'),
        text:    cref('Text.TextPrimary'),
      },
      error: {
        bg:     cref('BG.BGPopup'),
        border: cref('Error.Error'),
        text:   cref('Text.TextPrimary'),
      },
      'error.focus': {
        bg:      cref('BG.BGPopup'),
        border:  cref('Error.Error'),
        outline: cref('Error.Error'),
        text:    cref('Text.TextPrimary'),
      },
      warning: {
        bg:     cref('BG.BGPopup'),
        border: cref('Warning.Warning'),
        text:   cref('Text.TextPrimary'),
      },
      disabled: {
        bg:     cref('BG.BGPopup'),
        border: cref('Disabled.DisabledBorder'),
        text:   cref('Text.TextInactive'),
        label:  cref('Text.TextInactive'),
      },
      'disabled.coloredBg': {
        bg:     cref('Disabled.DisabledBGSemiTransparent'),
        border: transparentColor,
        text:   cref('Text.TextInactive'),
        label:  cref('Text.TextInactive'),
      },
    },
    icon: {
      color:          cref('Secondary.Secondary'),
      'color.disabled': cref('Disabled.Disabled'),
    },
    readMode: {
      borderRadius: { value: '4', type: 'borderRadius' },
      'bg.error':       cref('Error.ErrorBG'),
      'bg.error.hover': cref('Error.ErrorBGDark'),
      present: {
        'border.dashed.color.default': cref('Border.BorderPrimary'),
        'border.dashed.color.error':   cref('Error.Error'),
        'border.dashed.style':         { value: 'dashed', type: 'other' },
        'border.dashed.width':         { value: '1', type: 'borderWidth' },
      },
    },
  },
};

// ---------- write outputs ----------
function writeJson(rel, data) {
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
  console.log(`✓ ${rel}`);
}

// ---------- 6) component/modal.json — derive from EmptyModal + Dialog* styles ----------
// Sources:
//   EmptyModal.style.ts           → surface.borderRadius
//   DialogTitle.styles.ts         → header padding, borderBottom
//   DialogContent.styles.ts       → body paddings
//   DialogActions.styles.ts       → footer padding, borderTop
// Pixso column-grid widths verified via Modal_Top variants (151:125129).

// Width presets from Pixso (Modal_Top / Columns=N)
const modalColumnWidths = {
  '2': 289,  '3': 442,  '4': 595,  '5': 747,  '6': 900,
  '7': 1053, '8': 1205, '9': 1358, '10': 1511, '11': 1663, '12': 1816,
};

const componentModal = {
  modal: {
    surface: {
      bg:            cref('BG.BGPopup'),
      // EmptyModal.style.ts: borderRadius: 2 → MUI scales by theme.shape.borderRadius=4 → 8 px
      borderRadius:  { value: '8', type: 'borderRadius' },
    },
    header: {
      height:  { value: '64', type: 'sizing' },
      padding: { value: '20 24', type: 'spacing' },  // theme.spacing(5, 6)
      borderBottom: {
        width: { value: '1', type: 'borderWidth' },
        color: cref('Border.BorderPrimary'),
      },
      text: {
        color: cref('Text.TextPrimary'),
      },
    },
    body: {
      paddingX:      { value: '24', type: 'spacing' }, // theme.spacing(6)
      paddingBottom: { value: '16', type: 'spacing' }, // theme.spacing(4)
      paddingTop:    { value: '0',  type: 'spacing' }, // default, no useTopPadding
      'paddingTop.useTopPadding': { value: '16', type: 'spacing' }, // when prop true
    },
    footer: {
      height:  { value: '72', type: 'sizing' },        // verified via Pixso Modal_Bottom
      padding: { value: '16', type: 'spacing' },       // p: 4 = theme.spacing(4)
      borderTop: {
        width: { value: '1', type: 'borderWidth' },
        color: cref('Border.BorderPrimary'),
      },
      // Pixso `Mode` axis describes which button groups are present in the
      // footer: `RightOnly` = single group on the right; `Both` = a group on
      // each side (space-between). In code this maps to DialogActions.justify
      // for RightOnly; the Both case is split layout that the consumer renders
      // by placing two children inside DialogActions.
      layout: {
        rightOnly: {
          value: 'flex-end',
          type: 'other',
          description: 'Only right-side buttons present (Pixso Mode=RightOnly).',
        },
        both: {
          value: 'space-between',
          type: 'other',
          description: 'Both left- and right-side button groups present (Pixso Mode=Both).',
        },
      },
    },
    width: {
      columns: Object.fromEntries(
        Object.entries(modalColumnWidths).map(([col, px]) => [
          col,
          { value: String(px), type: 'sizing' },
        ]),
      ),
    },
  },
};

// ---------- registry: atomic level per component (path in src/components/) ----------
// atoms/<name>      | molecules/<name>      | organisms/<name>
const componentRegistry = {
  atoms:     { button: componentButton.button },
  molecules: {
    inputtext: componentInputText.inputtext,
    modal:     componentModal.modal,
  },
  organisms: {},
};

// ---------- write outputs ----------
writeJson('tokens/primitive/color.json', colorPrimitives);
writeJson('tokens/semantic/palette.json', semanticPalette);
writeJson('tokens/semantic/typography.json', semanticTypography);

// Per-component files (one per component) — kept for granular import.
writeJson('tokens/component/button.json', { atoms: { button: componentRegistry.atoms.button } });
writeJson('tokens/component/inputtext.json', { molecules: { inputtext: componentRegistry.molecules.inputtext } });
writeJson('tokens/component/modal.json', { molecules: { modal: componentRegistry.molecules.modal } });

// Tokens Studio $metadata + $themes
const metadata = {
  tokenSetOrder: [
    'primitive/color',
    'semantic/palette',
    'semantic/typography',
    'component/button',
    'component/inputtext',
    'component/modal',
  ],
};
const themes = [];
writeJson('tokens/$metadata.json', metadata);
writeJson('tokens/$themes.json', themes);

// Components bundle: all atoms/molecules/organisms in one file (per user request).
// Base layer (primitive + semantic) stays as individual files — easier to load and reason about.
const componentsBundle = {
  atoms:     componentRegistry.atoms,
  molecules: componentRegistry.molecules,
  organisms: componentRegistry.organisms,
};
writeJson('tokens/components.bundle.json', componentsBundle);

// Clean up legacy bundles if they linger from earlier runs.
for (const legacy of ['tokens/tokens.bundle.json', 'tokens/base.bundle.json']) {
  const p = path.join(root, legacy);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log(`✗ ${legacy} (removed — base layer now stays as individual files)`);
  }
}

console.log('\nDone.');
console.log(`palettes: ${paletteNames.length}`);
console.log(`semantic palette groups: ${Object.keys(semanticPalette.palette).length}`);
console.log(`typography variants: ${Object.keys(semanticTypography.typography).length}`);
console.log(`atoms: ${Object.keys(componentRegistry.atoms).join(', ') || '(none)'}`);
console.log(`molecules: ${Object.keys(componentRegistry.molecules).join(', ') || '(none)'}`);
console.log(`organisms: ${Object.keys(componentRegistry.organisms).join(', ') || '(none)'}`);
