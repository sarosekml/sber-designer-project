---
component: Pagination
title: "Pagination"
version: "v1.3"
updated: "08.07.2026"
page: pages/molecules/Pagination.html
page_js: scripts/pagination.page.js
css: styles/pagination.css
deps: [dropdown-list, checkbox, label-helper, button, splitter]
status: auto
---

> Автоспека для быстрого контекста. Источник истины — CSS-файл и страница компонента. При изменении компонента обновляй эту спеку.

## Назначение
Нижняя строка многостраничной таблицы: переключение страниц, выбор количества строк на странице и счётчик диапазона. Та же строка может нести панель массового действия над выбранными строками (Action panel) или информационную сводку (Pagi counters) — но сам пагинатор всегда справа. Один фиксированный размер, совпадающий с высотой строки таблицы.

## Ключевые правила (из разделов страницы)
- **Использование** — Пагинатор встраивается в нижнюю строку таблицы и занимает её целиком. Ячейка с пагинатором не имеет отдельного состояния Selected/Focus — она не является строкой данных. Появляется, когда общее число строк превышает размер одной страницы; при единственной странице показывается статичный счётчик без интерактива (см. «Контент»).
- **Анатомия** — Строка состоит из левого информационного слота (опционально) и пагинатора справа: селектор размера страницы, счётчик диапазона и навигация — стрелки, номера, свёрнутый диапазон.
- **Размеры** — Один фиксированный размер: высота строки пагинатора равна высоте строки таблицы (единая сетка колонтитула), кнопки номеров и стрелок — квадрат 32 px. Отдельных размерных модификаций (M/S/XS) у компонента нет — под разную плотность таблицы меняется не пагинатор, а высота строки, к которой он подстраивается через --pgn-h.
- **Поведение · Адаптивность** — Пагинатор перестраивается по ширине своего контейнера (не вьюпорта) — через ResizeObserver. По мере сужения сначала сокращается количество кнопок-номеров, затем строка перестраивается в вертикаль, а на узких уровнях номера скрываются, а счётчик «N из M» встаёт между стрелками (укороченный вариант). Инфо-сводка в левом слоте переносится по пунктам, а не обрезается.
- **Контент** — Размер страницы — фиксированный список вариантов: 5 · 10 · 15 · 20 · 50 · Все. «Все» — отдельное состояние: выводит все строки на одной странице (при большом объёме данных предупредите пользователя, что это может быть медленно — см. «Для разработчиков»).
- **Состояния** — Номер страницы проходит Default → Hover → Current. Current не имеет hover — он уже визуально выделен и не кликабелен. Стрелки получают Disabled на границах диапазона (первая/последняя страница).
- **Доступность** — Навигация обёрнута в <nav aria-label="Страницы">; текущая страница помечена aria-current="page" и не является кнопкой-ссылкой на себя. Стрелки на границах — aria-disabled="true", а не просто визуально приглушены. Каждый интерактивный элемент — фокусируемая кнопка со стандартным фокус-кольцом ДС (2px solid var(--primary)). Селектор размера страницы — обычный триггер DropdownList: aria-haspopup="listbox", список — role="listbox"/option. Свёрнутый диапазон «…» не интерактивен и не должен получать фокус.
- **Цвета** — Номер страницы по умолчанию — вторичный серо-зелёный текст без заливки; при наведении — нейтральная заливка Tertiary_Light и текст темнее. Текущая страница подсвечена тем же токеном, что и выбранная/сфокусированная строка таблицы — --bgtable-row-focus — чтобы визуально читаться в общей системе таблицы. Стрелки повторяют цвет номеров, на границе — StInactive. Disabled — StInactive для текста, DisabledBG для фона текущей.
- **Варианты · Кнопки страниц и стрелки** — Навигация пагинатора собрана из трёх типов элементов: кнопка-номер страницы, кнопка-стрелка (prev/next) и неинтерактивный «…». Раздел описывает их структуру, состояния и поведение — отдельно от композиции строки, чтобы разработчик мог собрать кнопку как самостоятельный примитив.

## Для разработчиков (выжимка)

### Точные размеры (redline)

Таблица рендерится на странице через getComputedStyle. Точные значения — в CSS-файле компонента (см. `css:` в шапке).

### Разметка · HTML (эталонная реализация ДС)

```
<div class="pgn-row">
  <!-- левый слот — опционален, пуст по умолчанию -->
  <div class="pgn-row__left">
    <div class="pgn-info">…</div>
  </div>

  <div class="pgn-row__right">
    <div class="pgn">
      <button class="pgn__pagesize" aria-haspopup="listbox">Показывать строк: <b>50</b></button>
      <span class="pgn__range">3 из 16</span>

      <nav class="pgn__nav" aria-label="Страницы">
        <button class="pgn__arrow" aria-label="Предыдущая страница">‹</button>
        <button class="pgn__num">1</button>
        <button class="pgn__num" aria-current="page">3</button>
        <span class="pgn__ellipsis" aria-hidden="true">…</span>
        <button class="pgn__num">16</button>
        <button class="pgn__arrow" aria-label="Следующая страница">›</button>
      </nav>
    </div>
  </div>
</div>

<!-- есть выбранные строки таблицы — Action panel добавляется НАД строкой пагинатора, -->
<!-- сама строка пагинатора (см. разметку выше) никуда не девается -->
<div class="pgn-footer">
  <div class="pgn-row pgn-row--bulk">
    <div class="pgn-bulk">
      <span class="pgn-bulk__count">Выбрано строк: <b>4</b></span>
      <div class="pgn-bulk__actions">…</div>
    </div>
  </div>
  <div class="pgn-row">…<!-- обычная строка pagesize/range/nav --></div>
</div>
```

