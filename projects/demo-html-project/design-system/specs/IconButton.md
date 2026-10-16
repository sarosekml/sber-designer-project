---
component: IconButton
title: "IconButton"
version: "v1.2"
updated: "08.07.2026"
page: pages/atoms/IconButton.html
css: styles/icon-button.css
deps: [badge]
status: auto
---

> Автоспека для быстрого контекста. Источник истины — CSS-файл и страница компонента. При изменении компонента обновляй эту спеку.

## Назначение
Безрамочная кнопка с одной иконкой и круглым стейт-слоем (риплом). Цвет рипла соответствует цвету иконки. Тоны Neutral / Primary / Danger / Contrast, размеры L / M / S, состояния Default / Hover / Pressed / Focus / Disabled / Loading, режим-переключатель и встроенный вариант для полей ввода.

## Ключевые правила (из разделов страницы)
- **Использование** — IconButton подходит, когда:
- **Анатомия** — Компонент состоит из иконки и круглого стейт-слоя вокруг неё. Стейт-слой появляется на Hover / Pressed и заполняет всю область компонента; его цвет — это полупрозрачный оттенок цвета иконки. Кликабельная область равна размеру компонента.
- **Размеры** — Три размера. Компонент квадратный; размер иконки привязан к размеру кнопки. L — 40 · самостоятельные действия, тулбары · M — 32 · карточки, шапки · S — 24 · таблицы, поля ввода.
- **Варианты · Тоны** — Тон задаёт цвет иконки, а стейт-слой автоматически берёт полупрозрачный оттенок этого же цвета. Neutral — нейтральные действия, иконка --secondary (Active · Secondary, Emerald_200); Primary — акцентные (--primary); Danger — деструктивные, например удалить (--error); Contrast — для тёмных поверхностей (--text-on-dark).
- **Состояния** — Интерактивные состояния по горизонтали, размеры по вертикали. К исходной матрице Default / Hover / Disabled добавлены Pressed, Focus и Loading.Новое
- **Режим-переключательНовое** — IconButton может работать как переключатель (toggle): нажатие фиксирует состояние Selected. В выбранном состоянии иконка окрашивается в Primary и остаётся лёгкий стейт-слой; чаще всего контурная иконка заменяется на залитую. Подходит для «в избранное», «закрепить», «показать пароль». Нажмите на пример:
- **Встроенный вариант (поля и тулбары)Новое** — В полях ввода и плотных тулбарах круглый стейт-слой избыточен. Встроенный вариант (ibtn--embedded) убирает рипл: в покое иконка нейтральная, на Hover она окрашивается в Primary. Это и есть состояние «Hover (Input)». Наведите на иконку очистки:
- **С бейджемНовое** — IconButton может нести индикатор-Badge — счётчик непрочитанного или точку-индикатор. Бейдж прижимается к правому верхнему углу иконки и не перехватывает клики.
- **Использование · В тулбаре** — Типовой паттерн: ряд IconButton одного тона и размера, сгруппированный с разделителями. Деструктивное действие выделяется тоном Danger.
- **Контент** — У IconButton нет видимого текста — контент компонента это иконка и её текстовое описание:
- **Доступность** — У иконки нет видимого текста, поэтому каждому IconButton обязателен aria-label, описывающий действие, и, как правило, Tooltip по наведению. Управление с клавиатуры: Tab ставит фокус, Space / Enter активируют, фокус показывается обводкой --primary.
- **Контент · Иконография** — Иконки берутся из библиотеки ДС (24×24, заливка currentColor) и масштабируются под размер кнопки. Никаких эмодзи или юникод-символов.
- **Цвета** — Компонент использует только семантические токены. Стейт-слой — это color-mix цвета иконки (currentColor) с прозрачным: 12% на Hover, 22% на Pressed.

## Для разработчиков (выжимка)

### Точные размеры (redline)

Таблица рендерится на странице через getComputedStyle. Точные значения — в CSS-файле компонента (см. `css:` в шапке).

### Разметка · HTML (эталонная реализация ДС)

