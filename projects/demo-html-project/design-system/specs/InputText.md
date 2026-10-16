---
component: InputText
title: "InputText"
version: "v1.1"
updated: "09.07.2026"
page: pages/molecules/InputText.html
page_js: scripts/input-text.page.js
css: styles/input.css
deps: [label-helper, tooltip, chip]
status: curated
---

> Спека для быстрого контекста. Источник истины — styles/input.css и страница. При изменении компонента обновляй эту спеку и блок в specs/_cheatsheet.md.

## Назначение
Базовое поле ввода произвольного текста. Собирается из компонентов подкачки LabelHelper (метка + хелпер) и Input_Content (поле с рамкой: текстовый слой + действия). База `.inp` общая для InputText / InputDate / InputAutocomplete. На той же основе — числовой InputAmount.

## Ключевые правила (из разделов страницы)
- **Использование** — свободный текст (наименование, комментарий, реквизит); числа — InputAmount; редактирование в ячейке — размер S (Table Edit). Выбор из справочника → InputAutocomplete/Select; дата → InputDate; показ без ввода → ReadOnlyField.
- **Анатомия** — Label · поле Input_Content (иконка поиска `.inp__lead` · префикс · `input.inp__control` · постфикс · действия `.inp__acts`) · Helper. Всё кроме поля опционально. Порядок действий слева направо: информер → крестик очистки (информер всегда левее крестика).
- **Варианты** — Текстовый слой (префикс/постфикс/поиск/информер) · Многострочный (`--multiline`, textarea) · InputAmount (числовой) · Table Edit (размер S, без label/helper).
- **Размеры** — M (высота 40px, текст Body M) — основной; S (32px, Body S) — только Table Edit. Ширину задаёт контейнер.
- **Контент** — метка-существительное без двоеточия; плейсхолдер = формат/пример, не дублирует метку; хелпер = правило (в Error → текст ошибки); префикс/постфикс — неизменяемые единицы.
- **Поведение** — плейсхолдер исчезает при вводе (не при фокусе); крестик только у заполненного поля; очищенное поле по blur возвращается в пустое; многострочный растёт по высоте.
- **Состояния** — Default/Hover/Focus/Error/ErrorFocus/Warning/WarningFocus/Disabled. Тултип ошибки/предупреждения — в *Focus.
- **Доступность** — `label[for]`, `aria-describedby`, `aria-invalid="true"`; ошибка не только цветом; крестик — button с aria-label.
- **Типографика** — значение SB Sans Text (M — Body M, S — Body S); Label/Helper — Body XS.
- **Цвета** — фон `--bg-tile`, рамка `--border-primary`, hover/focus `--primary` (+ тень `--primary-bg-light`), Error `--error`, Warning `--warning`, disabled `--st-disabled-light`, плейсхолдер/префикс/постфикс `--text-inactive`.

## Для разработчиков (выжимка)

### Точные размеры (redline)
Таблица рендерится на странице через getComputedStyle с живого экземпляра. Источник — styles/input.css. M: высота 40px, паддинг 12px, gap 8px, радиус `--radius-field`, иконки 20px. S: 32px / 10px / 6px / иконки 18px.

### Разметка · HTML (эталонная реализация ДС)

```
<div class="inp inp--m">
  <label class="ds-label ds-label--left" for="inn"><span class="ds-label__text">ИНН</span></label>
  <div class="inp__field">
    <span class="inp__lead">…search…</span>
    <span class="inp__prefix">От</span>
    <input class="inp__control" id="inn" aria-describedby="inn-h">
    <span class="inp__postfix">₽</span>
    <span class="inp__acts">
      <button class="inp__act" aria-label="Очистить поле">…✕…</button>
      <button class="inp__act inp__act--static" aria-label="Подсказка">…ⓘ…</button>
    </span>
  </div>
  <span class="ds-helper ds-helper--left" id="inn-h">10 или 12 цифр</span>
</div>
```

### Поведение · псевдокод (framework-agnostic)
```
// крестик очистки — только когда поле непустое; клик → очистить + фокус + onChange('')
// плейсхолдер исчезает при вводе; очищенное по blur → пустое состояние
// Error/Warning: тултип с текстом при фокусе поля, скрыть по blur
// InputAmount: фильтр [0-9.,-]; '.'→','; группировка целой части по 3; на blur обрезать нули/децималы
// многострочный: авторост textarea по scrollHeight до max, затем внутренний скролл
```

### Справочник классов и атрибутов

| Класс/атрибут | Назначение |
|---|---|
| `.inp` | корень: метка + поле + хелпер; ширина от контейнера |
| `.inp--m` / `.inp--s` | размер 40px / 32px (S — только Table Edit) |
| `.inp--error` / `--warning` / `--disabled` | статусы |
| `.inp--multiline` | многострочный (textarea) |
| `.is-hover` / `.is-focus` / `.is-open` | форсированные состояния |
| `.inp__field` | Input_Content: рамка, радиус, фон, flex-строка |
| `.inp__lead` | иконка поиска |
| `.inp__prefix` / `.inp__postfix` | неизменяемые части значения |
| `.inp__control` | нативный input/textarea; placeholder, id, aria-* |
| `.inp__acts` / `.inp__act` | группа действий / действие-иконка; `--static` — информер |
| `.ds-label` / `.ds-helper` | метка и хелпер (LabelHelper) |
