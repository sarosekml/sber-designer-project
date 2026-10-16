import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const storybookScreensDir = path.join(rootDir, 'src/stories/screens');
const projectFilePath = path.join(rootDir, '.sber-designer/project.sdproj');

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }

    return [entryPath];
  });
}

describe('generated screen artifacts', () => {
  it('uses the installed Storybook React package in generated screen stories', () => {
    const reactViteImports = listFiles(storybookScreensDir)
      .filter((filePath) => filePath.endsWith('.stories.tsx'))
      .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes('@storybook/react-vite'))
      .map((filePath) => path.relative(rootDir, filePath));

    expect(reactViteImports).toEqual([]);
  });

  it('keeps saved story screen file references on disk', () => {
    const project = JSON.parse(fs.readFileSync(projectFilePath, 'utf8')) as {
      screens?: Array<{
        kind?: string;
        name?: string;
        filePath?: string;
        implementationFilePath?: string;
      }>;
    };

    const missingReferences = (project.screens ?? [])
      .filter((screen) => screen.kind === 'story')
      .flatMap((screen) =>
        [
          ['filePath', screen.filePath],
          ['implementationFilePath', screen.implementationFilePath],
        ] as const
      )
      .filter(([, filePath]) => filePath)
      .filter(([, filePath]) => !fs.existsSync(path.join(rootDir, filePath as string)))
      .map(([field, filePath]) => `${field}: ${filePath}`);

    expect(missingReferences).toEqual([]);
  });

  it('does not keep registered generated screens as empty canvases', () => {
    const project = JSON.parse(fs.readFileSync(projectFilePath, 'utf8')) as {
      screens?: Array<{
        kind?: string;
        name?: string;
        implementationFilePath?: string;
      }>;
    };

    const emptyCanvasScreens = (project.screens ?? [])
      .filter((screen) => screen.kind === 'story' && screen.implementationFilePath)
      .filter((screen) => {
        const implementationPath = path.join(rootDir, screen.implementationFilePath as string);

        return fs.existsSync(implementationPath) && fs.readFileSync(implementationPath, 'utf8').includes('data-sd-empty-canvas');
      })
      .map((screen) => `${screen.name}: ${screen.implementationFilePath}`);

    expect(emptyCanvasScreens).toEqual([]);
  });
});
