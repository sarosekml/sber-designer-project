# Eval baselines

`manifest.json` — project-owned registry release-gates. Запись становится
`active` только после принятого живого eval-прогона.

`screen-generation-main` активирован 2026-07-23 по двухпрофильной live-матрице
прямого `deepseek/deepseek-v4-pro`. Принятый artifact и его provenance лежат в
`screen-generation-main/v1/`.

Первичная активация:

1. Запустить полную eval-матрицу на `main` до изменения prompt/skill/craft.
2. Скопировать её `scorecard.json` в
   `tests/eval/baselines/<gate-id>/<version>/scorecard.json`.
3. Проверить, что scorecard завершён и все три контролируемые метрики числовые.
4. В `manifest.json` сменить `status` на `active` и записать относительный
   `baselineScorecard`.
5. Для PR положить новый scorecard по пути `currentScorecard` из registry.

`pending` остаётся допустимым намеренно блокирующим состоянием для будущих
registry entries. Оно не позволяет выдать синтетический fixture за принятый
product baseline.