### Поведение · псевдокод (framework-agnostic)

```
// 1. totalPages — из общего числа строк и размера страницы («Все» = 1 страница)
totalPages = pageSize === 'all' ? 1 : Math.ceil(totalRows / pageSize)
page = clamp(page, 1, totalPages)

// 2. Свёртывание номеров в «…» — boundaryCount (края) + siblingCount (вокруг текущей),
//    по умолчанию оба = 1. Если бы «…» скрывало ровно 1 страницу — показать её вместо «…».
function pageWindow(current, total, siblingCount = 1, boundaryCount = 1) {
  totalNumbers = boundaryCount*2 + siblingCount*2 + 3
  if (total <= totalNumbers) return range(1, total)     // всё помещается — без «…»

  leftSibling  = max(current - siblingCount, 1)
  rightSibling = min(current + siblingCount, total)
  showLeftEllipsis  = leftSibling  > boundaryCount + 2
  showRightEllipsis = rightSibling < total - boundaryCount - 1
  // комбинируем: [края] + [«…» либо доп. номера] + [соседи текущей] + [«…» либо доп. номера] + [края]
  // полную сборку веток см. pagination.page.js → pageWindow()
}

// 3. Пересчитывать pageWindow при смене page / totalRows / pageSize.
// 4. Компактный режим — по ширине контейнера строки (ResizeObserver),
//    не по брейкпоинту вьюпорта: строка может быть узкой в широком окне (виджет/сайдбар).
//    Порог по умолчанию — эффективная ширина строки < 480px.

// 5. Массовый выбор строк таблицы добавляет панель НАД строкой пагинатора,
//    не заменяя её — обе видны и активны одновременно:
renderFooter({
  bulkPanel: selectedCount > 0 ? { count: selectedCount, actions } : null,
  pagerRow: { info, pager },
})
```

### Pagination.types.ts

```
type PageSize = 5 | 10 | 15 | 20 | 50 | 'all';

interface PaginationProps {
  totalRows: number;
  page: number;                       // controlled, 1-indexed
  pageSize: PageSize;
  pageSizeOptions?: PageSize[];       // по умолчанию [5,10,15,20,50,'all']
  showPageSize?: boolean;               // по умолчанию true
  compact?: boolean;                    // форс компактного режима; авто — по ширине, если не задан
  disabled?: boolean;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: PageSize) => void;
}

interface PaginationRowProps extends PaginationProps {
  // левый слот строки — взаимоисключающий выбор на уровне таблицы:
  info?: { label: string; value: string }[];       // Pagi counters
  selection?: {                     // Action panel — если задан (count > 0), рендерится НАД строкой пагинатора
    count: number;
    actions: { label: string; onClick: () => void; tone?: 'default' | 'danger' }[];
  };
}
```

### Справочник классов и атрибутов

| Класс / атрибут | На чём | Назначение |
|---|---|---|
| .pgn-row | div | Строка колонтитула таблицы целиком, 100% ширины |
| .pgn-row__left / __right | div | Левый (опциональный) и правый (пагинатор) слоты строки |
| .pgn | div | Пагинатор: pagesize + range + nav |
| .pgn--compact | .pgn | Скрывает номера/«…», оставляет стрелки и счётчик |
| .pgn--disabled / --loading | .pgn | Блокирует весь пагинатор целиком |
| .pgn__pagesize | button | Триггер DropdownList — aria-haspopup="listbox" |
| .pgn__range | span | Счётчик «N из M», tabular-nums |
| .pgn__nav | nav | Контейнер стрелок и номеров — aria-label="Страницы" |
| .pgn__arrow | button | Prev/Next — aria-disabled на границах диапазона |
| .pgn__num | button | Номер страницы — aria-current="page" на текущей |
| .pgn__ellipsis | span | Свёрнутый диапазон «…», не интерактивен |
| .pgn-footer | div | Обёртка колонтитула: опциональная строка Action panel + всегда строка пагинатора |
| .pgn-row--bulk | .pgn-row | Модификатор строки, несущей Action panel — белый фон, отделена разделителем от строки пагинатора |
| .pgn-bulk | div | Action panel — рендерится НАД строкой пагинатора, пока есть выбор, не заменяя её |
| .pgn-bulk__count / __actions | span / div | Счётчик выбранных строк и кнопки массовых действий (.btn) |
| .pgn-info | div | Pagi counters — информационная сводка в левом слоте |
| .pgn-info__item / __warn | span | Пункт сводки и предупреждающая пометка (тон Warning) |
