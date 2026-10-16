import fs from 'fs';
import core from 'jscodeshift';
import path from 'path';
import ts from 'typescript';

import { PATH_TO_ICONS_DIR, RESERVED_WORDS } from './generator.constant.mts';
import { IconPath } from './generator.types.mts';

/**
 * Преобразует первый символ строки в верхний регистр.
 *
 * @param str - Исходная строка
 * @returns Строка с заглавной первой буквой
 */
export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1);
}

/**
 * Преобразует строку из kebab-case в camelCase.
 *
 * @param str - Строка в формате kebab-case
 * @returns Строка в формате camelCase
 */
export function convertToCamelCase(str: string): string {
  return str.split('-').map(capitalize).join('');
}

/**
 * Очищает атрибуты SVG от нежелательных стилей.
 *
 * Заменяет:
 * - fill="#000000" → fill="currentColor"
 * - stroke="#FFFFFF" → stroke="currentColor"
 * - Удаляет id, fill-opacity, stroke-opacity
 *
 * @param str - Строка с SVG-атрибутами
 * @returns Очищенная строка
 */
export function sanitizeAttribute(str: string): string {
  return str
    .replace(/fill="#000000"/, 'fill="currentColor"')
    .replace(/fill="[^"]*"/, '')
    .replace(/id="[^"]*"/, '')
    .replace(/stroke="#FFFFFF"/, '')
    .replace(/stroke="[^"]*"/, 'stroke="currentColor"')
    .replace(/fill-opacity="1.0+"/, '')
    .replace(/stroke-opacity="1.0+"/, '')
    .replace('  ', ' ');
}

/**
 * Преобразует атрибуты тега в camelCase.
 *
 * @param tag - Строка с HTML-тегом
 * @returns Тег с преобразованными атрибутами
 */
export function camelizeAttributesInTag(tag: string): string {
  const pattern = /<\s*([^\s/>]+)((?:\s+[^\s/>=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]+))?)*)\s*(\/?)>/s;

  return tag.replace(pattern, (_m, tagName: string, attrs: string, selfClose: string) => {
    if (!attrs) return `<${tagName}${selfClose ? '/>' : '>'}`;

    const toCamel = (name: string) => name.replace(/[-_:]+([a-zA-Z0-9])/g, (_s, ch: string) => ch.toUpperCase());

    const attrsCamel = String(attrs).replace(
      /\s+([^\s=/>]+)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]+))?/g,
      (_full, name: string, rest = '') => {
        if (name.startsWith('...')) return ` ${name}${rest ?? ''}`;
        return ` ${toCamel(name)}${rest ?? ''}`;
      },
    );

    return `<${tagName}${attrsCamel}${selfClose ? '/>' : '>'}`;
  });
}

/**
 * Парсит имена экспортированных компонентов из файла.
 *
 * @param filePath - Путь к TS-файлу
 * @returns Массив имен экспортированных компонентов
 */
export function parseExportNames(filePath: string): string[] {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

  const exportNames: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        exportNames.push(element.name.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exportNames;
}

/**
 * Добавляет экспорт компонента в файл, если он еще не существует.
 *
 * @param componentName - Имя компонента для экспорта
 * @param scriptPath - Путь к файлу с экспортами
 */
export function addExportToFile(componentName: string, scriptPath: string): void {
  const sourceText = fs.readFileSync(scriptPath, 'utf-8');
  const sourceFile = ts.createSourceFile(scriptPath, sourceText, ts.ScriptTarget.Latest, true);

  let alreadyExists = false;

  function visit(node: ts.Node) {
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        if (element.name.text === componentName) {
          alreadyExists = true;
          return;
        }
      }
    }
    if (!alreadyExists) {
      ts.forEachChild(node, visit);
    }
  }

  visit(sourceFile);

  if (alreadyExists) return;

  const newExportLine = `export { ${componentName} } from './${componentName}';\n`;
  const updatedContent = sourceText.trimEnd() + '\n' + newExportLine;
  fs.writeFileSync(scriptPath, updatedContent, 'utf-8');
}

/**
 * Добавляет компонент в файл моков.
 *
 * 1. Обновляет импорт из "./icons"
 * 2. Добавляет запись в iconsMockMap
 *
 * @param filePath - Путь к файлу моков
 * @param componentName - Имя добавляемого компонента
 */
