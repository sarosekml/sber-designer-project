---
component: TableCell
title: "TableCell"
version: "v1.3"
updated: "08.07.2026"
page: pages/organisms/TableCell.html
css: styles/table-cell.css
deps: [checkbox, chip, icon-button, button, tooltip]
status: curated
---

> Спека для быстрого контекста. Источник истины — CSS-файл и страница компонента. При изменении компонента обновляй эту спеку и блок в specs/_cheatsheet.md.

## Назначение
Ячейка таблицы (`.tc`) и ячейка шапки — TableHeader (`.th`). Универсальный контейнер для любого типа контента строки: текст, числа, дерево, чипы, контролы, редактируемые поля. Используется как атом строки при сборке любой таблицы/реестра/дерева/формы-таблицы. Собственного фона и скруглений нет — наследует фон строки; скругления даёт контейнер таблицы (`.tbl`).

## Ключевые правила (из разделов страницы)
- **Использование** — из ячеек разных типов собирается любая колонка: реестр (чекбокс, чипы-статусы, суммы, действия), дерево иерархии, редактируемая форма-таблица.
- **Анатомия** — `.tc`: prefix · значение (slot) · postfix · warning; нижний бордер, без заливки. `.th`: подпись + кнопка сортировки + действие (кебаб/фильтр).
- **Размеры** — одна ячейка, три плотности (модификатор): Compact 36 · Default 44 · Comfortable 56. Плотность масштабирует высоту, горизонтальный паддинг (12/16/16), зазор (8/10/12).
- **Контент** — текст слева, усечение + Tooltip; числа/даты справа, tabular-nums; multirow клэмп 2; 2row = значение + subtext; пусто = «—»; действий max 2–3 → кебаб.
- **Состояния** — Default · Hover · Focus · Selected (строка) · Disabled · Error (+error-bg) · Empty · Skeleton. Фон колонки: Accent · Pinned (со своими hover/focus-тонами). EditMark (`--edited`) — угловой маркер правки.
- **Доступность** — нативные table/th/td или role=grid/columnheader/gridcell; `aria-sort` на шапке; чекбокс + `aria-selected` для выбора; клавиатура grid-pattern, `:focus-visible` inset outline; Tooltip для усечения; `aria-expanded`/`aria-level` для дерева; `aria-busy` для skeleton; статус не только цветом.
- **Цвета** — текст `--text-black`/`--text-secondary`/`--text-inactive`; фон строки `--bgtable`/`-row-hover`/`-row-focus`/`--primary-bg`/`--error-bg-light`; фон колонки `--bgtable-accent*`/`--bgtable-pinned*`; границы `--border-light`(ячейка)/`--border-primary`(шапка); акценты `--primary` (фокус, активн. сортировка, рамка input), `--warning` (предупреждение), `--error`, `--chart-orange` (EditMark).

## Для разработчиков (выжимка)

### Точные размеры (redline)
Таблица на странице рендерится через getComputedStyle с реального экземпляра. Значения плотности — в `styles/table-cell.css` (переключаемые токены `--tc-minh` 36/44/56, `--tc-px` 12/16/16, `--tc-gap` 8/10/12, `--tc-tree-step` 20). Типографика значения — `--type-body-s` (14).

### Разметка · HTML (эталонная реализация ДС)

```html
<!-- density: (базовый) | .tc--compact | .tc--comfortable ; fon: .tc--accent|.tc--pinned -->
<!-- state: .tc--hover/--focus/--selected/--disabled/--error(+--error-bg)/--skeleton -->
<td class="tc">
  <span class="tc__prefix">от</span>
  <span class="tc__text tc__text--truncate">Значение</span>
  <span class="tc__postfix">₽</span>
  <span class="tc__warn"><svg…/></span>
</td>
<td class="tc tc--numbers"><span class="tc__text">1 240 500</span></td>
<td class="tc tc--2row"><span class="tc__stack"><span class="tc__text">ООО «Восток»</span><span class="tc__subtext">ИНН 7701234567</span></span></td>
<td class="tc tc--tree" style="--tc-level:1"><button class="tc__twisty" aria-expanded="true"><svg chevron/></button><span class="tc__text">Дочернее ООО</span></td>
<td class="tc"><div class="tc__hidden"><button class="ibtn ibtn--neutral ibtn--s" aria-label="Изменить"><svg…/></button></div></td>
<td class="tc tc--input tc--edited"><div class="tc__field"><input class="tc__field-input"><span class="tc__field-icon"><svg calendar/></span><button class="tc__field-clear"><svg…/></button></div></td>
<td class="tc"><span class="tc__empty">—</span></td>
<td class="tc tc--skeleton"><span class="tc__skeleton"></span></td>
<td class="tc tc--separator"><span class="tc__rule"></span></td>

<th class="th th--right th--sorted" aria-sort="descending">
  <span class="th__label">Сумма, ₽</span>
  <button class="th__sort" aria-label="Сортировка"><svg sort-down/></button>
  <button class="th__action ibtn ibtn--neutral ibtn--s" aria-label="Меню"><svg…/></button>
</th>
```

