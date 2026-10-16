import { z } from 'zod';

import { readWorkspaceFile, writeWorkspaceFile } from '../safe-fs';
import type { ToolDefinition } from './index';

const AstReadFileInput = z
  .object({
    path: z.string().min(1).describe('Workspace-relative path of the file to read.'),
  })
  .strict();

export const astReadFile: ToolDefinition<
  z.infer<typeof AstReadFileInput>,
  { path: string; contents: string }
> = {
  name: 'ast_read_file',
  description: 'Read a file from the project workspace. Path is relative to the project root.',
  inputSchema: AstReadFileInput,
  handler: async (input, ctx) => ({
    path: input.path,
    contents: await readWorkspaceFile(ctx.workspaceRoot, input.path),
  }),
};

const AstWriteFileInput = z
  .object({
    path: z
      .string()
      .min(1)
      .describe('Workspace-relative path. Must already exist or be inside the workspace.'),
    contents: z.string().describe('Full new contents of the file (UTF-8).'),
  })
  .strict();

export const astWriteFile: ToolDefinition<
  z.infer<typeof AstWriteFileInput>,
  { ok: true; path: string }
> = {
  name: 'ast_write_file',
  description:
    'Replace a file in the project workspace wholesale. PREFER ast_apply_patch for any change that fits into structured ops (set-prop, remove-prop, add-import). Use this only for file creation, deletion, or large rewrites that ast_apply_patch cannot express.',
  inputSchema: AstWriteFileInput,
  handler: async (input, ctx) => {
    const before = await readWorkspaceFile(ctx.workspaceRoot, input.path).catch(() => null);
    await writeWorkspaceFile(ctx.workspaceRoot, input.path, input.contents);
    if (ctx.bridge && shouldMarkStorybookReloadPending(input.path, before === null)) {
      await ctx.bridge.markStorybookReloadPending(input.path);
    }
    return { ok: true, path: input.path };
  },
};

const SourceLocationSchema = z
  .object({ line: z.number().int().positive(), column: z.number().int().nonnegative() })
  .strict();
const SetPropOpSchema = z
  .object({
    kind: z.literal('set-prop'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    name: z.string().min(1).describe('JSX attribute name (e.g. "variant", "onClick").'),
    value: z
      .string()
      .min(1)
      .describe(
        'TypeScript expression as a STRING. Examples: `"\\"ghost\\""` (string literal), `"24"` (number), `"true"` (boolean), `"() => alert(\\"x\\")"` (function), `"{ mt: 2 }"` (object).',
      ),
  })
  .strict();
const RemovePropOpSchema = z
  .object({
    kind: z.literal('remove-prop'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    name: z.string().min(1),
  })
  .strict();
const AddImportOpSchema = z
  .object({
    kind: z.literal('add-import'),
    file: z.string().min(1),
    source: z.string().min(1).describe('Module specifier, e.g. "@/components/Button".'),
    name: z.string().min(1),
    default: z.boolean().optional(),
  })
  .strict();
const SwapComponentOpSchema = z
  .object({
    kind: z.literal('swap-component'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    newName: z.string().min(1).describe('New JSX tag name, e.g. "Card" or "Tooltip".'),
  })
  .strict();
const WrapWithOpSchema = z
  .object({
    kind: z.literal('wrap-with'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    wrapperName: z.string().min(1).describe('Wrapper tag name.'),
    wrapperAttrs: z
      .array(z.string())
      .optional()
      .describe('Raw JSX attribute strings, e.g. ["variant=\\"ghost\\"", "onClick={() => {}}"].'),
  })
  .strict();
const SetChildrenTextOpSchema = z
  .object({
    kind: z.literal('set-children-text'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    text: z.string().describe('Plain text. Auto-escaped if it contains <, >, {, }.'),
  })
  .strict();
const ReplaceTextOpSchema = z
  .object({
    kind: z.literal('replace-text'),
    file: z.string().min(1),
    oldText: z.string().min(1).describe('Exact existing source text; must occur exactly once.'),
    newText: z.string().describe('Replacement source text.'),
  })
  .strict();

const AstApplyPatchInput = z
  .object({
    ops: z
      .array(
        z.discriminatedUnion('kind', [
          SetPropOpSchema,
          RemovePropOpSchema,
          AddImportOpSchema,
          SwapComponentOpSchema,
          WrapWithOpSchema,
          SetChildrenTextOpSchema,
          ReplaceTextOpSchema,
        ]),
      )
      .min(1)
      .max(64)
      .describe(
        'Structured AST operations to apply atomically. Supported: set-prop, remove-prop, add-import, swap-component, wrap-with, set-children-text, replace-text. See ADR-0013.',
      ),
  })
  .strict();

export const astApplyPatch: ToolDefinition<
  z.infer<typeof AstApplyPatchInput>,
  { ok: true; changedFiles: string[]; ops: { kind: string; file: string }[] }
> = {
  name: 'ast_apply_patch',
  description:
    'Apply structured AST operations atomically. Supports set-prop, remove-prop, add-import, swap-component, wrap-with, set-children-text, replace-text. JSX elements are addressed by source location (file + line + column, from React Fiber __source); use replace-text only for exact generated-source block repairs. All ops succeed or none do.',
  inputSchema: AstApplyPatchInput,
  handler: async (input, ctx) => {
    if (!ctx.bridge) {
      throw new Error(
        'ast_apply_patch requires --api-url (or SBER_DESIGNER_API_URL) so proj-mcp can reach services/api. Set it on the MCP server invocation.',
      );
    }
    await ctx.bridge.announceToolCall(
      'ast_apply_patch',
      `${input.ops.length} op${input.ops.length === 1 ? '' : 's'}`,
    );
    return ctx.bridge.applyPatch({ ops: input.ops });
  },
};

function shouldMarkStorybookReloadPending(path: string, isNewFile: boolean): boolean {
  if (isNewFile) return true;
  const normalized = path.replace(/\\/g, '/').replace(/^\.\/+/, '');
  return [
    /\.stories\.[jt]sx?$/i,
    /^\.storybook\//i,
    /(^|\/)vite\.config\.[jt]s$/i,
    /(^|\/)tailwind\.config\.[jt]s$/i,
    /(^|\/)package\.json$/i,
  ].some((pattern) => pattern.test(normalized));
}
