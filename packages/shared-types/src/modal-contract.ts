/**
 * Modal layout contract text (0132, Р-8/Р-13/Р-14/Р-15/Р-18). One shared source
 * so the system prompt, the New-screen generation prompt, and the external
 * runtime handoff all describe the same modal file shape instead of drifting
 * copies. Universal: it names product `data-sd-*` markers and CSS variables,
 * never a customer component (rule 9).
 */
import {
  MODAL_BACKDROP_MARKER,
  MODAL_CONTENT_ATTR,
  MODAL_HEIGHT_VAR,
  MODAL_REGION_MARKER,
  MODAL_WIDTH_VAR,
  MODAL_WINDOW_MARKER,
  type ModalDefaults,
} from './modal-surface';

export interface ModalContractOptions {
  /** Which generation profile the file targets. */
  profile: 'html' | 'react';
  /** Size + overflow contract to materialize; falls back to the product default text. */
  defaults?: ModalDefaults;
}

const HEADING = '## Modal layout contract';

/**
 * Lines describing the modal contract, ready to append to a prompt. The first
 * line is a `##` heading so the block stands on its own.
 */
export function modalLayoutContractLines(options: ModalContractOptions): string[] {
  const size = options.defaults;
  const sizeHint = size
    ? `Set \`${MODAL_WIDTH_VAR}: ${size.width}; ${MODAL_HEIGHT_VAR}: ${size.height}\` inline on the window (long content: ${size.longContent}).`
    : `Set \`${MODAL_WIDTH_VAR}\` and \`${MODAL_HEIGHT_VAR}\` inline on the window.`;

  const shared = [
    HEADING,
    '',
    '- This screen is a modal overlay dialog, not a full-viewport page. It renders its own scrim and a centered dialog window; in a flow it opens as an overlay above the source screen.',
    `- The root wrapper fills the viewport and IS the single \`data-sd-screen-root\`; also mark it \`${MODAL_BACKDROP_MARKER}\`. Give it a semi-transparent scrim using a design-system overlay token and center the dialog. Keep the \`html\`/\`body\` (and page) background transparent so an underlay screen shows through.`,
    `- The dialog box carries \`${MODAL_WINDOW_MARKER}\`. ${sizeHint} Consume them as \`width: var(${MODAL_WIDTH_VAR}, 640px); height: var(${MODAL_HEIGHT_VAR}, auto)\` and cap with \`max-width: min(var(${MODAL_WIDTH_VAR}, 640px), 100% - 2rem); max-height: min(100% - 2rem, ...)\` so it fits small viewports.`,
    `- Put size ONLY in those contract variables — never hardcode a width/height in a class or a raw style — so it stays editable from the Design panel.`,
    `- Structure the window as three regions marked \`${MODAL_REGION_MARKER}="header|body|footer"\`: header pinned on top (title + a visible close control), body the only elastic region (\`flex: 1; min-height: 0; overflow-y: auto\`), footer pinned at the bottom with the actions. Header and footer are optional (a bare confirm may omit the header); the body is required.`,
    `- Long-content behavior lives on the window as \`${MODAL_CONTENT_ATTR}="scroll"\` (default: only the body scrolls, header/footer stay put) or \`"grow"\` (the window grows with content and the scrim scrolls).`,
    '- Accessibility: `role="dialog"` (or `role="alertdialog"` for a confirm), `aria-modal="true"`, an accessible name tied to the title, a focus trap, initial focus inside the dialog, and a visible close action; `Escape` and the shell close-chip are handled by the editor.',
    '- Do NOT expand this into a full-screen page, remove the scrim, or change its surface unless the user explicitly asks.',
  ];

  if (options.profile === 'react') {
    shared.push(
      `- React: the implementation component exports the modal in its OPEN state (Dialog/portal + its own scrim). Put \`${MODAL_WINDOW_MARKER}\`, the size variables, and \`${MODAL_CONTENT_ATTR}\` on the DOM-forwarding dialog-content element. The thin Storybook wrapper renders it open and makes the preview host transparent (\`html\`, \`body\`, \`#storybook-root\` backgrounds transparent, full-viewport) — do not copy product markup into the wrapper.`,
    );
  }

  return shared;
}

/** Single-line-per-item variant for compact contexts (handoff bullet list). */
export function modalLayoutContractText(options: ModalContractOptions): string {
  return modalLayoutContractLines(options).join('\n');
}