### Поведение · псевдокод (framework-agnostic)
- **Усечение + Tooltip**: если `scrollWidth > clientWidth` — показать Tooltip/title с полным текстом.
- **Числа**: справа + `font-variant-numeric: tabular-nums`; форматировать через Intl.NumberFormat.
- **Сортировка (шапка)**: клик → цикл none→asc→desc→none; `aria-sort` и иконка (sort→sort-up→sort-down) синхронны; активна максимум одна колонка.
- **Выбор строк**: заголовочный чекбокс = выбрать все / indeterminate; клик по строке вне интерактивных элементов — toggle.
- **Дерево**: отступ = `--tc-level`; твисти toggle `aria-expanded`; лист — `.tc__twisty--leaf` (место зарезервировано).
- **Клавиатура**: стрелки — перемещение фокуса по ячейкам; Enter/F2 — вход в редактирование input-ячейки; Esc — отмена; фокус-ячейка `:focus-visible` inset outline.
- **Скрытые действия**: `.tc__hidden` видимы при `:hover`/`:focus-within` строки; на тач — показывать постоянно.
- **EditMark**: после изменения значения ставить `.tc--edited` до сохранения/сброса; ошибку валидации — `.tc--error` + tooltip с причиной.

### Справочник классов и атрибутов

| Класс/атрибут | Назначение |
|---|---|
| `.tc` | ячейка: flex-строка, align-items center, нижний бордер, без фона |
| `.tc--compact` / `--comfortable` | плотность строки (высота/паддинг/зазор); базовый = Default |
| `.tc--right` / `--center` | горизонтальное выравнивание контента |
| `.tc--numbers` | числовая колонка: справа + tabular-nums |
| `.tc--accent` / `--pinned` | фон колонки (акцент / закреплённая) |
| `.tc--hover` / `--focus` / `--selected` | состояние строки (демо-классы; в проде :hover/JS) |
| `.tc--disabled` / `--error` / `--skeleton` | служебные состояния; `--error-bg` — красная заливка |
| `.tc--edited` | EditMark — угловой маркер правки (chart-orange) |
| `.tc__text` / `--truncate` | значение (Body S); усечение в строку + Tooltip |
| `.tc__prefix` / `__postfix` | серые аффиксы (inactive) |
| `.tc__warn` | иконка-предупреждение (warning) после текста |
| `.tc__empty` | прочерк «—» пустого значения |
| `.tc--multirow` / `--2row` | многострочный / двухстрочный контент |
| `.tc__stack` / `__subtext` | стек значений и вторичная строка (2Row) |
| `.tc--tree` + `--tc-level` | узел дерева; отступ = уровень × 20px |
| `.tc__twisty` / `--leaf` | твисти раскрытия; лист без иконки |
| `.tc__controls` | обёртка кнопок/чипов в ячейке |
| `.tc__hidden` | скрытые действия — видимы по hover/focus строки |
| `.tc--input` / `.tc__field` | редактируемая ячейка; поле с рамкой в фокусе |
| `.tc__field-input` / `-icon` / `-clear` | инпут, иконка (календарь/поиск), очистка |
| `.tc--separator` / `.tc__rule` | колонка-разделитель (вертикальная линия) |
| `.tc__skeleton` | плейсхолдер загрузки (шиммер) |
| `.th` | ячейка шапки (TableHeader) |
| `.th__label` | подпись колонки (усекается) |
| `.th__sort` / `.th--sorted` | кнопка сортировки; активная — primary |
| `.th__action` | действие шапки (кебаб/фильтр) по hover |
| `aria-sort` / `aria-busy` / `aria-expanded` | сортировка / загрузка / раскрытие дерева |
| `.tbl` / `.tbl__row` | утилита демо-раскладки (grid); в проде — table |
