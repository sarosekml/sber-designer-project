# GigaCode CLI integration — document map

Этот файл — навигационная точка, а не отдельная спецификация. Интеграция
проверена live-тестом GigaCode CLI v26.9.64; поведение, auth/catalogue/MCP и
безопасная граница чтения CLI state описаны в документах ниже.

Связанные источники истины:

- [GigaCode runtime](../how-it-works/gigacode-runtime.md) — текущее поведение
  продукта: registry, runner, stream parser, session, usage и failure
  semantics, а также граница автоматической и live проверки;
- [Connect GigaCode](../integrations/connect-gigacode.md) — пользовательская
  инструкция;
- [ADR-0016](adr/0016-agent-runtime-adapters.md) — общий data-driven runtime
  contract.

Архитектурные инварианты:

- GigaCode — внешний CLI пользователя; продукт его не дистрибутирует и не
  изменяет его конфигурацию;
- все runs проходят через общий agent-runtime adapter;
- auth bootstrap принадлежит CLI и корпоративному SSO;
- secrets из `~/.gigacode` не выходят из локального server-side reader;
- на server-deploy без binary runtime остаётся `installed:false`;
- фактическая модель/usage фиксируются общим run-record контуром и видны через
  реализованный Screen info.

Новые решения не добавлять сюда отдельно: архитектурное решение оформляется
ADR, поведение — в how-it-works, пользовательские шаги — в integrations.
