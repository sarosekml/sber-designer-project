---
component: SnackBar
title: "SnackBar"
version: "v1.0"
updated: "08.07.2026"
page: pages/organisms/SnackBar.html
css: styles/snackbar.css
deps: [button, link]
status: auto
---

> Автоспека для быстрого контекста. Источник истины — CSS-файл и страница компонента. При изменении компонента обновляй эту спеку.

## Назначение
Стек всплывающих уведомлений в правом верхнем углу экрана, поверх всех слоёв (z-index 9900 — выше Modal 900 и ToastBar 800, ниже ToastLoader 9999). Четыре тона: Info · Warning · Error · Success. Каждый снек: иконка тона + заголовок + опциональный текст + опциональные кнопки/ссылка + кнопка закрытия.

## Ключевые правила

- **Размещение** — fixed, top/right 24px, z-index 9900. Новый снек добавляется сверху стека.
- **Ширина** — фиксированная 320px (.snackbar-layer). Снек заполняет контейнер (width: 100%).
- **Авто-скрытие** — снек без кнопок: 5 с; снек с кнопками: до ручного закрытия. Hover/focus — пауза таймера.
- **Поведение · Переполнение** — видимых ≤ 5; при превышении старые скрываются за overflow-плашкой «+N уведомл.» с кнопками «развернуть» и «закрыть все».
- **Дедупликация** — одинаковые снеки (тон+заголовок+текст) схлопываются в один со счётчиком ×N в заголовке; повторный показ перезапускает таймер.
- **Esc** — закрывает верхний снек стека.
- **Кнопки** — переиспользуют Button xs из ДС; перекраска через переопределение --primary в контексте .snack__buttons.
- **Ссылки** — Link из ДС; перекраска через --link-fg / --link-fg-hover.
- **Слои** — ToastBar < Modal < SnackBar < ToastLoader. Описано в specs/Toast.md.

## Токены

| Тон     | Фон                | Иконка / close / кнопки | Hover       |
|---|---|---|---|
| Info    | --info-bg          | --info                  | --info-dark    |
| Warning | --warning-bg       | --warning               | --warning-dark |
| Error   | --error-bg-light   | --error                 | --error-dark   |
| Success | --success-bg       | --success               | --success-dark |

- Заголовок: `--type-body-s` (400), `--text-primary`
- Текст: `--type-body-xs`, `--text-secondary`
- Border-radius: `--radius-card` (→ --radius-2xl → 16px)
- Shadow: `--elevation-2`

## Для разработчиков (выжимка)

### Разметка · HTML

```html
<div class="snackbar-layer" aria-label="Уведомления">
  <div class="snack snack--error" role="alert" aria-live="assertive">
    <span class="snack__icon" aria-hidden="true"><svg…></svg></span>
    <div class="snack__body">
      <div class="snack__title">Ошибка <span class="snack__dupe">×2</span></div>
      <div class="snack__text">Плановая дата просрочена.</div>
      <div class="snack__buttons">
        <button type="button" class="btn btn--outline btn--xs">
          <span class="btn__label">Изменить сроки</span>
        </button>
      </div>
    </div>
    <button type="button" class="snack__close" aria-label="Закрыть"><svg…></svg></button>
  </div>
  <!-- overflow при > 5 -->
  <div class="snack-more">
    Ещё <span class="snack-more__count">3</span> уведомл.
    <div class="snack-more__actions">
      <button class="snack-more__btn" aria-label="Развернуть"><svg…></svg></button>
      <button class="snack-more__btn" aria-label="Закрыть все"><svg…></svg></button>
    </div>
  </div>
</div>
```

### React API (предложение)

```typescript
type SnackTone = 'info' | 'warning' | 'error' | 'success';
interface SnackOptions {
  tone: SnackTone;
  title: string;
  text?: string;
  buttons?: React.ReactNode;
  dedup?: boolean; // default true
}
interface SnackbarController {
  show(opts: SnackOptions): string;
  dismiss(id: string): void;
  dismissAll(): void;
}
// const { show } = useSnackbar();
```

### Справочник классов

| Класс / атрибут | На чём | Назначение |
|---|---|---|
| .snackbar-layer | div | fixed-контейнер, z-9900, 320px, top/right 24px |
| .snack | div | Карточка, grid 3-col, анимация snack-in |
| .snack--info/warning/error/success | div | Тон: фон + цвета элементов |
| .snack--leave | div | Триггер анимации ухода; удалить по animationend |
| .snack__icon | span | 20px, aria-hidden |
| .snack__body | div | flex-col, gap 4px |
| .snack__title | div | Body S 400, --text-primary |
| .snack__dupe | span | Счётчик ×N, встраивается в конец .snack__title |
| .snack__text | div | Body XS, --text-secondary; опционален |
| .snack__buttons | div | Переопределяет --primary/--link-fg в тон |
| .snack__close | button | aria-label="Закрыть" обязателен |
| .snack-more | div | Overflow-плашка "+N уведомл." |
| role="alert" | snack | error/warning → assertive |
| role="status" | snack | info/success → polite |
