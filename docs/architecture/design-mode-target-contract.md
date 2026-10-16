# Design Mode Target Contract

Status: working contract for Design mode.

Design mode has two levels of support.

## Universal Baseline

Any connected project that renders in the sandbox must remain usable in Design
mode even if its source is not Design-readable yet.

Baseline guarantees:

- the live DOM iframe renders the project screen;
- hover and click can select a visible DOM element;
- selection captures tag name, text, rect, selector or DOM path, safe
  attributes, component path when available, and source location when available;
- `dom://...` fallback selections are first-class context for the agent;
- direct visual controls may be locked, but **Ask Assistant** stays available;
- validation failures never block opening a project, selecting an element, or
  sending selected context to the agent.

The baseline is the compatibility floor for arbitrary existing projects.

## Design-Readable Output

Screens generated or substantially rewritten by `ai-product-designer` should
move beyond the baseline and become Design-readable.

A Design-readable screen:

- uses real React/TSX/JSX source instead of raw HTML strings;
- has a clear screen implementation file; Storybook wrappers stay thin;
- exposes meaningful selectable DOM/component structure;
- uses project components, design-index records and tokens first;
- keeps first-pass editable values simple: text children/string props,
  string/number/boolean props, literal `className`, and narrow `style` objects;
- marks important flow controls with stable attributes such as
  `data-sd-flow-id`, project-conventional `data-testid`, or `aria-label`;
- avoids silently editing shared component definitions when the intended target
  is a screen instance.

## Inspector Result

Every inspected target reports:

- `projectSupport`: `baseline-selection`, `design-readable`, or `unknown`;
- `sourceScope`: `screen-instance`, `storybook-wrapper`,
  `component-definition`, or `unknown`;
- operation capabilities for `text`, `props`, `style`, `className`, and
  `insert`.

Capability statuses:

- `editable`: Design mode can apply a structured AST operation.
- `assistant-only`: source exists, but deterministic visual controls are unsafe.
- `read-only`: source exists, but policy or ownership blocks direct edits.
- `unmapped`: no safe source location; use DOM context with the agent.

Direct visual operations use the shared `VisualChange` names:

- `set-children-text`
- `set-prop`
- `remove-prop`
- `set-style`
- `remove-style`
- `set-class-token`

Larger intents such as insert, component swap or layout restructuring should be
typed assistant requests until deterministic AST operations are proven.

## Agent Rule

For arbitrary legacy screens, `ai-product-designer` may start from baseline DOM
selection context. When it creates a new screen or substantially rewrites a
selected area, the touched output should follow the Design-readable contract so
future Design mode edits become deterministic.
