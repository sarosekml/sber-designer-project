# sber-designer Interactive Prototype Contract

Interactive prototypes are project-owned state in sber-designer. A working
prototype lives in the connected project, not in chat memory:

- `.sber-designer/project.sdproj` stores the registered screens and
  `project.flow[]` edges.
- Product page markup stores real interactions where the connected app needs
  them, especially real `<a href>` links in html-first projects.
- Demo and Interact modes execute supported flow triggers: `click`, `link`, and
  `on-mount`. `manual` edges are diagram-only notes.

## Profile Rules

For React or Storybook projects:

- Use screen ids from the current project screens.
- Add flow edges with `flow_add_edge` after the target screens exist.
- Prefer stable `click` triggers (`selector`, `label`) when the UI action is a
  button or command, and `link` when the rendered UI has an anchor.

For html-first projects:

- Real links come first. Add or preserve a real `<a href>` between the relevant
  `.html` pages so the static page works outside sber-designer too.
- Mirror each important page link as a `flow_add_edge` transition with
  `trigger: { "kind": "link", "href": "pages/target.html" }`.
- Relative links such as `./checkout.html`, `checkout.html`, and
  `pages/checkout.html` should point at the same target page when the scenario
  says they do.
- Do not replace page content while wiring a prototype; edit only the navigation
  affordance needed for the scenario.

## Tool Pattern

1. Identify the exact source and target screens from project screens or
   `list_indexed_screens`.
2. Confirm the intended scenario when the request is ambiguous.
3. For html-first projects, patch only the relevant page files to add or fix
   real `<a href>` links.
4. Call `flow_add_edge` for every scenario transition. Use `link` triggers for
   anchors, `click` triggers for buttons, and `manual` only for a diagram note.
5. Report the changed page files and the edge count.

Do not use `screen_create` unless the user explicitly asks to create a new
screen. Do not use `flow_remove_edge` unless the user asks to remove or replace
existing wiring.
