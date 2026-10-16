export interface BuiltinIconNodeItem {
  0: string;
  1: Record<string, string | number>;
}

export interface BuiltinIconRecord {
  id: string;
  name: string;
  kebabName: string;
  importName: string;
  package: 'lucide-react';
  source: string;
  license: 'ISC';
  tags: string[];
  iconNode: BuiltinIconNodeItem[];
}

export interface BuiltinIconRegistry {
  schemaVersion: 1;
  provider: 'lucide';
  packageName: 'lucide-react';
  packageVersion: string;
  license: 'ISC';
  generatedFrom: string;
  generatedBy: string;
  defaultImport: {
    package: 'lucide-react';
    example: string;
  };
  count: number;
  icons: BuiltinIconRecord[];
}

export const BUILTIN_LUCIDE_ICONS_URL = new URL('./lucide-icons.json', import.meta.url);
export const BUILTIN_LUCIDE_LICENSE_URL = new URL('./LICENSE-lucide.txt', import.meta.url);
