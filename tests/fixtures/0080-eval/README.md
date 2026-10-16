# 0080 eval corpus (scaffold)

Layout for the two-corpus generation eval. The harness is universal; corpora
are project data.

```text
tests/fixtures/0080-eval/
  ibp-ui-kit/                  # reference test project corpus (local-only materials)
    payment-schedule/
      brief.md                 # the task brief (ТЗ) used for the original run
      reference.png            # the human-made screen (ground truth)
      expected-components.json # component ids the generated screen must use
    dcm-draft-deal/
      brief.md
      reference.png            # manual live result; keep local — customer UI
      expected-components.json
  demo/                        # bundled, CI-safe corpus (non-MUI stack)
    <fixture>/
      brief.md
      reference.png
      expected-components.json
```

Status:

- `demo/` fixtures are synthetic and CI-safe; the deterministic slice of the
  eval (mining, cards, patterns, pack rendering, template gate) is covered by
  `tests/0080-usage-mining.test.ts` plus the design-indexer scanner tests with
  two component-stack styles and a no-Storybook fixture.
- `ibp-ui-kit/payment-schedule/` **waits for user-provided materials**: the
  original brief and the full-resolution human reference screen. Do not commit
  customer screenshots without approval; keep them local if in doubt.
- `ibp-ui-kit/dcm-draft-deal/` preserves the 0107 D4 live smoke contract from
  `DcmDraftDealPage`: the repo keeps the brief and expected component/render
  contract, while the manual screenshot stays local unless explicitly approved.
- The before/after scoring runner (component-reuse + variant-correctness over a
  real generation run) is still open — it needs an LLM provider and is not part
  of `bun test`.
