---
component: Entity
title: "Entity"
version: "v1.0"
updated: "08.07.2026"
page: pages/organisms/Entity.html
css: styles/entity.css
deps: [avatar, chip, icon-button, button, badge]
status: manual
---

> Компонент для отображения объектов (компании, люди, файлы, метрики) в тайлах, списках и формах. Композитный. Собственного фона нет.

## Назначение
Универсальное представление объекта: ведущий элемент (иконка / аватар / чекбокс / грип) + текстовый блок (Header · строка Label · Subheaders) + опциональные Chips, группа IconButton и блок действий. Тянется на всю ширину контейнера, выравнивается по левому краю, наследует фон.

## Размеры
Три размера по величине ведущего элемента; типографика и зазоры масштабируются вместе.

| Параметр | S · 32 | M · 40 | L · 96 |
|---|---|---|---|
| Ведущий | 32px | 40px | 96px |
| Радиус иконки | 10px `--radius-l` | 12px `--radius-xl` | 28px `--radius-5xl` |
| Глиф | 18px | 22px | 48px |
| Header | Body XS · 12 | Body XS · 12 | Body S · 14 |
| Label | Body S Strong · 14 | Body M Strong · 16 | Body XL Strong · 24 |
| Subheaders | Body XS · 12 | Body S · 14 | Body M · 16 |
| Зазор ведущий↔контент | 10px | 12px | 16px |
| Зазор Header↔Label | 2px | 2px | 3px |
| Зазор блоков | 5px | 6px | 8px |

## Ключевые правила
- **Выравнивание** — ведущий и контент по центру по вертикали; блок действий по верху (align-self flex-start).
- **Фон** — собственного нет; наследует контейнер.
- **Контент · Label** — усечение в одну строку (`.entity__label--truncate`), полное значение в Tooltip. Не переносить в 3+ строки.
- **Subheaders** (EntitySubtitleGroup) — icon + список, клэмп до 2 строк (single → 1), остаток в счётчик `+N` (max +99). Счётчик считается по данным, не по факту переполнения.
- **Действия** (EntityActions) — максимум 2; больше → кебаб-меню. Порядок кнопок = порядку в заголовке страницы.
- **Ведущая иконка/аватар** — декоративны, `aria-hidden`; смысл несёт Label.
- Вложенные подкомпоненты (EntityTextMaster, EntitySubtitleGroup, EntityIconButtonGroup, EntityActions) — только в ДС дизайнеров, отдельно не публикуются.

## Состояния
- `.entity--interactive` — кликабельный тайл: hover-фон `--bgtable-row-hover`, фокус-обводка.
- `.entity--selected` — выбран, фон `--primary-bg`.
- `.entity--selectable` — реальный чекбокс в `.entity__lead` (множественный выбор).
- `.entity--skeleton` — загрузка: плейсхолдеры `.sk-line` + шиммер, `aria-busy`; шиммер выключается при reduced-motion.
- `.entity--empty` — нет данных: Label = «—», цвет inactive.
- `.entity--error` — объект удалён: иконка в тоне error, Label зачёркнут, Header в тоне error.
- Drag-handle — `.entity__drag` (drag-dots) в начале строки.

## Токены (цвета)
- Label `--text-black` · счётчик +N `--text-primary` · Subheaders `--text-secondary` · Header/постфикс/«—» `--text-inactive`.
- Иконка (default): фон `--c-swamp-100`, глиф `--text-on-tertiary`. Тон accent: `--primary` 14% / `--primary-dark`. Тон neutral: `--c-cgrey-100` / `--text-secondary`.
- Интерактив: hover `--bgtable-row-hover`, selected `--primary-bg`, закладка active/фокус `--primary`.
- Ошибка: фон иконки `--error-bg-light`, иконка/Header `--error`.

## Для разработчиков (выжимка)

