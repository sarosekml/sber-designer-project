---
component: Popover
title: "Popover"
version: "v1.1"
updated: "07.07.2026"
page: pages/organisms/Popover.html
page_js: scripts/popover.page.js
css: styles/popover.css
deps: [button, icon-button, link, chip, label-helper]
status: curated
---

> Спека для быстрого контекста. Источник истины — CSS-файл и страница компонента. При изменении компонента обновляй эту спеку и блок в specs/_cheatsheet.md.

## Назначение
Popover — нон-модальный всплывающий контейнер, привязанный к триггеру. Показывает расширенный контекстный контент (текст с форматированием, интерактив, формы, легенды, списки). В отличие от Tooltip — открывается по клику и не закрывается при уходе курсора; в отличие от Modal — не блокирует страницу, не имеет скрима, закрывается кликом вне себя.

## Ключевые правила (из разделов страницы)
- **Использование** — Клик/Enter/Space открывает, контент — текст+интерактив/формы/медиа (не только строка, как у Tooltip), страницу не блокирует (в отличие от Modal). Правило переключения на Modal: ширина контенту нужна больше 560px, либо вертикальной прокрутки тела недостаточно.
- **Анатомия** — 2 обязательные + 3 опциональные части: Trigger (обязателен, вне поповера) → Header (опц.: высота 48px, содержимое по центру по вертикали, фон --bgtable-pinned; заголовок Body S Strong 14px + опц. чип/ссылка (чип примыкает с gap 8px) + ✕, **без кнопок действий**) → Body (обязателен, единственная гибкая/прокручиваемая зона; содержимое почти любое, жёстких ограничений по типу контента нет) → Footer (опц.: foot-left и foot-right — независимо включаемые группы, фон --bgtable-pinned; слева инфо/ссылка/кнопка, справа Secondary+Primary) → Arrow (опц., по умолчанию выключена, как у Menu/DropdownList).
- **Размеры** — 5 фиксированных шагов ширины (--pop-w-s…max, 240–560px), не резиновая. Каждый шаг задаёт свой max-height тела (auto/320/440/520/600px) — дальше только тело прокручивается, Header/Footer закреплены. Свыше 560px — переключение на Modal.
- **Контент** — Body не диктует состав (текст+ссылка, легенда/список, форма, карточка данных, таблица). Header добавляется при метке/группировке, форме с несколькими полями или ширине >320px. Footer — когда есть форма/выбор, требующий подтверждения, или деструктивное действие. Порядок кнопок Footer идентичен Modal: справа Secondary+Primary, слева — только информация/ссылки, никогда действия.
- **Состояния** — Открытие: click/Enter/Space (primary), hover/focus — опционально и никогда единственным способом. Закрытие — 5 равнозначно обязательных способов: ✕, клик вне, Esc, Tab за последний интерактивный элемент (нет focus trap — отличие от Modal), контекстно кнопка-действие в Footer. Одновременно открыт только один поповер — новый закрывает предыдущий. Запрещено автозакрытие по таймеру и открытие при загрузке страницы. Есть loading (skeleton в Body, aria-busy) и error (role="alert") состояния тела, disabled-триггер (не открывается), тень у Header/Footer при прокрутке тела (.is-scrolled, как у Modal).
- **Placement** — 4 стороны × 3 выравнивания = 12 позиций, приём идентичен Tooltip (ARROW_INSET-подобная логика). Авто-flip: не хватает места по предпочтительному align — перевыравнивание на противоположный край; не хватает места по стороне — пробуются противоположная и перпендикулярные стороны.
- **Доступность** — Триггер: aria-haspopup="dialog", aria-expanded, aria-controls. Контейнер: role="dialog", aria-modal="false" (не блокирует), aria-labelledby на заголовок при наличии Header. Фокус переходит внутрь при открытии, но НЕ заперт (нет focus trap) — Tab с последнего элемента уводит из поповера и закрывает его. Esc закрывает и возвращает фокус на триггер. Контент страницы за поповером НЕ получает aria-hidden/inert (в отличие от Modal).
- **Цвета** — Только семантические токены. Фон Body — --bg-popup; фон Header/Footer — --bgtable-pinned (Pinned Default, #F5F7F7); радиус --radius-m (8px); тень --elevation-5, внешнего бордера нет. Не собственный rgba().

## Для разработчиков (выжимка)

### Точные размеры (redline)
Таблица рендерится на странице через getComputedStyle. Точные значения — в CSS-файле компонента (см. `css:` в шапке): радиус контейнера, паддинги Header/Body/Footer, зазор кнопок подвала, зазор от триггера (8px), толщина разделителя.

### Разметка · HTML (эталонная реализация ДС)

```
<span class="pop-anchor">
  <button type="button" aria-haspopup="dialog" aria-expanded="true" aria-controls="pop-1">…</button>

  <div id="pop-1" class="pop pop--w-m pop--bottom pop--start pop--floating" role="dialog" aria-modal="false" aria-labelledby="pop-1-title">
    <div class="pop__head">
      <div class="pop__head-main">
        <h3 class="pop__title" id="pop-1-title">Изменить тег</h3>
        <!-- опц.: chip/link, gap 8px от заголовка -->
      </div>
      <span class="pop__close"><button type="button" class="ibtn ibtn--neutral ibtn--s" aria-label="Закрыть"><svg…></svg></button></span>
    </div>
    <div class="pop__body">…форма, легенда, карточка, таблица…</div>
    <div class="pop__foot">
      <div class="pop__foot-left"></div>
      <div class="pop__foot-right">
        <button class="btn btn--transparent btn--s">Отмена</button>
        <button class="btn btn--accent btn--s">Применить</button>
      </div>
    </div>
    <span class="pop__arrow"></span>
  </div>
</span>
```

### Поведение · псевдокод (framework-agnostic)

```
// 1. Реестр единственного открытого поповера — новый открывающийся закрывает предыдущий
// 2. Позиционирование: rect триггера/поповера, gap 8px, align сдвигает по вторичной оси
//    (отступ под стрелку: 18px top/bottom, 14px left/right)
// 3. Авто-flip align (start↔end) и placement (противоположная → перпендикулярные), как у Tooltip
// 4. Закрытие — 5 способов: ✕ / клик вне / Esc / Tab за последний элемент (без focus trap) / кнопка-действие
// 5. Тень Header/Footer по scrollTop тела — идентично Modal (.is-scrolled)
// 6. prefers-reduced-motion — анимация выключается, мгновенный показ/скрытие
```

### Popover.types.ts

```
type PopoverWidth = 's' | 'm' | 'l' | 'xl' | 'max';
type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right';
type PopoverAlign = 'start' | 'center' | 'end';

interface PopoverFooterAction { label: string; onClick(): void; disabled?: boolean; }

interface PopoverProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  trigger: React.ReactElement;           // клонируется с aria-haspopup/aria-expanded/aria-controls
  title?: string;                        // задан → рендерит Header с заголовком и ✕
  width?: PopoverWidth;                  // по умолчанию 'm' (320px)
  placement?: PopoverPlacement;          // по умолчанию 'bottom'; авто-flip
  align?: PopoverAlign;                  // по умолчанию 'start'
  arrow?: boolean;                       // по умолчанию false
  offset?: number;                       // зазор от триггера, по умолчанию 8
  children: React.ReactNode;             // Body
  primaryAction?: PopoverFooterAction;   // правый Primary — рендерит Footer
  secondaryAction?: PopoverFooterAction; // правый Secondary
  footerLeft?: React.ReactNode;          // служебная информация/ссылка слева — НЕ действие
  closeOnOutsideClick?: boolean;         // по умолчанию true, отключать запрещено
  closeOnEsc?: boolean;                  // по умолчанию true, отключать запрещено
}
```

### Справочник классов и атрибутов

| Класс/атрибут | Назначение |
|---|---|
| `.pop-anchor` | position:relative обёртка вокруг триггера |
| `.pop` | Корень: фон, радиус 8px (--radius-m), тень --elevation-5, без внешнего бордера |
| `.pop--w-s … --w-max` | Ширина — 5 шагов (240–560px), задаёт и max-height тела |
| `.pop--floating` / `.pop--pinned` | JS-позиционирование + `.is-open` / всегда открыт (демо) |
| `.pop--top/-bottom/-left/-right` + `--start/-center/-end` | 12 позиций размещения |
| `.pop--arrow` | Включает стрелку-указатель `.pop__arrow` (по умолчанию выключена) |
| `.pop__head` / `.pop__foot` | Фиксированные зоны, фон --bgtable-pinned; Header — 48px, центрирован по вертикали; тень при `.is-scrolled` |
| `.pop__head-main` | Заголовок + опц. чип/ссылка, газап 8px |
| `.pop__title` | Заголовок — Body S Strong 14px, 1 строка |
| `.pop__close` | Обёртка ✕ — кнопка `.ibtn.ibtn--neutral.ibtn--s` |
| `.pop__body` (+ `--flush`) | Единственная гибкая/прокручиваемая зона; содержать может почти что угодно |
| `.pop__foot-left` / `-right` | Независимо включаемые группы: слева инфо/ссылка/кнопка, справа Secondary+Primary |
| `.pop__skeleton` | Loading-плейсхолдер (шиммер) |
| `role="dialog"` / `aria-modal="false"` | Не блокирующий диалог |
| `aria-haspopup` / `aria-expanded` / `aria-controls` | На триггере — связь с поповером |
