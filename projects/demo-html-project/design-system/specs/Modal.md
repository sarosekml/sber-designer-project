---
component: Modal
title: "Modal"
version: "v1.0"
updated: "08.07.2026"
page: pages/organisms/Modal.html
page_js: scripts/modal.page.js
css: styles/modal.css
deps: [button, icon-button, label-helper, checkbox]
status: curated
---

> Спека для быстрого контекста. Источник истины — CSS-файл и страница компонента. При изменении компонента обновляй эту спеку и блок в specs/_cheatsheet.md.

## Назначение
Modal — не компонент в привычном смысле, а свод правил построения модальных форм. Обязательны две части с фиксированной анатомией: шапка Modal_Top (заголовок + крестик) и подвал Modal_Bottom (опциональные кнопки слева, кнопки действий справа). Между ними — Modal_Body: единственная гибкая и прокручиваемая зона, которая может содержать что угодно (форму, таблицу, пустое состояние) и не диктует свою разметку.

## Ключевые правила (из разделов страницы)
- **Использование** — Модалка прерывает сценарий для решения/ввода данных, не уводя со страницы. Подвал справа: Primary (Accent) отображается всегда — глагол действия, либо «Закрыть» для форм на просмотр; Secondary (Transparent) опционален — альтернативное действие. Подвал слева опционален: «Изменить» — форма в режиме просмотра; «Удалить» — форма в режиме редактирования существующей сущности. Все левые+правые кнопки одновременно не используются — Изменить/Удалить принадлежат разным режимам одной формы.
- **Анатомия** — Modal_Top (заголовок Body H5 Strong до 2 строк без обрезки + IconButton Neutral M крестик, обязателен всегда) → Modal_Body (flex:1, своя прокрутка) → Modal_Bottom (Modal_Bottom_Left опционально, Modal_Bottom_Right — Primary обязателен).
- **Размеры** — 12 фиксированных шагов ширины (--modal-w-1…12, 140–1820px, шаг ≈150px). Практический диапазон — шаги 3–9; 1–2 только для короткого confirm-диалога, 10–12 — редкий кейс широкой формы с таблицей. Высота не фиксирована, растёт по контенту до calc(100vh − 48px), дальше скроллится только Modal_Body. На узких вьюпортах модалка ограничена calc(100vw − 48px) независимо от выбранного шага.
- **Контент** — Modal_Body не диктует состав: форма, таблица, пустое состояние — что угодно. Требование одно — контент прокручивается сам, шапка и подвал остаются закреплёнными. Ошибка валидации внутри контента не закрывает модалку и не убирает подвал — сообщение несёт Helper конкретного поля (role="alert").
- **Состояния** — Закрытие: крестик, Esc, клик по скриму — все три способа равнозначны по умолчанию. Исключение (guarded): форма с несохранённым вводом игнорирует клик по скриму — доступны только крестик и Esc, чтобы случайный клик не стёр данные. Дополнительно: загрузка контента (скелетон-шиммер при открытии), сохранение (Primary → .btn--loading, тело приглушено и не интерактивно — оборачивать поля в `<fieldset disabled>`), тень у шапки/подвала при прокрутке тела (класс .is-scrolled, наблюдать scrollTop), диалог подтверждения удаления — вложенный modal-scrim--nested (role="alertdialog", ширина 2–4 шаг шкалы, Primary в тоне .btn--danger — новый модификатор Button, не только Modal).
- **Использование · Рекомендации** — Модалка — прерывание, а не страница. Вложенность ограничена одним confirm/alert поверх модалки; для многошаговых сценариев — Tab внутри модалки или отдельная страница. Крестик обязателен всегда, даже если внизу уже есть кнопка «Закрыть».
- **Доступность** — role="dialog" (confirm — role="alertdialog"), aria-modal="true", aria-labelledby на заголовок. Фокус при открытии — на первый интерактивный элемент тела (или крестик, если тело пустое), заперт внутри (focus trap), Esc закрывает и возвращает фокус на элемент-инициатор. Контент страницы за скримом получает aria-hidden/inert, пока модалка открыта.
- **Цвета** — Только семантические токены. Скрим — --modal-scrim (color-mix поверх --st-grey 48%, конвенция как у --toast-scrim). Тень — именованный --shadow-modal-form, не собственный rgba(). Диалог подтверждения — токены Error через новый модификатор .btn--danger.

## Для разработчиков (выжимка)

### Точные размеры (redline)
Таблица рендерится на странице через getComputedStyle. Точные значения — в CSS-файле компонента (см. `css:` в шапке): радиус модалки, паддинги шапки/тела/подвала (Y/X), зазор между кнопками подвала, толщина разделителя, типографика заголовка.

### Разметка · HTML (эталонная реализация ДС)

