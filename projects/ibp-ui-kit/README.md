# ui-kit

> Made with create-react-library

[![NPM](https://img.shields.io/npm/v/ui-kit.svg)](https://www.npmjs.com/package/ui-kit) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Local development setup (after `git clone`)

The library depends on `@sber-ibp/core`, which lives on a corporate Nexus that is not publicly reachable. To allow the project to build / Storybook to run anywhere, a runtime stub of that package ships with the repo at `vendor/sber-ibp-core/` and is wired through `package.json` as a `file:` dependency.

```bash
git clone https://github.com/sarosekml/ibp-ui-kit.git
cd ibp-ui-kit
npm run setup       # = npm install --ignore-scripts --legacy-peer-deps
npm run storybook   # http://localhost:6006
```

The `setup` script wraps `npm install` with the flags this project requires:
- `--ignore-scripts` — skips lifecycle scripts that would fail (no `husky install`, no `prepare`).
- `--legacy-peer-deps` — required because the project pins MUI 5.x peers strictly.

If you have access to the Sber internal Nexus, you can swap the stub for the real package: in `package.json` change `"@sber-ibp/core": "file:./vendor/sber-ibp-core"` back to `"9.49.0"` (its original version) and re-run `npm install` against the corporate registry.

The stub at `vendor/sber-ibp-core/` exposes loose `any`-typed signatures for everything the codebase imports from `@sber-ibp/core` (i18n, hooks, helpers, types). It is enough to compile and render Storybook; some Tables-area type checks emit warnings against the loose typings — these do not block the build.

### Running inside the corporate contour (internal Nexus registry)

A fresh checkout installs **without any registry switching**. The approved path is:

```bash
npm run setup       # = npm install --ignore-scripts --legacy-peer-deps
npm run storybook   # http://localhost:6006
```

Two things make this work behind the corporate registry:

1. **Private package is vendored, not fetched.** `@sber-ibp/core` is wired as
   `file:./vendor/sber-ibp-core` (see above), so the install never reaches the
   internal Nexus for it.
2. **The blocked `tar` version is pinned away via `overrides`.** The corporate
   registry (`sberosc.sigma.sbrf.ru`) rejects `tar@6.2.1` with `E403` (blocked by
   security policy). That version is pulled only transitively by `giget`, a
   Storybook **scaffolding** helper (`@storybook/cli`) that never runs during
   `storybook dev`. `package.json` therefore forces the security-approved current
   release:

   ```jsonc
   "overrides": {
     "tar": "7.5.16"   // off the blocked 6.2.1; giget uses tar only for `storybook init`
   }
   ```

   The committed `package-lock.json` resolves this (and everything else) against
   `registry.npmjs.org`; npm's default `replace-registry-host` rewrites that host
   to whatever registry is configured (the corporate proxy) at install time, so
   **do not** point npm at the public registry — the lockfile is already
   contour-ready.

If a future `npm install` is blocked on another package version (same `E403`
shape), the fix is the same pattern: add the security-approved version to
`overrides` and regenerate the lockfile with
`npm install --package-lock-only --legacy-peer-deps`. Do not switch registries.

## Install (consumers)

```bash
npm install @sber-ibp/uikit
```

## Usage

```tsx
import React from 'react'
import { Button } from '@sber-ibp/uikit/dist/index'

const MyComponent = () => (
  <Button size='medium' type='button' variant='contained'>
    JOIN
  </Button>
)
```

### Screenshot Testing

1. Run storybook `npm run storybook`
2. Run test validation: `npm run test-screenshots`

`screenshots/expected` - folder for ideal screenshots. Push this updates to servers and actualize it.

`screenshots/actual` - folder for local created screenshots. Copy new states of components
from this directory to `screenshots/expected`.

`screenshots/diffs` - folder to view differences between actual and ideal states.

## Icon Converter

The icon converter is a tool for automatically generating React components from SVG icons and updating related project files.

### Features
- Automatic SVG to React component conversion
- Smart export management (adds only new icons)
- Updates mock files and constant mappings
- Handles attribute normalization and camelCase conversion
- Supports two operation modes:
  - Full rebuild of all icons
  - Partial build of missing icons

### Usage

1. **Install dependencies**  
   Make sure you have all required devDependencies installed from `package.json`

2. **Run converter**  
   ```bash
   npm run icons-generate
   ```

3. **Select mode**
    You'll be prompted to choose between:
    - *rewrite-all* - Process all SVG icons from the repository
    - *update-missing* - Only process new/missing icons

## Running Storybook

The fastest way to see the components in a browser:

```bash
npm run storybook
```

This launches a Webpack dev-server on **http://localhost:6006** with hot-reload — every save in `src/components/**/*.stories.tsx` re-renders the affected story automatically.

### Prerequisites

Run once after cloning (or after pulling changes that touched `package.json`):

```bash
npm run setup
```

That installs deps with the project-required flags (`--ignore-scripts --legacy-peer-deps`). Without it `npm run storybook` will fail with `Cannot find module ...` errors.

### What you get

- Sidebar with all components grouped by atomic level (atoms / molecules / organisms / documentation).
- Per-story controls panel (`Controls` tab) for live prop tweaking.
- 6 viewports preset (XS Phone … XL FullHD) under the viewport icon — matches `theme/breakpoints.ts`.
- 4 background colors (`white`, `light`, `light swamp`, `dark`).

### Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `Module not found: 'yup'` (or any other public dep) | `npm install` ran without `--legacy-peer-deps` and stripped optional deps | re-run `npm run setup` |
| `Cannot find file '@sber-ibp/core/build/configs/tsconfig.libraries.json'` | vendor stub not on disk (e.g. agent missed `vendor/`) | `git pull` to ensure `vendor/sber-ibp-core/` is fully present |
| Port 6006 already in use | previous `npm run storybook` left dangling | `lsof -ti:6006 \| xargs kill -9` and rerun |
| TS warnings about `useEventApiListener<...>` etc. | the vendored `@sber-ibp/core` stub types everything as `any` | safe to ignore; Storybook's TS checker is already disabled in `.storybook/main.js` (see `typescript.check: false`) |

### Build a static Storybook

If you need a deployable build:

```bash
npm run build-storybook
```

Output goes to `storybook-static/` (gitignored). Serve it with any static hosting.

## License

MIT © [](https://github.com/)
