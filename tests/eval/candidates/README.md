# Eval candidates

Сюда PR добавляет current scorecard для каждого затронутого active gate.
Точный путь задаётся полем `currentScorecard` в
`tests/eval/baselines/manifest.json`.

Scorecard должен быть получен той же fixture/model/profile матрицей, что и
baseline. PR gate создаст `eval-diff.json` и `eval-diff.md`; после merge
candidate не становится baseline автоматически — продвижение baseline остаётся
отдельным review-решением.

Gate проверяет git diff и блокирует PR, если candidate существует, но не был
обновлён именно в этом PR. Это защищает от повторного использования старого
зелёного результата после новой правки prompt/skill/craft.