export function addComponentToMockFile(filePath: string, componentName: string): void {
  const j = core.withParser('tsx');
  const source = fs.readFileSync(filePath, 'utf-8');
  const root = j(source);

  const iconsImport = root.find(j.ImportDeclaration, {
    source: { value: './icons' },
  });

  if (iconsImport.size() > 0) {
    const hasComponent =
      iconsImport
        .find(j.ImportSpecifier, {
          imported: { name: componentName },
        })
        .size() > 0;

    if (!hasComponent) {
      iconsImport.get().value.specifiers.push(j.importSpecifier(j.identifier(componentName)));
      const specifiers = iconsImport.get().value.specifiers;
      specifiers.sort((a: any, b: any) => {
        if (a.imported?.name && b.imported?.name) {
          return a.imported.name.localeCompare(b.imported.name);
        }
        return 0;
      });
    }
  } else {
    const newImport = j.importDeclaration([j.importSpecifier(j.identifier(componentName))], j.stringLiteral('./icons'));
    root.get().node.program.body.unshift(newImport);
  }

  root
    .find(j.VariableDeclarator, {
      id: { name: 'iconsMockMap' },
    })
    .forEach((path) => {
      const hasEntry =
        j(path)
          .find(j.ObjectProperty, {
            key: { name: componentName },
          })
          .size() > 0;

      if (!hasEntry) {
        const objectExpression = path.value.init;
        if (objectExpression && objectExpression.type === 'ObjectExpression') {
          const newProperty = j.property(
            'init',
            j.identifier(componentName),
            j.objectExpression([
              j.property('init', j.identifier('icon'), j.identifier(componentName)),
              j.property('init', j.identifier('oldName'), j.stringLiteral('-')),
            ]),
          );

          objectExpression.properties.push(newProperty);
          objectExpression.properties.sort((a: any, b: any) => {
            if (a.key?.name && b.key?.name) {
              return a.key.name.localeCompare(b.key.name);
            }
            return 0;
          });
        }
      }
    });

  fs.writeFileSync(filePath, root.toSource(), 'utf-8');
}

/**
 * Добавляет компонент в константный файл иконок.
 *
 * 1. Обновляет импорт из "./icons"
 * 2. Добавляет запись в iconsMap
 *
 * @param filePath - Путь к константному файлу
 * @param componentName - Имя добавляемого компонента
 */
export function addComponentToIconsConstFile(filePath: string, componentName: string): void {
  const j = core.withParser('tsx');
  const source = fs.readFileSync(filePath, 'utf-8');
  const root = j(source);

  const iconsImport = root.find(j.ImportDeclaration, {
    source: { value: './icons' },
  });

  if (!iconsImport) throw new Error('Invalid format');

  if (
    !iconsImport
      .find(j.ImportSpecifier, {
        imported: { name: componentName },
      })
      .size()
  ) {
    iconsImport.get().value.specifiers.push(j.importSpecifier(j.identifier(componentName)));
  }

  const map = root.find(j.VariableDeclarator, {
    id: { name: 'iconsMap' },
  });

  if (!map) throw new Error('Invalid format');

  map.forEach((path) => {
    const hasComponent =
      j(path)
        .find(j.ObjectProperty, {
          key: { name: componentName },
        })
        .size() > 0;

    if (!hasComponent) {
      const objectExpression = path.value.init;
      if (objectExpression && objectExpression.type === 'ObjectExpression') {
        const newProperty = j.property('init', j.identifier(componentName), j.identifier(componentName));
        (newProperty as any).shorthand = true;

        objectExpression.properties.push(newProperty);
        objectExpression.properties.sort((a: any, b: any) => {
          if (a.key?.name && b.key?.name) {
            return a.key.name.localeCompare(b.key.name);
          }
          return 0;
        });
      }
    }
  });

  fs.writeFileSync(filePath, root.toSource(), 'utf-8');
}

/**
 * Фильтрует список иконок, исключая уже существующие компоненты.
 *
 * @param iconPathList - Список путей к иконкам
 * @returns Отфильтрованный список новых иконок
 */
export const filterVectorsIfExistsInIndex = (iconPathList: IconPath[]): IconPath[] => {
  const existsComponents = parseExportNames(path.resolve(PATH_TO_ICONS_DIR, 'index.ts'));
  return iconPathList.filter((iconPath) => {
    const iconName = path.basename(iconPath);
    const formattedVectorName = convertToCamelCase(iconName.replace('.svg', ''));
    return !existsComponents.includes(formattedVectorName);
  });
};

/**
 * Проверяет, может ли заданная строка быть допустимым JavaScript-идентификатором (названием переменной).
 *
 * Учитывает:
 * - Не пустая строка
 * - Состоит только из допустимых символов (буквы, цифры, _, $)
 * - Первый символ — буква, _, или $
 * - Не является зарезервированным словом (например, 'if', 'function' и т.д.)
 *
 * @param {string} name - Проверяемое имя переменной.
 * @returns {boolean} - `true`, если строка может быть использована как имя переменной, иначе `false`.
 *
 * @example
 * isValidVariableName('myVar');     // true
 * isValidVariableName('123abc');    // false
 * isValidVariableName('_valid');    // true
 * isValidVariableName('$test');     // true
 * isValidVariableName('let');       // false (зарезервировано)
 * isValidVariableName('');          // false
 * isValidVariableName('my-var');    // false (недопустимый символ '-')
 */
export function isValidVariableName(name: string): boolean {
  if (typeof name !== 'string' || name === '') {
    return false;
  }

  // Список зарезервированных слов в JavaScript (частичный, можно расширить при необходимости)

  if (RESERVED_WORDS.has(name)) {
    return false;
  }

  if (!/^[a-zA-Z_$]/.test(name)) {
    return false;
  }

  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return false;
  }

  return true;
}
