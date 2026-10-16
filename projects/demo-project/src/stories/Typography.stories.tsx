import type { Meta, StoryObj } from '@storybook/react-vite';

import { describeComponent, describeStory, typographyDescription } from '../storybook/descriptions';

const typeRows = [
  {
    label: 'display',
    className: 't-display',
    sample: '987,65 млрд ₽',
    meta: '40 / 1.1 / -0.025em · 600',
  },
  {
    label: 'h1',
    className: 't-h1',
    sample: 'Гаражный кооператив «Фауна»',
    meta: '28 / 1.2 / -0.02em · 600',
  },
  {
    label: 'h2',
    className: 't-h2',
    sample: 'Общая информация',
    meta: '20 / 1.3 / -0.01em · 600',
  },
  {
    label: 'h3',
    className: 't-h3',
    sample: 'Инвестиционный отчёт',
    meta: '16 / 1.4 · 600',
  },
  {
    label: 'body',
    className: 't-body',
    sample:
      'Регуляторные корректировки в секторе финтеха ЕС могут повлиять на предстоящие IPO. Фонд в настоящее время работает на 16% выше эталонного показателя.',
    meta: '14 / 1.55 · 400',
  },
  {
    label: 'body-s',
    className: 't-body-s',
    sample: 'Выделенный капитал · 1,45 млрд ₽ · размещено 950 млн ₽, в остатке 500 млн ₽.',
    meta: '13 / 1.5 · 400',
  },
  {
    label: 'caption',
    className: 't-caption',
    sample: 'Триггер: новости о готовящемся изменении налогового законодательства',
    meta: '12 / 1.45 · 400',
  },
  {
    label: 'micro',
    className: 't-micro',
    sample: '6 АПРЕЛЯ 2026 · BLOOMBERG FINANCE · обновлено 2 часа назад',
    meta: '11 / 1.4 · 400',
  },
  {
    label: 'eyebrow',
    className: 't-eyebrow',
    sample: 'Идея сделки',
    meta: '11 UPPER · 600',
  },
  {
    label: 'mono',
    className: 't-mono',
    sample: 'RUB 987,654,321,000 · +16.4% YoY',
    meta: 'JetBrains Mono 12',
  },
];

function TypographyScale() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="section-head">
        <h2 className="section-title">Типографика</h2>
        <span className="section-kicker">Inter · tabular numbers for finance</span>
      </div>

      <div className="demo">
        <div className="demo-head">
          <div className="demo-title">Шкала</div>
          <div className="demo-meta">Inter 400/500/600</div>
        </div>
        <div className="demo-body">
          {typeRows.map((row) => (
            <div className="type-row" key={row.label}>
              <div className="type-label">{row.label}</div>
              <div className={row.className}>{row.sample}</div>
              <div className="type-meta">{row.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const meta = {
  title: 'Foundation/Typography',
  component: TypographyScale,
  tags: ['autodocs'],
  parameters: describeComponent(typographyDescription),
} satisfies Meta<typeof TypographyScale>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {
  parameters: describeStory(typographyDescription),
};