```
<!-- базовый вариант: одна иконка, aria-label обязателен -->
<button type="button" class="ibtn ibtn--neutral ibtn--m" aria-label="Редактировать">
  <svg aria-hidden="true">…</svg>          <!-- 24/20/16 px по размеру кнопки -->
</button>

<!-- toggle: aria-pressed + залитая иконка в selected -->
<button type="button" class="ibtn ibtn--primary ibtn--l ibtn--selected" aria-pressed="true" aria-label="В избранном">
  <svg aria-hidden="true">…</svg>
</button>

<!-- loading: спиннер вместо иконки, клики заблокированы -->
<button type="button" class="ibtn ibtn--neutral ibtn--m ibtn--loading" aria-busy="true" aria-label="Ещё">
  <span class="ibtn__spinner"></span>
</button>

<!-- с бейджем: Badge не перехватывает клики (pointer-events: none) -->
<button type="button" class="ibtn ibtn--neutral ibtn--l" aria-label="Сделки">
  <svg aria-hidden="true">…</svg>
  <span class="ibtn__badge"><span class="badge badge--xs badge--accent">3</span></span>
</button>
```

### Поведение · псевдокод (framework-agnostic)

```
// 1. Стейт-слой — чистый CSS, отдельного DOM-элемента нет:
//    background = color-mix(currentColor 12%, transparent) на :hover
//    background = color-mix(currentColor 22%, transparent) на :active
//    цвет рипла всегда следует за цветом иконки (тоном)

// 2. Toggle (режим-переключатель):
//    click → selected = !selected
//    aria-pressed = selected; тон neutral → primary;
//    контурная иконка заменяется на залитую; aria-label отражает состояние
// React: состав рендерится декларативно:
glyph = selected ? iconSelected : icon

// 3. Loading: иконка заменяется на .ibtn__spinner (размер = размеру иконки);
//    .ibtn--loading даёт pointer-events: none; добавить aria-busy="true"

// 4. Embedded (поля ввода): стейт-слоя нет, hover меняет цвет иконки
//    text-inactive → primary (на :active → primary-dark)

// 5. Тач-сценарии: при размерах S/M расширять зону клика до 44×44
//    невидимым псевдоэлементом, не увеличивая видимый стейт-слой

// 6. Состояния hover/pressed — чистый CSS (:hover/:active);
//    классы .is-hover/.is-pressed/.is-focus — только для спецификаций в документации
```

### IconButton.types.ts

```
type IconButtonTone = 'neutral' | 'primary' | 'danger' | 'contrast';
type IconButtonSize = 'l' | 'm' | 's';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;          // 24×24 из библиотеки ДС, заливка currentColor
  'aria-label': string;           // обязателен: у кнопки нет текста
  tone?: IconButtonTone;          // по умолчанию 'neutral'
  size?: IconButtonSize;          // по умолчанию 'm'
  shape?: 'circle' | 'square';    // по умолчанию 'circle'
  embedded?: boolean;             // вариант для полей ввода — без стейт-слоя
  selected?: boolean;             // toggle-режим → aria-pressed
  iconSelected?: React.ReactNode; // залитая иконка для selected
  loading?: boolean;              // спиннер + aria-busy, клики заблокированы
  badge?: React.ReactNode;        // Badge в правом верхнем углу
}
```

### Справочник классов и атрибутов

| Класс / атрибут | На чём | Назначение |
|---|---|---|
| .ibtn | button | Базовый класс: раскладка, круглый стейт-слой, переходы, focus-visible |
| .ibtn--neutral / --primary / --danger / --contrast | button | Тон — цвет иконки; стейт-слой следует за ним. Neutral = --secondary |
| .ibtn--l / --m / --s | button | Размер: 40 / 32 / 24 px, иконка 24 / 20 / 16 px |
| .ibtn--square | button | Квадратная форма стейт-слоя вместо круга (радиус 8 / 8 / 6) |
| .ibtn--embedded | button | Встроенный вариант (поля ввода): без стейт-слоя, hover меняет цвет |
| .ibtn--selected | button | Toggle включён: иконка primary + постоянный лёгкий стейт-слой; парой идёт aria-pressed="true" |
| .ibtn--loading | button | Загрузка: pointer-events: none, внутри .ibtn__spinner |
| disabled | button | Отключённое состояние — иконка --text-inactive, без стейт-слоя |
| .is-hover / .is-pressed / .is-focus | button | Форсированные состояния — только для спецификаций в документации, не для продакшена |
| .ibtn__spinner | span | Лоадер — кольцо currentColor размером с иконку, уважает prefers-reduced-motion |
| .ibtn__badge | span | Слот для Badge в правом верхнем углу; клики не перехватывает |
| aria-label | button | Обязателен всегда — глагол действия (см. «Контент») |
| aria-pressed | button | Только в toggle-режиме; синхронизируется с .ibtn--selected |
