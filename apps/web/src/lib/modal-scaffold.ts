/**
 * Blank modal scaffolds (0132.1, Р-2/Р-13/Р-14/Р-15). Both profiles materialize
 * the same self-contained contract so an untouched modal already renders as a
 * real scrim + centered dialog with the header/body/footer regions, the size
 * variables, and the long-content attribute in place — the size is editable
 * from the Design panel without an LLM run. Structural CSS is local and scoped
 * to the product `data-sd-modal-*` markers; visual polish comes from a later
 * generation run against the project design system.
 */
import {
  MODAL_BACKDROP_MARKER,
  MODAL_CONTENT_ATTR,
  MODAL_FALLBACK_DEFAULTS,
  MODAL_HEIGHT_VAR,
  MODAL_REGION_MARKER,
  MODAL_WIDTH_VAR,
  MODAL_WINDOW_MARKER,
  type ModalDefaults,
} from '@sber-designer/shared-types';

export interface BlankModalHtmlInput {
  name: string;
  defaults?: ModalDefaults;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Self-contained blank modal page (html-first profile). */
export function buildBlankModalHtml(input: BlankModalHtmlInput): string {
  const defaults = input.defaults ?? MODAL_FALLBACK_DEFAULTS;
  const title = escapeHtmlText(input.name);
  const windowStyle = `${MODAL_WIDTH_VAR}: ${defaults.width}; ${MODAL_HEIGHT_VAR}: ${defaults.height}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      html,
      body {
        margin: 0;
        background: transparent;
      }
      [${MODAL_BACKDROP_MARKER}] {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 1rem;
        overflow-y: hidden;
        background: rgba(15, 23, 42, 0.55);
      }
      [${MODAL_BACKDROP_MARKER}]:has(
          [${MODAL_WINDOW_MARKER}][${MODAL_CONTENT_ATTR}="grow"]
        ) {
        align-items: flex-start;
        overflow-y: auto;
      }
      [${MODAL_WINDOW_MARKER}] {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: var(${MODAL_WIDTH_VAR}, 640px);
        height: var(${MODAL_HEIGHT_VAR}, auto);
        max-width: min(var(${MODAL_WIDTH_VAR}, 640px), 100% - 2rem);
        max-height: min(90vh, 100% - 2rem);
        overflow: hidden;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      [${MODAL_WINDOW_MARKER}][${MODAL_CONTENT_ATTR}="grow"] {
        flex: 0 0 auto;
        height: auto;
        max-height: none;
        margin-block: auto;
        overflow: visible;
      }
      [${MODAL_REGION_MARKER}="header"],
      [${MODAL_REGION_MARKER}="footer"] {
        flex: 0 0 auto;
        padding: 1rem 1.25rem;
      }
      [${MODAL_REGION_MARKER}="header"] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #e5e7eb;
      }
      [${MODAL_REGION_MARKER}="body"] {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 1.25rem;
      }
      [${MODAL_WINDOW_MARKER}][${MODAL_CONTENT_ATTR}="grow"]
        [${MODAL_REGION_MARKER}="body"] {
        flex: 0 0 auto;
        min-height: auto;
        overflow: visible;
      }
      [${MODAL_REGION_MARKER}="footer"] {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        border-top: 1px solid #e5e7eb;
      }
      .sd-modal-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div
      data-sd-screen-root
      ${MODAL_BACKDROP_MARKER}
    >
      <div
        ${MODAL_WINDOW_MARKER}
        ${MODAL_CONTENT_ATTR}="${defaults.longContent}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-modal-title"
        style="${windowStyle}"
      >
        <header ${MODAL_REGION_MARKER}="header">
          <h2 id="sd-modal-title" class="sd-modal-title">${title}</h2>
          <button type="button" aria-label="Close">&times;</button>
        </header>
        <div ${MODAL_REGION_MARKER}="body">
          <section data-sd-empty-canvas="true"></section>
        </div>
        <footer ${MODAL_REGION_MARKER}="footer">
          <button type="button">Cancel</button>
          <button type="button">Confirm</button>
        </footer>
      </div>
    </div>
  </body>
</html>
`;
}

export interface BlankModalReactInput {
  name: string;
  componentName: string;
  defaults?: ModalDefaults;
}

/**
 * Blank open-state modal component (react profile). Renders its own scrim and a
 * centered dialog. The size variables sit inline on the window as a direct
 * object literal (behind one `as React.CSSProperties` cast, which the managed
 * Design apply unwraps — 0132.3), so the size stays editable.
 */
export function buildBlankModalReactImplementation(input: BlankModalReactInput): string {
  const defaults = input.defaults ?? MODAL_FALLBACK_DEFAULTS;
  const name = jsxText(input.name);
  return `import React from 'react';

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  padding: '1rem',
  background: 'rgba(15, 23, 42, 0.55)',
};

const bodyStyle: React.CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  padding: '1.25rem',
};

const modalOverflowStyles = \`
  [${MODAL_BACKDROP_MARKER}]:has(
    [${MODAL_WINDOW_MARKER}][${MODAL_CONTENT_ATTR}="grow"]
  ) {
    align-items: flex-start !important;
    overflow-y: auto !important;
  }
  [${MODAL_WINDOW_MARKER}][${MODAL_CONTENT_ATTR}="grow"] {
    flex: 0 0 auto !important;
    height: auto !important;
    max-height: none !important;
    margin-block: auto !important;
    overflow: visible !important;
  }
  [${MODAL_WINDOW_MARKER}][${MODAL_CONTENT_ATTR}="grow"]
    [${MODAL_REGION_MARKER}="body"] {
    flex: 0 0 auto !important;
    min-height: auto !important;
    overflow: visible !important;
  }
\`;

export function ${input.componentName}() {
  return (
    <div data-sd-screen-root ${MODAL_BACKDROP_MARKER} style={backdropStyle}>
      <style>{modalOverflowStyles}</style>
      <div
        ${MODAL_WINDOW_MARKER}
        ${MODAL_CONTENT_ATTR}="${defaults.longContent}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-modal-title"
        style={{
          '${MODAL_WIDTH_VAR}': '${defaults.width}',
          '${MODAL_HEIGHT_VAR}': '${defaults.height}',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          width: 'var(${MODAL_WIDTH_VAR}, 640px)',
          height: 'var(${MODAL_HEIGHT_VAR}, auto)',
          maxWidth: 'min(var(${MODAL_WIDTH_VAR}, 640px), 100% - 2rem)',
          maxHeight: 'min(90vh, 100% - 2rem)',
          overflow: 'hidden',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        } as React.CSSProperties}
      >
        <header
          ${MODAL_REGION_MARKER}="header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <h2 id="sd-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            ${name}
          </h2>
          <button type="button" aria-label="Close">
            &times;
          </button>
        </header>
        <div ${MODAL_REGION_MARKER}="body" style={bodyStyle} />
        <footer
          ${MODAL_REGION_MARKER}="footer"
          style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'flex-end',
            padding: '1rem 1.25rem',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <button type="button">Cancel</button>
          <button type="button">Confirm</button>
        </footer>
      </div>
    </div>
  );
}
`;
}

export interface ModalStoryWrapperInput {
  screenName: string;
  componentName: string;
  storyTitle: string;
  componentImportPath: string;
}

/**
 * Thin Storybook wrapper that renders the modal open and forces a transparent,
 * full-viewport preview host (Р-2, риск №1/№10) without copying product markup.
 */
export function buildModalStoryWrapper(input: ModalStoryWrapperInput): string {
  return `import type { Meta, StoryObj } from '@storybook/react';

import { ${input.componentName} } from '${input.componentImportPath}';

// Make the Storybook preview host transparent + full-viewport so the modal's
// own scrim is what shows, matching how it renders standalone and in overlay.
const transparentHostStyles = \`
  html, body, #storybook-root { background: transparent !important; height: 100%; }
  #storybook-root { display: block; }
\`;

const meta = {
  title: ${quoteSingle(input.storyTitle)},
  component: ${input.componentName},
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },
  decorators: [
    (Story) => (
      <>
        <style>{transparentHostStyles}</style>
        <Story />
      </>
    ),
  ],
} satisfies Meta<typeof ${input.componentName}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: ${quoteSingle(input.screenName)},
};
`;
}

function jsxText(value: string): string {
  return value.replace(/[{}<>]/g, (ch) => `{'${ch}'}`);
}

function quoteSingle(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
