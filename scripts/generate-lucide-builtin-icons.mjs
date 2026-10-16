import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';

const repoRoot = process.cwd();
const lucideRoot = path.join(repoRoot, 'node_modules', 'lucide-react');
const iconsDir = path.join(lucideRoot, 'dist', 'esm', 'icons');
const packageJsonPath = path.join(lucideRoot, 'package.json');
const licensePath = path.join(lucideRoot, 'LICENSE');
const outDir = path.join(repoRoot, 'packages', 'design-indexer', 'src', 'builtin-icons');
const outJsonPath = path.join(outDir, 'lucide-icons.json');
const outLicensePath = path.join(outDir, 'LICENSE-lucide.txt');
const outReadmePath = path.join(outDir, 'README.md');

function toPascalCase(kebab) {
  return kebab
    .split('-')
    .map((part) => {
      if (/^\d/.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('')
    .replace(/3D/g, '3d')
    .replace(/2D/g, '2d');
}

function extractIconNode(source, fileName) {
  const marker = 'createLucideIcon(';
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Cannot find createLucideIcon call in ${fileName}`);
  }

  const arrayStart = source.indexOf('[', markerIndex);
  if (arrayStart === -1) {
    throw new Error(`Cannot find icon node start in ${fileName}`);
  }

  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escape = false;

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(arrayStart, index + 1);
      }
    }
  }

  throw new Error(`Cannot find icon node end in ${fileName}`);
}

async function main() {
  const check = process.argv.includes('--check');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const license = await readFile(licensePath, 'utf8');
  const files = (await readdir(iconsDir))
    .filter((file) => file.endsWith('.js') && !file.endsWith('.js.map') && file !== 'index.js')
    .sort((a, b) => a.localeCompare(b));

  const icons = [];

  for (const file of files) {
    const source = await readFile(path.join(iconsDir, file), 'utf8');
    const iconNameMatch = source.match(/createLucideIcon\("([^"]+)"/);
    if (!iconNameMatch) continue;

    const kebabName = file.replace(/\.js$/, '');
    const displayName = iconNameMatch[1];
    const iconNodeText = extractIconNode(source, file);
    const iconNode = Function(`"use strict"; return (${iconNodeText});`)();

    icons.push({
      id: `lucide:${kebabName}`,
      name: displayName,
      kebabName,
      importName: toPascalCase(kebabName),
      package: 'lucide-react',
      source: `lucide-react@${packageJson.version}`,
      license: 'ISC',
      tags: kebabName.split('-'),
      iconNode,
    });
  }

  const registry = {
    schemaVersion: 1,
    provider: 'lucide',
    packageName: 'lucide-react',
    packageVersion: packageJson.version,
    license: 'ISC',
    generatedFrom: 'node_modules/lucide-react/dist/esm/icons',
    generatedBy: 'scripts/generate-lucide-builtin-icons.mjs',
    defaultImport: {
      package: 'lucide-react',
      example: "import { Search } from 'lucide-react';",
    },
    count: icons.length,
    icons,
  };

  const readme = [
    '# Built-in Lucide Icon Registry',
    '',
    'This directory stores the sber-designer fallback icon registry used by the future design-system indexer.',
    '',
    '- `lucide-icons.json` is generated from the pinned `lucide-react` package in this repository.',
    '- `LICENSE-lucide.txt` is copied from `node_modules/lucide-react/LICENSE`.',
    '- Regenerate after changing `lucide-react` with:',
    '',
    '```bash',
    'bun run generate:lucide-icons',
    '```',
    '',
    'The registry is not automatically injected into generated project code. It is a controlled fallback vocabulary for the agent/indexer when a project has no icon system of its own.',
    '',
  ].join('\n');
  const prettierConfig = (await resolveConfig(outJsonPath)) ?? {};
  const outputs = new Map([
    [outJsonPath, await format(JSON.stringify(registry), { ...prettierConfig, filepath: outJsonPath })],
    [outLicensePath, license],
    [
      outReadmePath,
      await format(readme, {
        ...prettierConfig,
        filepath: outReadmePath,
        proseWrap: 'always',
      }),
    ],
  ]);

  if (check) {
    const stale = [];
    for (const [outputPath, expected] of outputs) {
      const actual = await readFile(outputPath, 'utf8').catch(() => null);
      if (actual !== expected) stale.push(path.relative(repoRoot, outputPath));
    }
    if (stale.length > 0) {
      throw new Error(
        `Stale Lucide registry output: ${stale.join(', ')}. Run bun run generate:lucide-icons.`,
      );
    }
    console.log(`Lucide registry is current (${icons.length} icons).`);
    return;
  }

  await mkdir(outDir, { recursive: true });
  for (const [outputPath, content] of outputs) await writeFile(outputPath, content);

  console.log(`Generated ${icons.length} Lucide icons at ${path.relative(repoRoot, outJsonPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
