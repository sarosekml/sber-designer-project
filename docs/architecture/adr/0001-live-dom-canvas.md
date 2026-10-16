---
id: ADR-0001
title: Live-DOM canvas
status: Accepted
date: 2026-05-07
scope: canvas architecture and source of truth
---

# ADR-0001: Live-DOM canvas (iframe + DOM overlay), а не векторный Skia

- **Дата:** 2026-05-07
- **Статус:** Accepted
- **Контекст:** Phase 0, выбор фундаментальной архитектуры редактора.

## Контекст

Существуют два конкурирующих подхода к «визуальному редактору UI»:

1. **Векторный canvas** (Skia / Canvas2D / WebGL). Подход openpencil, open-pencil, Figma.
   Источник истины — документ-сцена. Код генерируется отдельным шагом codegen.
2. **Live-DOM canvas** — рендерим реальный React-app внутри `<iframe>` из
   песочницы с dev-сервером, поверх — оверлей с handles. Подход Builder.io
   Fusion, v0 (preview-режим), Plasmic.
   Источник истины — AST файлов в репо.

Продуктовая цель — собирать страницы из **существующих компонентов** репозитория
(IBP UI Kit, MUI, Emotion и т.д.). Ground-truth-репо — `ibp-ui-kit`, который
строится Rollup-ом, использует тяжёлый MUI, Emotion-стили, DevExpress Grid.

## Рассмотренные варианты

### A. Векторный canvas + codegen

**+** Полный контроль над рендером, оффлайн-режим, лёгкий старт.
**+** Готовая база (openpencil, open-pencil) с MIT-лицензией.
**−** Любой нетривиальный компонент (DataGrid, DatePicker, Charts) придётся
заново реализовывать в векторном виде или показывать «заглушкой» — пользователь
не увидит реальный продакшен.
**−** Codegen всегда «угадывает» React. На MUI-компонентах с sx-prop, theme-overrides
и emotion-css это особенно ломается.
**−** Двойной источник истины (документ-сцена + код) — рассинхронизируются.

### B. Live-DOM canvas (iframe + dev-server)

**+** Пользователь видит **точно то, что попадёт в прод**. MUI/Emotion/любая
обёртка работает «бесплатно».
**+** Один источник истины — AST. Codegen не нужен, нужны точные AST-патчи.
**+** Поддержка любого React-стека репозитория (Vite/Next/CRA/Storybook-only).
**−** Cold-start sandbox 5–30 c — надо греть пул.
**−** Cross-origin overlay сложнее (postMessage protocol между shell и iframe).
**−** Editor зависит от того, что dev-сервер целевого репо вообще запускается.

### C. Гибрид (live-DOM в Interact, вектор в Design)

**−** Двойной источник истины — главный минус варианта A возвращается.

## Решение

**Принимаем вариант B — Live-DOM canvas.**

- Холст редактора — `<iframe sandbox>` к dev-серверу, поднятому в Docker-песочнице на сессию пользователя.
- Поверх iframe — DOM-overlay в основном document, рисующий selection / hover / breadcrumbs / handles.
- Пары координат и target-нод синхронизируются через `postMessage` + DOM-MutationObserver внутри iframe.
- Все три режима (Interact / Design / Code) разделяют одну и ту же iframe-сессию, переключение режима = смена UI поверх неё, а не пересборка.

## Последствия

**Позитивные:**

- Сразу совместимы с любым React-репо, включая Rollup-only library-проекты типа `ibp-ui-kit` (mount Storybook story напрямую в холст).
- AST становится первичной моделью; ts-morph patches — единственный механизм правок.

**Негативные / inflict:**

- Нужен sandbox-orchestrator (см. ADR-0005, отдельная плашка) и постоянно прогретый пул.
- Нужна спецификация postMessage-протокола между shell и iframe. Первоначально
  для неё планировался отдельный `sandbox-client`; пустой package scaffold
  удалён в 0137, а действующий bridge остаётся рядом со своими потребителями.
- Нет оффлайн-режима «без dev-сервера». В Phase 4 при необходимости можно будет добавить read-only снапшот-режим.

**Не идём:**

- Не используем WebContainer (закрытая лицензия, не подходит для on-prem).
- Не используем Skia/CanvasKit как поверхность редактирования (только опционально для импорта `.fig` в отдельной утилите).

## Ссылки

- Builder.io Fusion modes overview — Interact / Design / Code, общий live preview.
- openpencil README (vector approach we deliberately reject as the canvas substrate).
