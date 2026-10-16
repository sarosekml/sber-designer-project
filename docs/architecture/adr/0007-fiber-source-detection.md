---
id: ADR-0007
title: React Fiber source detection
status: Accepted
date: 2026-05-08
scope: DOM to source mapping
refines:
  - ADR-0004
---

# ADR-0007: Default source-mapping via React Fiber `__source`

- **Дата:** 2026-05-08
- **Статус:** Accepted (refines ADR-0004)
- **Контекст:** Phase 0 PoC-3.

## Контекст

ADR-0004 (Three modes) описывает мост DOM↔AST через атрибут
`data-sd-loc="file:line:col"`, который вешает наш Babel-плагин в
sandbox dev-сервер. Это требует, чтобы sandbox обязательно подключал
плагин — иначе Design-mode ослепнет.

Изучили, как тот же мост делает существующий инструмент
[click-to-component](https://github.com/ericclemmons/click-to-component):

- Полагается на стандартный `@babel/plugin-transform-react-jsx-source`,
  который инжектит `__source = { fileName, lineNumber, columnNumber }`
  как hidden JSX prop в dev-сборке.
- Этот плагин **автоматически включён** в `@vitejs/plugin-react`,
  Next.js, Create React App, и Storybook 8 (через тот же
  `@vitejs/plugin-react`).
- Маппинг DOM-ноды → source делается **walking React Fiber tree**:
  на DOM-элементе живёт `__reactFiber$xxx`, у Fiber есть `_debugSource`
  (или `_debugOwner._debugSource`), оттуда читаем file/line/col.
- В production-сборках `__source` tree-shaken'ится, overhead = 0.

## Решение

**По умолчанию используем React Fiber walker, не свой `data-sd-loc`
плагин.** Babel-плагин остаётся в roadmap'е как fallback на Phase 1+.

### Почему

- ✅ Работает на ЛЮБОМ React+Vite/Next/CRA репо без модификаций
  pipeline'а. Включая `ibp-ui-kit`, который мы валидируем.
- ✅ Storybook 8 на Vite даёт `__source` бесплатно — поддержка нативная.
- ✅ Меньше движущихся частей в Phase-0 sandbox: не надо мутировать
  `.storybook/main.ts` репозитория клиента.
- ✅ Минусы tree-shaking'а нас не касаются — редактор работает только с
  dev-сборкой dev-сервера.

### Когда нужен Babel/Vite plugin (откладываем на Phase 1+)

- Webpack-based Storybook (старые корпоративные репо). Storybook 6 на
  Webpack 5 в `babel-loader` не включает `jsx-source` по умолчанию.
- Не-React фреймворки (Vue, Svelte). У них нет Fiber.
- Production sandbox-режим (если когда-нибудь понадобится — `__source`
  будет вырезан, нужен явный `data-sd-loc`).

В этих случаях ставится наш Babel-плагин
[`@sber-designer/babel-plugin-sd-loc`](../../../packages/babel-plugin-sd-loc/)
(реализован в Phase 1.6). Подключается через
`@vitejs/plugin-react` в Vite/Storybook 8 или прямо через
`babel.plugins` в Webpack-Storybook 6.

## Реализация в PoC-3

`apps/web/src/components/editor/dom-source.ts`:

```ts
function getFiber(node: HTMLElement): Fiber | null {
  const k = Object.keys(node).find((x) => x.startsWith('__reactFiber$'));
  return k ? (node as any)[k] : null;
}

function getDebugSource(fiber: Fiber | null): SourceLoc | null {
  let cur = fiber;
  while (cur) {
    if (cur._debugSource) return cur._debugSource;
    cur = cur.return;
  }
  return null;
}
```

`DomOverlay` теперь читает source через эту утилиту вместо
`element.getAttribute('data-sd-loc')`. Если Fiber/`_debugSource` нет
(не-React страница, например наш `demo-target.html`) — fallback на
старый `data-sd-loc` атрибут.

## Последствия

- **ADR-0004 обновляется в части механизма**: Babel `data-sd-loc` →
  React Fiber `__source` (default) + Babel `data-sd-loc` (fallback).
  Trade-offs и UX three modes остаются как было.
- В PoC-3 `apps/web` рендерит реальный Storybook iframe (см. ADR-0008),
  а не статичный `demo-target.html`. Старая фикстура остаётся для
  не-React тестов.
- На Phase 1, когда будем добавлять поддержку Webpack-Storybook
  репозиториев, реализуем `@sber-designer/vite-plugin-sd-loc` и
  `@sber-designer/webpack-plugin-sd-loc` под одним фасадом
  «тег JSX → атрибут».

## Ссылки

- [click-to-component](https://github.com/ericclemmons/click-to-component) — same trick.
- [@babel/plugin-transform-react-jsx-source](https://babeljs.io/docs/babel-plugin-transform-react-jsx-source).
- React Fiber `_debugSource` — undocumented but stable since React 16.
- ADR-0004 — three modes (the parent decision).
