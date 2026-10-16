/** Editor bridge tools: read selection, switch mode, post a message. */
import { z } from 'zod';

import { publish } from '../../event-bus';
import { getState, patchState } from '../../state-store';
import type { ServerTool } from '../types';

const GetSelectionInput = z.object({}).strict();

export const getSelection: ServerTool<
  z.infer<typeof GetSelectionInput>,
  {
    selection: {
      loc: string;
      sourceKind?: 'react-source' | 'sd-loc' | 'dom-fallback';
      domPath?: string;
      componentPath?: string[];
      tagName: string;
      text?: string;
      selector?: string;
      componentName?: string;
      componentLoc?: string;
      attributes?: Record<string, string>;
      rect: { x: number; y: number; width: number; height: number };
      scope: 'default_target';
    } | null;
  }
> = {
  name: 'get_selection',
  description:
    "Return the element currently selected in the editor's Design mode. When non-null, this is the default target for the user's next edit request until cleared. Use it for 'this', 'the selected one', and short targeted requests like changing a button label.",
  inputSchema: GetSelectionInput,
  handler: async (_input, ctx) => {
    const sel = getState(ctx.workspacePath).selection;
    return {
      selection: sel
        ? {
            loc: sel.loc,
            ...(sel.sourceKind ? { sourceKind: sel.sourceKind } : {}),
            ...(sel.domPath ? { domPath: sel.domPath } : {}),
            ...(sel.componentPath ? { componentPath: sel.componentPath } : {}),
            tagName: sel.tagName,
            ...(sel.text ? { text: sel.text } : {}),
            ...(sel.selector ? { selector: sel.selector } : {}),
            ...(sel.componentName ? { componentName: sel.componentName } : {}),
            ...(sel.componentLoc ? { componentLoc: sel.componentLoc } : {}),
            ...(sel.attributes ? { attributes: sel.attributes } : {}),
            rect: sel.rect,
            scope: 'default_target',
          }
        : null,
    };
  },
};

// ---------- set_mode ---------------------------------------------------

const SetModeInput = z
  .object({
    mode: z.enum(['interact', 'design', 'code']),
  })
  .strict();

export const setMode: ServerTool<z.infer<typeof SetModeInput>, { ok: true }> = {
  name: 'set_mode',
  description:
    "Switch the editor mode. Useful before an inspection step (set to 'design') or after applying patches (set to 'interact' so the user can click through the result).",
  inputSchema: SetModeInput,
  handler: async (input, ctx) => {
    patchState({ mode: input.mode }, ctx.workspacePath);
    publish({ type: 'editor.mode-changed', mode: input.mode });
    return { ok: true };
  },
};

// ---------- post_message -----------------------------------------------

const PostMessageInput = z
  .object({
    text: z.string().min(1).describe('Markdown text to push into the editor chat transcript.'),
  })
  .strict();

export const postMessage: ServerTool<z.infer<typeof PostMessageInput>, { ok: true }> = {
  name: 'post_message',
  description:
    "Push a markdown message into the editor chat. Use sparingly — for status updates the user should see while you're applying patches, or to summarise a multi-step plan.",
  inputSchema: PostMessageInput,
  handler: async (input) => {
    publish({ type: 'editor.message', text: input.text, source: 'agent' });
    return { ok: true };
  },
};

// ---------- send_pr ----------------------------------------------------
