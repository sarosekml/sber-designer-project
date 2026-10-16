# Fixture manifest

Fixtures are project snapshots, protocol recordings and intentionally invalid
inputs. Some consumers construct paths dynamically, so a plain text import
search is not a safe deletion test. This manifest records group ownership and
why the bytes must remain stable.

| Group                     | Owner               | Contract and primary consumers                                                                                                 |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `0080-eval/`              | design-intelligence | Component usage/eval projects consumed by `0107-dcm-draft-eval-fixture`, `0107-eval-batch-runner` and `tests/eval/run-eval.ts` |
| `0083-exports/`           | design-intelligence | Public export/barrel shapes consumed by `0083-public-exports.test.ts`                                                          |
| `0083-typecheck/`         | platform            | Valid TypeScript fixture for `0083-typecheck-gate.test.ts`                                                                     |
| `0083-typecheck-broken/`  | platform            | Intentionally invalid TypeScript fixture; its malformed diagnostic must remain malformed                                       |
| `0083-typecheck-no-ts/`   | platform            | Project without TypeScript configuration for the typecheck fallback contract                                                   |
| `0114-b6/`                | design-intelligence | B6 regression input consumed by `0114-b6-regression.test.ts`                                                                   |
| `0114-eval-release-gate/` | design-intelligence | Baseline/candidate release-gate project used by the 0114 eval gate tests                                                       |
| `0114-style-memory/`      | design-intelligence | Style-memory eval dataset and deterministic expected evidence                                                                  |
| `agent-runs/`             | agent-runtime       | Persisted run manifests/events for session recovery, run routes and screen health                                              |
| `external-runtime/`       | agent-runtime       | CLI mutation, render-health and finalization workspaces used across runtime tests and E2E                                      |
| `product-neutrality/`     | agent-runtime       | Project-specific vocabulary traps that protect the universal-product rule                                                      |
| `project-index/`          | design-intelligence | Storybook, React-static and HTML-first repositories used by project index contracts                                            |
| `runtime-traces/`         | agent-runtime       | Byte-exact external CLI stdout/stderr inputs and normalized golden events                                                      |

The three minimal `project-index/**/package.json` files intentionally stay
self-contained even when their contents match. A fixture must be copyable as a
standalone project; centralizing those manifests would make the fixture shape
less realistic.

The eval candidate scorecard may be byte-identical to its baseline before a
prompt change. Both paths remain because the PR gate compares two roles, not
because the JSON payloads represent different schemas.
