# 0114 eval release-gate fixtures

Синтетические scorecards для трёх исходов B5 release-gate:

- `current-pass-scorecard.json` — изменения остаются в пределах порогов;
- `current-regression-scorecard.json` — fidelity/reuse падают, craft blocking
  растёт;
- `current-blocked-scorecard.json` — матрица не завершена и fidelity не
  измерена.

Fixtures не содержат клиентских данных и используются CLI smoke и
интеграционными тестами.
