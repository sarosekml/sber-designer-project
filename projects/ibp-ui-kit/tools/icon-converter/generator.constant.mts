import path from 'path';

export const REPO_NAME = 'design-frontend';
export const PROJECT_NAME = 'IBPAUTO';

export const SVG_FOLDER_PATTERN = `./${REPO_NAME}/icons/*.svg`;
export const PATH_TO_ICONS_DIR = path.resolve('.', 'src', 'components', 'atoms', 'Icon', 'icons');
export const PATH_TO_ICONS_MOCK = path.resolve('.', 'src', 'components', 'atoms', 'Icon', 'Icon.mock.ts');

export const PATH_ICONS_CONST_SCRIPT = path.resolve('.', 'src', 'components', 'atoms', 'Icon', 'Icon.const.ts');

export const RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'enum',
  'await',
  'implements',
  'package',
  'protected',
  'static',
  'interface',
  'private',
  'public',
  'null',
  'true',
  'false',
]);
