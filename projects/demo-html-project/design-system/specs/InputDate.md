---
component: InputDate
title: "InputDate"
version: "v1.1"
updated: "09.07.2026"
page: pages/molecules/InputDate.html
page_js: scripts/input-date.page.js
css: styles/input.css
deps: [label-helper, tooltip]
status: curated
---

> Спека для быстрого контекста. Источник истины — styles/input.css и страница. При изменении обновляй эту спеку и блок в specs/_cheatsheet.md.

## Назначение
Поле ввода даты: маска ММ.ДД.ГГГГ (в placeholder) + кнопка-календарь, поднимающая DatePicker (отдельный компонент, TBD). База `.inp` общая с InputText — состояния и размеры общие.

## Ключевые правила (из разделов страницы)
- **Использование** — ввод конкретной даты (подписание, транш, план); редактирование даты в ячейке — размер S. Диапазон — два InputDate «От»/«До». Текст → InputText; справочник → InputAutocomplete.
- **Анатомия** — Label · поле (значение/маска + действия: информер опц. · крестик очистки · календарь) · Helper. Порядок слева направо: информер → крестик → календарь; информер всегда левее крестика; календарь всегда последний.
- **Варианты** — С хелпером/без · Информер (опц., по умолчанию нет) · Table Edit (размер S, с иконкой поиска слева, без label/helper).
- **Размеры** — M (40px, Body M) — основной; S (32px, Body S) — только Table Edit. Ширину задаёт контейнер.
- **Контент** — маска ММ.ДД.ГГГГ (шаблон единый на экране); пустое поле показывает маску как плейсхолдер; метка-существительное; хелпер = правило (в Error → ошибка).
- **Поведение** — вводятся только цифры, точки-разделители автоматически; Backspace удаляет цифру с разделителем; DatePicker открывается при фокусе и по кнопке-календарю; выбор даты пишет значение и закрывает.
- **Состояния** — Default/Hover/Focus/Error/ErrorFocus/Warning/WarningFocus/Disabled. Тултип ошибки/предупреждения — в *Focus.
- **Доступность** — `label[for]`, `aria-describedby`, `aria-invalid`; кнопка-календарь — button с aria-label и `aria-haspopup="dialog"`; дата вводима с клавиатуры без календаря; `inputmode="numeric"`.
- **Типографика** — значение SB Sans Text с табличными цифрами (M — Body M, S — Body S); Label/Helper — Body XS.
- **Цвета** — токены совпадают с InputText: рамка `--border-primary`, фокус `--primary`, Error `--error`, Warning `--warning`, маска-плейсхолдер `--text-inactive`.

## Для разработчиков (выжимка)

### Точные размеры (redline)
Рендерится на странице через getComputedStyle. Источник — styles/input.css. M: 40px / паддинг 12px / gap 8px / иконки 20px. S: 32px / 10px / 6px / 18px.

### Разметка · HTML (эталонная реализация ДС)

```
<div class="inp inp--m">
  <label class="ds-label ds-label--left" for="d1"><span class="ds-label__text">Дата подписания</span></label>
  <div class="inp__field">
    <input class="inp__control" id="d1" placeholder="ММ.ДД.ГГГГ" inputmode="numeric">
    <span class="inp__acts">
      <button class="inp__act" aria-label="Очистить поле">…✕…</button>
      <button class="inp__act" aria-label="Открыть календарь" aria-haspopup="dialog">…📅…</button>
    </span>
  </div>
  <span class="ds-helper ds-helper--left">Helper</span>
</div>
```

### Поведение · псевдокод (framework-agnostic)
```
// маска: пропускать цифры; после 2-го и 4-го знака вставлять '.'; Backspace удаляет цифру+разделитель
// blur: валидировать существование даты и min/max → иначе status='error'
// DatePicker: открыть при фокусе/по кнопке; выбор → значение, закрыть, фокус в поле
// крестик — только у заполненного поля; клик → пусто + фокус
```

### Справочник классов и атрибутов

| Класс/атрибут | Назначение |
|---|---|
| `.inp / --m / --s / --error / --warning / --disabled` | база — общая с InputText |
| `.inp__act[aria-label="Открыть календарь"]` | кнопка-календарь, всегда последняя |
| `input[inputmode="numeric"]` | цифровая клавиатура; маска в placeholder |
| `aria-haspopup="dialog"` / `aria-expanded` | связь с DatePicker |
