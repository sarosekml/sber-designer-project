---
component: Alert
title: "Alert"
version: "v1.0"
updated: "08.07.2026"
page: pages/loading/Alert.html
page_js: scripts/alert.page.js
css: styles/alert.css
deps: [button, link]
status: curated
---

> Спека для быстрого контекста. Источник истины — CSS-файл и страница компонента. При изменении компонента обновляй эту спеку и блок в specs/_cheatsheet.md.

## Назначение
Инлайновое (встроенное в поток контента) сообщение о состоянии, привязанное к конкретному блоку интерфейса. В отличие от Toast и SnackBar не всплывает и не исчезает само — занимает место на странице и остаётся, пока не закрыт пользователем или пока не снята причина. Четыре тона (Info · Warning · Error · Success), два размера (M · S), опциональные части: иконка, заголовок, текст, кнопки, действия (свернуть / закрыть).

## Ключевые правила (из разделов страницы)
- **Использование** — контекстное состояние блока (пояснение/предупреждение), результат операции на месте, действие внутри сообщения (кнопка/ссылка). Не для мгновенных фоновых уведомлений (Toast), не для стека системных сообщений в углу (SnackBar), не для блокирующих решений (Modal). Alert — инлайн и статичен; Toast — всплывает и исчезает сам; SnackBar — стек в углу.
- **Анатомия** — тонированный контейнер + ведущая иконка (выровнена по верхней строке) + тело (заголовок · текст · кнопки, каждый опционален) + блок действий справа сверху (свернуть шеврон и/или закрыть ×).
- **Варианты** — оси: Тоны (info/warning/error/success — заливка, цвет и глиф иконки, цвет кнопок/ссылок); Состав (иконка/заголовок/текст/кнопки/действия — независимые опции); Кнопки и ссылки (одна кнопка / две / текстовая ссылка, всё в тон).
- **Размеры** — M (базовый) и S (компактный). M: паддинг 16px, зазор 12px, иконка 20px, заголовок Body M Strong, текст Body S. S: паддинг 12/14px, зазор 10px, иконка 18px, заголовок Body S Strong, текст Body XS.
- **Контент** — заголовок короткий (~40 симв., без точки), опционален; текст 1–2 предложения по делу, переносится и не усекается; кнопка — глагол действия, ссылка — навигация; тон и текст согласованы (Error объясняет причину и шаг, Success подтверждает).
- **Поведение** — Закрытие (× убирает Алерт, необратимо в сессии; важное сообщение — без крестика); Сворачивание (шеврон сворачивает до строки заголовка, aria-expanded); Позиция в потоке (полная ширина контейнера, раздвигает контент, стек с зазором, не вкладываются); Анимация (раскрытие/сворачивание по высоте + fade 150–200мс ease-out; reduced-motion → только opacity).
- **Состояния** — сам Алерт статичен, не реагирует на курсор; интерактивны только действия/кнопки/ссылки. Иконка-действие: Default (Text_Inactive), Hover (Text_Secondary + подложка в тон 12%), Active (акцент тона), Focus (2px обводка тона).
- **Доступность** — role/aria-live по тону: Error·Warning → alert/assertive, Info·Success → status/polite. Иконка тона aria-hidden. Кнопки действий с aria-label; шеврон с aria-expanded. Не перехватывает Esc (не модальный).
- **Типографика** — заголовок --type-body-m-strong (M) / --type-body-s-strong (S); текст --type-body-s (M) / --type-body-xs (S); кнопка --type-button-xs; ссылка --type-body-s.
- **Цвета** — пара «заливка + акцент» из группы Situative. info: --info-bg + --info; warning: --warning-bg + --warning; error: --error-bg-light + --error; success: --success-bg + --success. Заголовок Text_Black, текст Text_Secondary, действия Text_Inactive. Кнопки/ссылки внутри перекрашиваются в акцент через переопределение --primary/--link на .alert.

## Для разработчиков (выжимка)

### Точные размеры (redline)
Таблица рендерится на странице через getComputedStyle с реального экземпляра. Значения — токены ДС из styles/alert.css, не хардкод.

