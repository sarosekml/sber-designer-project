/**
 * Класс для конвертации SVG-икон в реакт-компоненты и управления репозиторием.
 *
 * @module converter
 */
import fs from 'fs';
import path from 'path';

import { PATH_ICONS_CONST_SCRIPT, PATH_TO_ICONS_DIR, PATH_TO_ICONS_MOCK } from './generator.constant.mts';
import { COMPONENT_TEMPLATE } from './generator.templates.mts';
import { IconPath } from './generator.types.mts';
import {
  addComponentToIconsConstFile,
  addComponentToMockFile,
  addExportToFile,
  camelizeAttributesInTag,
  convertToCamelCase,
  isValidVariableName,
  sanitizeAttribute,
} from './generator.utils.mts';

/**
 * Конвертирует SVG-файлы в реакт-компоненты.
 *
 * Выполняет:
 * - Обработку атрибутов SVG
 * - Генерацию TSX-файлов
 * - Добавление экспортов
 * - Обновление моков и констант
 *
 * @param iconPathList - Массив путей к SVG-иконкам
 * @method convert
 */
export function convert(iconPathList: IconPath[]): void {
  for (const iconPath of iconPathList) {
    const data = fs.readFileSync(iconPath, 'utf8');
    const pathMatch = [...data.matchAll(/(<path\s.*?\/>)/g)];
    const rectElement = null;
    const pathElements = [...pathMatch].map((p) => camelizeAttributesInTag(sanitizeAttribute(p[0])));

    const elements = [rectElement, ...pathElements].filter((x) => x).join('\r\n      ');

    const iconName = path.basename(iconPath);
    const componentName = convertToCamelCase(iconName.replace('.svg', ''));
    console.info(`- Обработка "${componentName}"`);
    if (!isValidVariableName(componentName)) {
      console.error(`Используется недоступный наименование переменной "${componentName}"`);
      process.exit(1);
    }

    const componentTemplate = COMPONENT_TEMPLATE(componentName, elements);
    const outputPath = path.join(PATH_TO_ICONS_DIR, `${componentName}.tsx`);

    fs.writeFileSync(outputPath, componentTemplate.trim());
    addExportToFile(componentName, path.resolve(PATH_TO_ICONS_DIR, 'index.ts'));
    addComponentToMockFile(PATH_TO_ICONS_MOCK, componentName);
    addComponentToIconsConstFile(PATH_ICONS_CONST_SCRIPT, componentName);
  }
}
