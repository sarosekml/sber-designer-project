/** zod schema for runtime validation at the api boundary. */
import { z } from 'zod';

const SourceLocationSchema = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().nonnegative(),
  })
  .strict();

const SetPropOpSchema = z
  .object({
    kind: z.literal('set-prop'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    name: z
      .string()
      .min(1)
      .regex(/^[A-Za-z_$][A-Za-z0-9_$-]*$/, 'invalid JSX attribute name'),
    value: z.string(),
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

const SetStylePropOpSchema = z
  .object({
    kind: z.literal('set-style-prop'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    name: z
      .string()
      .min(1)
      .regex(/^--[A-Za-z0-9_-]+$|^[A-Za-z_$][A-Za-z0-9_$]*$/, 'invalid style property name'),
    value: z.string(),
  })
  .strict();

const RemoveStylePropOpSchema = z
  .object({
    kind: z.literal('remove-style-prop'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    name: z
      .string()
      .min(1)
      .regex(/^--[A-Za-z0-9_-]+$|^[A-Za-z_$][A-Za-z0-9_$]*$/, 'invalid style property name'),
  })
  .strict();

const SetClassNameOpSchema = z
  .object({
    kind: z.literal('set-class-name'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    value: z.string(),
  })
  .strict();

const AddImportOpSchema = z
  .object({
    kind: z.literal('add-import'),
    file: z.string().min(1),
    source: z.string().min(1),
    name: z
      .string()
      .min(1)
      .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, 'invalid JS identifier'),
    default: z.boolean().optional(),
  })
  .strict();

const SwapComponentOpSchema = z
  .object({
    kind: z.literal('swap-component'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    newName: z
      .string()
      .min(1)
      .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, 'invalid JSX tag name'),
  })
  .strict();

const WrapWithOpSchema = z
  .object({
    kind: z.literal('wrap-with'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    wrapperName: z
      .string()
      .min(1)
      .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, 'invalid JSX wrapper name'),
    wrapperAttrs: z.array(z.string()).optional(),
  })
  .strict();

const SetChildrenTextOpSchema = z
  .object({
    kind: z.literal('set-children-text'),
    file: z.string().min(1),
    loc: SourceLocationSchema,
    text: z.string(),
  })
  .strict();

const ReplaceTextOpSchema = z
  .object({
    kind: z.literal('replace-text'),
    file: z.string().min(1),
    oldText: z.string().min(1),
    newText: z.string(),
  })
  .strict();

export const OpSchema = z.discriminatedUnion('kind', [
  SetPropOpSchema,
  RemovePropOpSchema,
  SetStylePropOpSchema,
  RemoveStylePropOpSchema,
  SetClassNameOpSchema,
  AddImportOpSchema,
  SwapComponentOpSchema,
  WrapWithOpSchema,
  SetChildrenTextOpSchema,
  ReplaceTextOpSchema,
]);

export const ApplyPatchInputSchema = z
  .object({
    workspaceRoot: z.string().min(1),
    ops: z.array(OpSchema).min(1).max(64),
  })
  .strict();