| Параметр | M | S | Токен |
|---|---|---|---|
| Паддинг верт. | 16px | 12px | --alert-pad |
| Паддинг гор. | 16px | 14px | --alert-pad |
| Зазор иконка↔тело | 12px | 10px | --alert-gap |
| Размер иконки | 20px | 18px | --alert-icon |
| Кнопка-действие | 24px | 22px | .alert__act |
| Радиус | 8px | 8px | --radius-m |

### Разметка · HTML (эталонная реализация ДС)

```
<!-- тон: --info | --warning | --error | --success; размер: --m | --s -->
<div class="alert alert--info alert--m" role="status" aria-live="polite">
  <span class="alert__icon" aria-hidden="true"><i data-icon="Info-circle-filled"></i></span>
  <div class="alert__body">
    <p class="alert__title">Заголовок компонента</p>
    <p class="alert__text">Добавление холдинга в разработке…</p>
    <div class="alert__buttons">
      <button class="btn btn--outline btn--xs"><span class="btn__label">Завести сделку</span></button>
    </div>
  </div>
  <div class="alert__actions">
    <button class="alert__act alert__collapse" aria-label="Свернуть" aria-expanded="true"><i data-icon="chevron-up"></i></button>
    <button class="alert__act alert__close" aria-label="Закрыть"><i data-icon="close"></i></button>
  </div>
</div>
```

Глифы иконки по тону: info → `Info-circle-filled`, warning → `alert-triangle-filled`, error → `alert-circle-filled`, success → `check-circle-filled`.

### Поведение · псевдокод (framework-agnostic)

```
// role/aria-live — по тону
a11y(tone) = (tone in ['error','warning'])
  ? { role:'alert',  live:'assertive' }
  : { role:'status', live:'polite' }

// Сворачивание: скрыть text+buttons, повернуть шеврон, обновить aria-expanded
toggleCollapse(alert):
  alert.classList.toggle('alert--collapsed')
  chevron['aria-expanded'] = String(!collapsed)
  animateHeight(body)            // 150мс ease-out; reduced-motion → opacity

// Закрытие: высота→0 + fade, затем remove; вернуть — только при новой причине
dismiss(alert): animateOut(alert, () => alert.remove())
```

### Alert.types.ts

```
type AlertTone = 'info' | 'warning' | 'error' | 'success';
type AlertSize = 'm' | 's';

interface AlertAction {
  label: string;
  onClick(): void;
  variant?: 'outline' | 'transparent' | 'link';  // по умолчанию outline
}

interface AlertProps {
  tone?: AlertTone;              // по умолчанию 'info'
  size?: AlertSize;              // по умолчанию 'm'
  title?: string;               // опционален
  children?: React.ReactNode;   // текст, опционален
  icon?: boolean;               // показать иконку тона, по умолчанию true
  actions?: AlertAction[];      // 0–2 кнопки/ссылки
  collapsible?: boolean;        // показать шеврон свернуть
  onDismiss?(): void;           // задан → показать крестик
}
```

### Справочник классов и атрибутов

| Класс / атрибут | На чём | Назначение |
|---|---|---|
| `.alert` | контейнер | Корень; переопределяет --primary*/--link для кнопок/ссылок в тон |
| `.alert--info/--warning/--error/--success` | контейнер | Тон: заливка, акцент, глиф иконки, цвет кнопок |
| `.alert--m/--s` | контейнер | Размер: паддинги, зазор, иконка, токены текста |
| `.alert--collapsed` | контейнер | Свёрнуто: скрывает текст и кнопки, поворачивает шеврон |
| `.alert__icon` | span | Ведущая иконка тона; aria-hidden |
| `.alert__body` | div | Колонка: заголовок · текст · кнопки |
| `.alert__title` | p | Заголовок (Alert_Title), опционален |
| `.alert__text` | p | Текст (Alert_Text), переносится, не усекается |
| `.alert__buttons` | div | Ряд кнопок/ссылок (Button XS / Link), в тон |
| `.alert__actions` | div | Блок действий справа сверху |
| `.alert__act` | button | Иконка-действие; обязателен aria-label |
| `.alert__collapse / .alert__close` | button | Свернуть (aria-expanded) / закрыть |
| `[role][aria-live]` | контейнер | alert/assertive для Error·Warning, status/polite для Info·Success |
