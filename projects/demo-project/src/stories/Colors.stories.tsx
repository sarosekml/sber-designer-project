import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { colorDescription, describeComponent, describeStory } from '../storybook/descriptions';

const accentScale = [
  ['50', 'oklch(0.97 0.02 155)', true],
  ['100', 'oklch(0.93 0.05 155)', true],
  ['200', 'oklch(0.86 0.09 155)', true],
  ['300', 'oklch(0.76 0.12 155)', true],
  ['400', 'oklch(0.68 0.14 155)', false],
  ['500', 'oklch(0.62 0.13 155)', false],
  ['600', 'oklch(0.55 0.14 155)', false],
  ['700', 'oklch(0.47 0.12 155)', false],
  ['800', 'oklch(0.36 0.10 155)', false],
] as const;

const neutralScale = [
  ['0', 'oklch(0.985 0.003 240)', true],
  ['50', 'oklch(0.97 0.005 240)', true],
  ['100', 'oklch(0.94 0.008 240)', true],
  ['200', 'oklch(0.88 0.010 240)', true],
  ['300', 'oklch(0.78 0.012 240)', true],
  ['400', 'oklch(0.62 0.014 250)', false],
  ['500', 'oklch(0.48 0.015 250)', false],
  ['600', 'oklch(0.36 0.015 250)', false],
  ['900', 'oklch(0.22 0.015 250)', false],
] as const;

const semanticSwatches = [
  ['Success', '--c-success'],
  ['Danger', '--c-danger'],
  ['Warning', '--c-warning'],
  ['Info', '--c-info'],
  ['AI / Violet', '--c-violet'],
  ['Text', '--c-text'],
] as const;

const surfaceSwatches = [
  ['Background', '--c-bg'],
  ['Surface', '--c-surface'],
  ['Surface 2', '--c-surface-2'],
  ['Surface 3', '--c-surface-3'],
  ['Border', '--c-border'],
  ['Border strong', '--c-border-strong'],
] as const;

function ColorsOverview() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="section-head">
        <h2 className="section-title">Цвета</h2>
        <span className="section-kicker">OKLCH · cool neutrals · emerald accent</span>
      </div>

      <ColorScale title="Акцент — Emerald" colors={accentScale} />
      <ColorScale title="Нейтральные — Cool Gray" colors={neutralScale} />
      <SwatchGroup title="Семантические" swatches={semanticSwatches} />
      <SwatchGroup title="Поверхности и границы" swatches={surfaceSwatches} />
    </section>
  );
}

function ColorScale({
  title,
  colors,
}: {
  title: string;
  colors: readonly (readonly [label: string, color: string, darkLabel: boolean])[];
}) {
  return (
    <>
      <div className="sub-title">{title}</div>
      <div className="demo">
        <div className="demo-body">
          <div className="scale">
            {colors.map(([label, color, darkLabel]) => (
              <div className="scale-cell" key={label} style={{ background: color }}>
                <span className={`num ${darkLabel ? 'dark' : ''}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SwatchGroup({
  title,
  swatches,
}: {
  title: string;
  swatches: readonly (readonly [name: string, token: string])[];
}) {
  return (
    <>
      <div className="sub-title">{title}</div>
      <div className="demo">
        <div className="demo-body grid grid-6">
          {swatches.map(([name, token]) => (
            <div className="specimen" key={token}>
              <div className="swatch" style={{ background: `var(${token})` } as CSSProperties} />
              <div className="sw-name">{name}</div>
              <div className="sw-token">{token}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const meta = {
  title: 'Foundation/Colors',
  component: ColorsOverview,
  tags: ['autodocs'],
  parameters: describeComponent(colorDescription),
} satisfies Meta<typeof ColorsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  parameters: describeStory(colorDescription),
};