### Анатомия DOM
```html
<div class="entity entity--m">
  <div class="entity__lead"><span class="entity__icon" aria-hidden="true"><svg…></svg></span></div>
  <div class="entity__main">
    <div class="entity__titles">
      <p class="entity__header">Header</p>
      <div class="entity__labelrow">
        <span class="entity__prefix-icon"><svg…></svg></span>
        <span class="entity__prefix">Pref</span>
        <span class="entity__label entity__label--truncate">Text Label</span>
        <span class="entity__postfix">Postf</span>
        <button class="entity__bookmark" aria-label="В избранное"><svg…></svg></button>
      </div>
    </div>
    <div class="entity__subs">
      <span class="entity__subs-icon"><svg…></svg></span>
      <span class="entity__subs-list">Subheader, Subheader, Subheader</span>
      <span class="entity__subs-more">+99</span>
    </div>
    <div class="entity__chips">…Chip readonly S…</div>
    <div class="entity__icons"><button class="ibtn ibtn--neutral ibtn--s" aria-label="Позвонить"><svg…></svg></button></div>
  </div>
  <div class="entity__actions">
    <button class="btn btn--outline btn--xs" aria-haspopup="menu">…</button>
    <button class="ibtn ibtn--neutral ibtn--s" aria-label="Убрать"><svg…></svg></button>
  </div>
</div>
```

### React API (предложение)
```typescript
type EntitySize = 's' | 'm' | 'l';
type EntityState = 'default' | 'selected' | 'loading' | 'empty' | 'error';
interface EntityProps {
  size?: EntitySize; state?: EntityState;
  lead?: { kind: 'icon'|'avatar'|'checkbox'|'none'; glyph?: string; tone?: 'default'|'accent'|'neutral'; avatar?: AvatarProps };
  header?: string;
  prefix?: { icon?: string; text?: string };
  label: React.ReactNode; postfix?: string; truncate?: boolean;
  bookmark?: { active: boolean; onToggle(): void };
  subheaders?: string[]; chips?: React.ReactNode; icons?: EntityAction[];
  actions?: EntityAction[]; // max 2
  interactive?: boolean; selected?: boolean; onSelect?(): void; draggable?: boolean;
}
```

### Справочник классов
| Класс / атрибут | На чём | Назначение |
|---|---|---|
| .entity | div | Корень: flex, align-items center, width 100%, без фона |
| .entity--s/--m/--l | .entity | Размер 32/40/96; токены --e-* |
| .entity--inline | .entity | inline-flex, ширина по контенту |
| .entity__lead | div | Ведущий слот |
| .entity__icon | span | Скруглённый контейнер; тон --accent/--neutral |
| .entity__main | div | flex-колонка контента, min-width 0 |
| .entity__titles | div | Header + строка Label |
| .entity__header | p | Надзаголовок Body XS inactive |
| .entity__labelrow | div | prefix · label · postfix · bookmark (baseline) |
| .entity__label | span | Основной текст *-strong --text-black |
| .entity__label--truncate | .entity__label | Усечение + Tooltip |
| .entity__prefix / __postfix | span | Серые аффиксы |
| .entity__bookmark | button | Избранное; --active = primary |
| .entity__subs | div | EntitySubtitleGroup; клэмп 2 строки |
| .entity__subs--single | .entity__subs | Клэмп 1 строка |
| .entity__subs-more | span | Счётчик +N (max +99) |
| .entity__chips | div | Обёртка ChipList |
| .entity__icons | div | EntityIconButtonGroup (IconButton S) |
| .entity__actions | div | EntityActions: до 2 кнопок + закрытие; align-self start |
| .entity__drag | button | Грип переупорядочивания |
| .entity--interactive | .entity | Кликабельный тайл |
| .entity--selected | .entity | Выбран, фон --primary-bg |
| .entity--skeleton | .entity | Загрузка + шиммер, aria-busy |
| .entity--empty | .entity | Нет данных, Label «—» |
| .entity--error | .entity | Объект удалён, Label зачёркнут |