```
<div class="modal-scrim">
  <div class="modal modal--w6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <header class="modal__head">
      <h2 class="modal__title" id="modal-title">Новая сделка</h2>
      <button type="button" class="ibtn ibtn--neutral ibtn--m" aria-label="Закрыть"><svg…></svg></button>
    </header>
    <div class="modal__body">…любой контент…</div>
    <footer class="modal__foot">
      <div class="modal__foot-left">
        <button class="btn btn--transparent btn--s"><svg…></svg>Изменить</button>
      </div>
      <div class="modal__foot-right">
        <button class="btn btn--transparent btn--m">Очистить фильтр</button>
        <button class="btn btn--accent btn--m">Сохранить</button>
      </div>
    </footer>
  </div>
</div>

<!-- диалог подтверждения — вложенный поверх открытой модалки -->
<div class="modal-scrim modal-scrim--nested">
  <div class="modal modal--w3" role="alertdialog" aria-modal="true">
    …заголовок + сообщение + <button class="btn btn--accent btn--m btn--danger">Удалить</button>
  </div>
</div>
```

### Поведение · псевдокод (framework-agnostic)

```
// 1. Открытие: смонтировать .modal-scrim в конец body (портал), запомнить activeElement
//    для возврата фокуса; фокус → первый интерактивный элемент body (иначе крестик);
//    контенту страницы за скримом — aria-hidden/inert

// 2. Focus trap: Tab/Shift+Tab зациклены на границах фокусируемых элементов модалки

// 3. Закрытие:
isDirty = форма содержит несохранённый ввод (guarded)
onScrimClick(): if (!isDirty) close()   // guarded — клик по скриму игнорируется
onEsc(): if (topLayer === nestedDialog) closeNestedDialog(); else close()

// 4. Тень у шапки/подвала — по scrollTop контентной зоны:
onBodyScroll():
  head.classList.toggle('is-scrolled', body.scrollTop > 0)
  foot.classList.toggle('is-scrolled', body.scrollTop + body.clientHeight < body.scrollHeight - 1)

// 5. Сохранение: Primary → .btn--loading + aria-busy; поля — <fieldset disabled>,
//    не просто визуальное затемнение

// 6. Удаление — не прямое действие: открывает вложенный modal-scrim--nested
//    (role="alertdialog", ширина 2–4 шаг, Primary — .btn--danger)

// 7. Закрытие: unmount .modal-scrim, вернуть фокус на activeElement, снять aria-hidden/inert
```

### Modal.types.ts

```
type ModalWidthStep = 1|2|3|4|5|6|7|8|9|10|11|12;

interface ModalFooterAction { label: string; onClick(): void; loading?: boolean; disabled?: boolean; }

interface ModalProps {
  open: boolean;
  onClose(): void;
  title: string;
  widthStep?: ModalWidthStep;          // по умолчанию 6 (900px)
  children: React.ReactNode;           // Modal_Body — произвольный контент
  primaryAction: ModalFooterAction;    // обязателен — правый Primary
  secondaryAction?: ModalFooterAction; // правый Secondary
  onEdit?(): void;                     // левая «Изменить»; исключает onDelete
  onDelete?(): void;                   // левая «Удалить»; открывает confirm сама
  isDirty?: boolean;                   // guarded — блокирует закрытие по клику на скрим
  role?: 'dialog' | 'alertdialog';     // alertdialog — для confirm/danger
}
```

### Справочник классов и атрибутов

| Класс/атрибут | Назначение |
|---|---|
| `.modal-scrim` | Оверлей на весь вьюпорт, центрирует модалку, гасит фон |
| `.modal-scrim--nested` | Вложенный слой (confirm/alert) поверх уже открытой модалки |
| `.modal-scrim--inline` | Встраивание превью в статичный контейнер (документация/канвас) вместо fixed |
| `.modal` | Контейнер: фон, радиус 24px (--radius-modal), тень (--shadow-modal-form), flex-колонка |
| `.modal--w1 … --w12` | Ширина — 12 шагов шкалы (140–1820px) |
| `.modal--saving` | Тело приглушено и не интерактивно на время сохранения |
| `.modal__head` / `.modal__foot` | Фиксированные зоны; разделитель всегда виден, тень — при `.is-scrolled` |
| `.modal__title` | Заголовок — Body H5 Strong, до 2 строк, не обрезается |
| `.modal__close` | Обёртка крестика (кнопка — `.ibtn.ibtn--neutral.ibtn--m`) |
| `.modal__body` | Единственная гибкая/прокручиваемая зона |
| `.modal__body--flush` | Без внутреннего паддинга — контент сам управляет отступами |
| `.modal__skeleton` | Loading-плейсхолдер (шиммер, приём как у ReadOnlyField) |
| `.modal__foot-left` / `-right` | Опциональные (Изменить/Удалить) / обязательные (Secondary/Primary) действия |
| `.btn--danger` | Модификатор Button (не только Modal) — Primary в диалоге подтверждения удаления |
| `role="dialog"` / `alertdialog` | Обычная модалка / диалог подтверждения |
| `aria-modal`, `aria-labelledby` | Связь с заголовком, исключение фона из дерева доступности |
