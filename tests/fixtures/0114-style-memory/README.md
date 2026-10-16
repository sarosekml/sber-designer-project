# 0114 style-memory eval fixture

Синтетический CI-safe fixture для B4. Два экрана имеют reviewable source до и
после одной и той же правки: `padding`, `gap` и высота строк уменьшаются.

Runner `tests/eval/run-style-memory-eval.ts` не вызывает LLM и не использует
подключённый пользовательский проект. Он копирует fixture во временный
workspace и проверяет путь `runs -> receipts -> raw events -> derived memory ->
API/CLI prompt`.
