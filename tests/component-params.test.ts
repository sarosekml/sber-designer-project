/**
 * 0133 track 0: declared-parameter extraction for the Design panel's Component
 * tab. Fixtures are generic on purpose (rule 9) — no customer component names.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  extractComponentParams,
  readColocatedStorySources,
  readImportedTypeSources,
} from '@sber-designer/design-indexer';

const UNION_COMPONENT = `
import type { ReactNode } from 'react';

export interface ActionButtonProps {
  /** Visual emphasis of the control. */
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  count?: number;
  label: string;
  children?: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent) => void;
}

export function ActionButton({ variant = 'secondary', size = 'md', ...rest }: ActionButtonProps) {
  return <button {...rest} />;
}
`;

describe('extractComponentParams — TS props', () => {
  const params = extractComponentParams({
    sourceText: UNION_COMPONENT,
    componentName: 'ActionButton',
  });
  const byProp = new Map(params.map((param) => [param.prop, param]));

  test('reads literal unions as enum controls', () => {
    expect(byProp.get('variant')?.control).toBe('enum');
    expect(byProp.get('variant')?.options?.map((option) => option.value)).toEqual([
      'primary',
      'secondary',
      'ghost',
    ]);
    expect(byProp.get('variant')?.source).toBe('ts-props');
  });

  test('reads boolean, number and string controls', () => {
    expect(byProp.get('disabled')?.control).toBe('boolean');
    expect(byProp.get('count')?.control).toBe('number');
    expect(byProp.get('label')?.control).toBe('string');
  });

  test('marks non-optional props as required and sorts them first', () => {
    expect(byProp.get('label')?.required).toBe(true);
    expect(byProp.get('variant')?.required).toBe(false);
    expect(params[0]?.prop).toBe('label');
  });

  test('drops function props and surfaces owned by other panel tabs', () => {
    expect(byProp.has('onClick')).toBe(false);
    expect(byProp.has('children')).toBe(false);
    expect(byProp.has('className')).toBe(false);
  });

  test('reads destructuring defaults without writing them into source', () => {
    expect(byProp.get('variant')?.defaultValue).toBe('secondary');
    expect(byProp.get('size')?.defaultValue).toBe('md');
  });

  test('reads JSDoc as the control description', () => {
    expect(byProp.get('variant')?.description).toBe('Visual emphasis of the control.');
  });
});

describe('extractComponentParams — type aliases and nullish unions', () => {
  const source = `
    export type Tone = 'info' | 'warning' | 'danger';
    export type BannerProps = {
      tone?: Tone;
      dismissible?: boolean | undefined;
      title?: string | null;
    };
    export const Banner = (props: BannerProps) => <div />;
  `;
  const byProp = new Map(
    extractComponentParams({ sourceText: source, componentName: 'Banner' }).map((param) => [
      param.prop,
      param,
    ]),
  );

  test('resolves an alias union to enum options', () => {
    expect(byProp.get('tone')?.options?.map((option) => option.value)).toEqual([
      'info',
      'warning',
      'danger',
    ]);
  });

  test('ignores undefined/null members when picking the control', () => {
    expect(byProp.get('dismissible')?.control).toBe('boolean');
    expect(byProp.get('title')?.control).toBe('string');
  });
});

describe('extractComponentParams — inline props annotation', () => {
  // Very common in real code: no named *Props type, the shape is written in the
  // signature. Covers both a plain object and an intersection with utility types.
  const source = `
    export function Notice({ tone = 'info', dense, title }: {
      title: string;
      tone?: 'info' | 'warning' | 'danger';
      dense?: boolean;
      icon: React.ComponentType<{ className?: string }>;
    }) {
      return <div />;
    }
  `;
  const byProp = new Map(
    extractComponentParams({ sourceText: source, componentName: 'Notice' }).map((param) => [
      param.prop,
      param,
    ]),
  );

  test('reads controls from the signature annotation', () => {
    expect(byProp.get('tone')?.options?.map((option) => option.value)).toEqual([
      'info',
      'warning',
      'danger',
    ]);
    expect(byProp.get('dense')?.control).toBe('boolean');
    expect(byProp.get('title')?.required).toBe(true);
  });

  test('still drops component-valued props', () => {
    expect(byProp.has('icon')).toBe(false);
  });

  test('still reads destructuring defaults', () => {
    expect(byProp.get('tone')?.defaultValue).toBe('info');
  });

  test('reads an intersection annotation', () => {
    const intersection = `
      export function Field({ size = 'default' }: Omit<React.ComponentProps<'input'>, 'size'> & {
        size?: 'sm' | 'default';
      }) {
        return <input />;
      }
    `;
    const params = extractComponentParams({
      sourceText: intersection,
      componentName: 'Field',
    });
    expect(params.find((param) => param.prop === 'size')?.options?.map((o) => o.value)).toEqual([
      'sm',
      'default',
    ]);
  });
});

describe('extractComponentParams — cva variants', () => {
  const source = `
    import { cva, type VariantProps } from 'class-variance-authority';

    const panelVariants = cva('panel', {
      variants: {
        intent: { neutral: 'bg-neutral', accent: 'bg-accent', muted: 'bg-muted' },
        density: { compact: 'p-1', cozy: 'p-3' },
      },
      defaultVariants: { intent: 'neutral', density: 'cozy' },
    });

    export interface PanelProps extends VariantProps<typeof panelVariants> {
      heading?: string;
    }

    export function Panel({ intent, density, heading }: PanelProps) {
      return <section />;
    }
  `;
  const byProp = new Map(
    extractComponentParams({ sourceText: source, componentName: 'Panel' }).map((param) => [
      param.prop,
      param,
    ]),
  );

  test('turns a variant map into enum options', () => {
    expect(byProp.get('intent')?.control).toBe('enum');
    expect(byProp.get('intent')?.options?.map((option) => option.value)).toEqual([
      'neutral',
      'accent',
      'muted',
    ]);
    expect(byProp.get('intent')?.source).toBe('cva');
  });

  test('reads defaultVariants as default hints', () => {
    expect(byProp.get('intent')?.defaultValue).toBe('neutral');
    expect(byProp.get('density')?.defaultValue).toBe('cozy');
  });

  test('keeps plain props from the same interface', () => {
    expect(byProp.get('heading')?.control).toBe('string');
  });

  test('does not borrow variants from another CVA in the same source chunk', () => {
    const sharedFile = `
      const panelVariants = cva('', {
        variants: { tone: { neutral: '', accent: '' } },
        defaultVariants: { tone: 'neutral' },
      });
      const badgeVariants = cva('', {
        variants: { size: { sm: '', lg: '' } },
        defaultVariants: { size: 'sm' },
      });
      export interface PanelProps extends VariantProps<typeof panelVariants> {
        title?: string;
      }
      export interface BadgeProps extends VariantProps<typeof badgeVariants> {
        label?: string;
      }
      export function Panel(props: PanelProps) { return <section /> }
      export function Badge(props: BadgeProps) { return <span /> }
    `;
    const panel = extractComponentParams({
      sourceText: sharedFile,
      componentName: 'Panel',
    });
    expect(panel.map((param) => param.prop)).toContain('tone');
    expect(panel.map((param) => param.prop)).not.toContain('size');
  });
});

describe('extractComponentParams — Storybook enrichment', () => {
  const source = `
    export interface ChipProps {
      shape?: 'round' | 'square';
      tone?: string;
      active?: boolean;
    }
    export function Chip(props: ChipProps) {
      return <span />;
    }
  `;
  const storyText = `
    const meta = {
      component: Chip,
      args: { tone: 'brand', active: true },
      argTypes: {
        tone: {
          control: { type: 'select' },
          options: ['brand', 'neutral', 'critical'],
          description: 'Color role of the chip.',
        },
        shape: { control: { type: 'select' }, options: ['round'] },
      },
    };
  `;
  const byProp = new Map(
    extractComponentParams({ sourceText: source, componentName: 'Chip', storyText }).map(
      (param) => [param.prop, param],
    ),
  );

  test('upgrades an untyped string prop to enum from argTypes options', () => {
    expect(byProp.get('tone')?.control).toBe('enum');
    expect(byProp.get('tone')?.options?.map((option) => option.value)).toEqual([
      'brand',
      'neutral',
      'critical',
    ]);
  });

  test('takes description from argTypes', () => {
    expect(byProp.get('tone')?.description).toBe('Color role of the chip.');
  });

  test('keeps TS union options when argTypes disagree', () => {
    expect(byProp.get('shape')?.options?.map((option) => option.value)).toEqual([
      'round',
      'square',
    ]);
    expect(byProp.get('shape')?.source).toBe('ts-props');
  });

  test('uses story args as default hints', () => {
    expect(byProp.get('tone')?.defaultValue).toBe('brand');
    expect(byProp.get('active')?.defaultValue).toBe('true');
  });

  test('keeps a text-controlled children arg under its Storybook label', () => {
    const params = extractComponentParams({
      sourceText: `
        interface ButtonProps { children?: React.ReactNode }
        function Button(props: ButtonProps) { return <button>{props.children}</button> }
      `,
      componentName: 'Button',
      storyText: `
        const meta = {
          component: Button,
          argTypes: { children: { control: 'text', name: 'label' } },
        };
      `,
    });

    expect(params).toContainEqual({
      prop: 'children',
      label: 'label',
      control: 'string',
      required: false,
      source: 'argtypes',
    });
  });
});

test('resolves composed aliases and large keyof-object enums for component controls', () => {
  const iconNames = Array.from({ length: 20 }, (_, index) => `Icon${index + 1}`);
  const params = extractComponentParams({
    sourceText: `
      type DefaultColor = 'default' | 'primary';
      type ButtonColor = AlertColor | DefaultColor;
      interface ButtonProps {
        color?: ButtonColor;
        startIcon?: IconName;
      }
      function Button(props: ButtonProps) { return <button /> }
    `,
    componentName: 'Button',
    typeSourceText: `
      type AlertColor = 'warning' | 'error';
      const iconsMap = { ${iconNames.join(', ')} };
      type IconName = keyof typeof iconsMap;
    `,
  });
  const byProp = new Map(params.map((param) => [param.prop, param]));

  expect(byProp.get('color')?.options?.map((option) => option.value)).toEqual([
    'warning',
    'error',
    'default',
    'primary',
  ]);
  expect(byProp.get('startIcon')?.options?.map((option) => option.value)).toEqual(iconNames);
});

test('follows an export-type barrel to the object behind a keyof enum', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-component-keyof-import-'));
  const buttonDir = join(root, 'src/Button');
  const iconDir = join(root, 'src/Icon');
  await mkdir(buttonDir, { recursive: true });
  await mkdir(iconDir, { recursive: true });
  const source = `
    import type { IconName } from '../Icon';
    export interface ButtonProps { startIcon?: IconName }
  `;
  const iconNames = Array.from({ length: 20 }, (_, index) => `Glyph${index + 1}`);
  await writeFile(join(buttonDir, 'Button.tsx'), source);
  await writeFile(join(iconDir, 'index.ts'), "export type { IconName } from './Icon.types';");
  await writeFile(
    join(iconDir, 'Icon.types.ts'),
    "import { iconsMap } from './Icon.const'; export type IconName = keyof typeof iconsMap;",
  );
  await writeFile(
    join(iconDir, 'Icon.const.ts'),
    `export const iconsMap = { ${iconNames.join(', ')} };`,
  );

  const typeSourceText = await readImportedTypeSources(root, 'src/Button/Button.tsx', source);
  const params = extractComponentParams({
    sourceText: source,
    typeSourceText,
    componentName: 'Button',
  });

  expect(params[0]?.options?.map((option) => option.value)).toEqual(iconNames);
});

describe('extractComponentParams — scoping and empty cases', () => {
  test('picks this component props when several live in one chunk', () => {
    const source = `
      export interface CardProps { padded?: boolean }
      export interface CardHeaderProps { sticky?: boolean }
      export function Card(props: CardProps) { return <div /> }
      export function CardHeader(props: CardHeaderProps) { return <div /> }
    `;
    const cardProps = extractComponentParams({ sourceText: source, componentName: 'Card' });
    expect(cardProps.map((param) => param.prop)).toEqual(['padded']);
    const headerProps = extractComponentParams({ sourceText: source, componentName: 'CardHeader' });
    expect(headerProps.map((param) => param.prop)).toEqual(['sticky']);
  });

  test('returns nothing when the component has no readable params', () => {
    const source = `export function Divider() { return <hr /> }`;
    expect(extractComponentParams({ sourceText: source, componentName: 'Divider' })).toEqual([]);
  });

  test('never borrows a neighbour props type when several are declared', () => {
    const source = `
      export interface CardProps { padded?: boolean }
      export interface CardHeaderProps { sticky?: boolean }
    `;
    expect(extractComponentParams({ sourceText: source, componentName: 'Unrelated' })).toEqual([]);
  });

  test('falls back to the sole props type when the name does not match', () => {
    // Components whose props type is named differently (`Props`, `OwnProps`)
    // stay editable; the single-block rule keeps the guess unambiguous.
    const params = extractComponentParams({
      sourceText: UNION_COMPONENT,
      componentName: 'RenamedExport',
    });
    expect(params.map((param) => param.prop)).toContain('variant');
  });
});

test('colocated story enrichment is scoped to the selected component', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-component-story-scope-'));
  await mkdir(join(root, 'src/components'), { recursive: true });
  await writeFile(
    join(root, 'src/components/ActionButton.tsx'),
    'export function ActionButton() {}',
  );
  await writeFile(
    join(root, 'src/components/ActionButton.stories.tsx'),
    `
      import { ActionButton } from './ActionButton';
      export default {
        component: ActionButton,
        argTypes: { tone: { control: 'select', options: ['main', 'quiet'] } },
      };
    `,
  );
  await writeFile(
    join(root, 'src/components/Card.stories.tsx'),
    `
      import { Card } from './Card';
      export default {
        component: Card,
        argTypes: { density: { control: 'select', options: ['tight', 'roomy'] } },
      };
    `,
  );

  const stories = await readColocatedStorySources(
    root,
    'src/components/ActionButton.tsx',
    'ActionButton',
  );
  expect(stories).toContain('tone');
  expect(stories).not.toContain('density');
});
