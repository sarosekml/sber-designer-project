# Test suite ownership

`bun run test` discovers both the repository-level tests in this directory and
co-located `*.test.*` / `*.spec.*` files under active packages.

## Placement

- Pure unit tests for web stores, hooks, helpers and small components stay next
  to the module they exercise.
- Service integration, cross-package, protocol, replay, migration, eval and
  browser tests live here.
- Numbered files are task or incident regressions. Keep each numbered file as a
  reviewable regression unit even when it exceeds the production line budget.
- `tests/browser/` contains browser harness support; the executable browser
  scenarios are orchestrated by `scripts/browser-smoke.ts`.
- `tests/eval/` contains eval runners and scorecards, not ordinary unit tests.

The root remains intentionally flat for existing integration tests. Moving 255
files into folders would create import churn without removing code or improving
test isolation. Findability is provided by the generated inventory's
`category` and `owner` fields. New suites should use a subdirectory only when a
runner or fixture boundary needs one.

## Ownership map

| Inventory owner       | Primary production surface                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| `agent-runtime`       | `services/api/src/agent*`, chat routes, runtime adapters, MCP and LLM gateway |
| `auth`                | authentication, users, captcha and deployment access control                  |
| `design-intelligence` | design index, Storybook/static catalogs, components, craft and descriptions   |
| `project-model`       | `.sdproj`, project registry, screens, folders and persistence                 |
| `sandbox-and-canvas`  | sandbox sessions, preview bridge, canvas and render health                    |
| `source-control`      | git worker, Source Control UI, branch and PR lifecycle                        |
| `web-editor`          | co-located web UI behavior and pure frontend helpers                          |
| `platform`            | configuration, scripts and contracts spanning several surfaces                |

## Categories

| Category      | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `unit`        | Pure co-located module behavior                                  |
| `integration` | Service or cross-package behavior through real module boundaries |
| `contract`    | Security, policy or public protocol invariants                   |
| `replay`      | Byte/event-normalized external runtime recordings and goldens    |
| `eval`        | Quality/eval runner and release gate behavior                    |
| `browser`     | Chromium harness and visible end-to-end behavior                 |
| `migration`   | Compatibility with an older persisted or configuration shape     |

## Large regression files

The production hard cap of 800 lines does not automatically apply to numbered
regression units or fixture-driven contract suites. Large test files are split
only when their setup and lifecycle are independent; line count alone is not a
reason to scatter assertions. Shared setup may move to `tests/helpers/`, but a
move must preserve every assertion and the same `bun run test` discovery count.

## Before deleting a test

1. Identify the production branch and user-visible regression it protects.
2. Show that another test has the same trigger and expectation, or remove the
   corresponding product behavior/migration reader in the same change.
3. Run the surviving test against a controlled mutation that should fail it.
4. Compare total discovered files, test cases, skips and failures before and
   after the deletion.

Similarity of names, task age, or an intentionally invalid fixture is not
evidence that a test is redundant.
