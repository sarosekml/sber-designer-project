# Screen generation main baseline v1

Accepted live baseline for the 0114 screen-generation quality gate.

- Captured: 2026-07-23
- Provider/model: direct `deepseek/deepseek-v4-pro`
- Matrix: one `react-storybook` cell and one `html-css` cell
- React run: `run-2026-07-23T09-06-40-956-14cb48af`
- HTML run: `run-2026-07-23T09-14-24-959-5002d2c3`
- Component reuse: latest successful `validate_screen_craft` earned/total ratio
- Craft blocking: latest successful `validate_screen_craft` blocking count
- Language/fact fidelity: latest successful Design Jury `brief_fit` role,
  normalized from 0–10 to 0–1

Both cells completed the streaming pipeline with persisted receipts. The React
cell ended `needs_review` after a bounded Jury revision attempt; the HTML cell
ended `complete` with Jury 8.0. Release-gate metrics are machine-derived from
the receipts and remain numeric; unknown values are never coerced to zero.
