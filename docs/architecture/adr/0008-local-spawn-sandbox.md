---
id: ADR-0008
title: Local-spawn sandbox controller
status: Accepted
date: 2026-05-08
scope: sandbox lifecycle and drivers
refines:
  - ADR-0001
---

# ADR-0008: Local-spawn sandbox controller for PoC; Docker-per-session postponed to Phase 1

- **Дата:** 2026-05-08 (Phase 0); обновлён в Phase 4 — добавлен Docker driver.
- **Статус:** Accepted (refines ADR-0001)
- **Контекст:** Phase 0 PoC-3 → Phase 4.

> **Phase 4 update:** добавлен Docker driver через
> `SBER_DESIGNER_SANDBOX_DRIVER=docker`. Один контроллер, два режима:
> `local` (по умолчанию) и `docker` с bind-mount + named volume для
> `node_modules`. Image — `services/sandbox/Dockerfile`. Сравнение
> cold-start между режимами оставлено как exercise — оба покрыты
> одной REST-границей.

## Контекст

ADR-0001 закрепил: «холст = iframe с реальным dev-сервером в Docker-песочнице».
PoC-3 в roadmap'е требует доказать оба слова: «реальный dev-сервер» и
«в Docker». Это два разных риска:

1. **Editor ↔ dev-server bridge** — наш редактор корректно поднимает
   реальный dev-сервер пользовательского репо, проксирует его в iframe,
   и DOM-overlay работает на реальном Storybook (не статичной фикстуре).
2. **Cold-start под Docker** — мы успеваем за ≤ 5–30 c с прогретым пулом.

Эти риски можно снимать **по отдельности**, и риск #1 проще.

## Решение

В PoC-3 делаем `services/sandbox` **без Docker** — local spawn через
`child_process.spawn`. Docker-вариант — Phase 1.

### Почему так

- ✅ Снимаем главный риск #1 (Editor ↔ dev-server bridge) на минимально
  возможных движущихся частях.
- ✅ Меряем cold-start реального Storybook на реальном репо без Docker
  noise — это нижняя граница, всё что добавит Docker только сверху.
- ✅ Ровно одна команда для разработчика: `bun run dev` и всё работает,
  без `docker pull`, лимитов памяти контейнера, `mount` гимнастики.
- ✅ Тот же Hono API (`POST /sessions { workspacePath }`) который
  вызывает spawn, в Phase 1 переключается на Docker без изменения
  фронтенда.

### Что мы проигрываем

- ⚠️ **Изоляция** — sandbox получает наш `process.env`, может писать в
  `~/.bash_history`, etc. Для PoC локального разработчика OK; в
  production это блокер, поэтому Phase 1 = Docker.
- ⚠️ **Мульти-тенант** — один sandbox на хост, без оркестрации.
  Phase 1+ — Docker, Phase 4+ — Kubernetes.
- ⚠️ **Cold-start метрика без Docker** — не репрезентативна. В Phase 1
  замеряем под Docker и сравниваем.

### API контроллера (одинаковый для local-spawn и для Docker)

```
POST   /sessions                 { workspacePath, command? }   →  { id, previewUrl }
GET    /sessions/:id                                            →  { status, previewUrl, logsTail }
DELETE /sessions/:id                                            →  204
GET    /sessions/:id/events       SSE                           →  stream of {type, data}
```

`command` дефолтится на `bun run storybook`. При HMR-ready signal'е
(матчим в stdout) меняем status на `ready` и публикуем `previewUrl`.

### Что наследуется в Phase 1 (Docker)

- Контракт API целиком.
- Hono server, который сейчас spawn'ит local — переключаем on внутри
  `start()` метода: `local.start()` или `docker.start()`.
- Прогретый пул, idle eviction, лимиты ресурсов — добавляются как
  middleware вокруг `docker.start()`.
- Reverse-proxy (uses Hono `/sessions/:id/preview/*` → underlying dev
  server) уже есть в local-варианте.

## Что НЕ делаем в PoC-3

- Не пишем Dockerfile для sandbox-image.
- Не реализуем pool warming.
- Не делаем idle eviction (только manual DELETE).
- Не делаем CPU/RAM лимиты.
- Не делаем git clone — controller принимает `workspacePath: string`
  (абсолютный путь к локальной папке). Git-clone придёт вместе с
  Docker'ом в Phase 1.

## Последствия

- ADR-0001 остаётся в силе — финальная архитектура live-DOM canvas с
  Docker. PoC-3 — промежуточный шаг доказательства концепции, ADR-0008
  фиксирует, что мы это делаем сознательно.
- ROADMAP Phase 1 пополняется явной задачей «port sandbox controller
  to Docker» с метрикой cold-start ≤ 30 c.

> **0136 update:** доступ к контроллеру, bind, allowlists workspace/команд
> и окружение дочерних процессов зафиксированы в
> [ADR-0019](0019-access-boundaries-and-project-integrity.md).
