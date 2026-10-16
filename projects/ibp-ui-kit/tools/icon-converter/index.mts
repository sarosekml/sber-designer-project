import fs from 'fs';
import { globSync } from 'glob';
import inquirer from 'inquirer';

import { cloneRepo, runCommandSafely } from '@sber-ibp/frontend-scripts';

import { convert } from './generator.mts';
import { PROJECT_NAME, REPO_NAME, SVG_FOLDER_PATTERN } from './generator.constant.mts';
import { IconPath } from './generator.types.mts';
import { filterVectorsIfExistsInIndex } from './generator.utils.mts';

void (async () => {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Выберите режим работы генератора иконок:',
      choices: [
        {
          value: 'rewrite-all',
          name: 'Перезаписать все иконки (включая существующие)',
          short: 'Перезаписать всё',
        },
        {
          value: 'update-missing',
          name: 'Обновить только отсутствующие иконки',
          short: 'Только новые',
        },
      ],
    },
  ]);
  console.info('Выгрузка репозитория.');
  if (fs.existsSync(REPO_NAME)) fs.rmSync(REPO_NAME, { recursive: true });
  await cloneRepo(REPO_NAME, REPO_NAME, PROJECT_NAME);

  let items: IconPath[] = [];
  console.info('Поиск иконок для дальнейшей обработки');
  switch (mode) {
    case 'rewrite-all':
      items = globSync(SVG_FOLDER_PATTERN) as IconPath[];
      break;
    case 'update-missing':
      items = filterVectorsIfExistsInIndex(globSync(SVG_FOLDER_PATTERN) as IconPath[]);
      break;
  }
  console.info(`Количество иконок: ${items.length}`);
  convert(items);

  if (fs.existsSync(REPO_NAME)) fs.rmSync(REPO_NAME, { recursive: true });

  console.info(
    'Запуск команды `npx eslint src/components/atoms/Icon/Icon.const.ts src/components/atoms/Icon/Icon.mock.ts --fix`',
  );
  await runCommandSafely(
    'npx eslint src/components/atoms/Icon/Icon.const.ts src/components/atoms/Icon/Icon.mock.ts --fix',
  );

  console.info('Запуск команды `npx eslint "src/components/atoms/Icon/**/*.{ts,tsx}" --fix`');
  await runCommandSafely('npx eslint "src/components/atoms/Icon/**/*.{ts,tsx}" --fix');
})();
