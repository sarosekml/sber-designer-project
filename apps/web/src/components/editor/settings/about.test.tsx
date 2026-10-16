import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { BuildVersionText } from '@/components/build-info/BuildVersionLabel';

import { AboutSettingsContent } from './about';

const INFO = {
  version: '1.0.0-beta',
  gitSha: '0123456789abcdef0123456789abcdef01234567',
  buildTime: '2026-10-16T09:30:00.000Z',
  productName: 'sber-designer',
  author: 'Jane Doe <jane@example.com>',
};

describe('Settings → About', () => {
  test('renders product, version, build time, short commit and author when /api/version is 200', () => {
    const html = renderToStaticMarkup(
      <AboutSettingsContent status="ready" info={INFO} detail={null} />,
    );

    expect(html).toContain('sber-designer');
    expect(html).toContain('v1.0.0-beta');
    expect(html).toContain('2026-10-16 09:30 UTC');
    expect(html).toContain('0123456');
    expect(html).not.toContain('>0123456789abcdef0123456789abcdef01234567<');
    expect(html).toContain('Jane Doe &lt;jane@example.com&gt;');
    expect(html).toContain('href="/how-it-works"');
    expect(html).toContain('LICENSE');
    expect(html).toContain('THIRD_PARTY_NOTICES.md');
    expect(html).not.toContain('Build metadata unavailable');
  });

  test('says the build marker is missing and names the command when /api/version is 503', () => {
    const html = renderToStaticMarkup(
      <AboutSettingsContent
        status="unavailable"
        info={null}
        detail="Build metadata unavailable"
        onRetry={() => {}}
      />,
    );

    expect(html).toContain('Build metadata unavailable');
    expect(html).toContain('bun run build:info');
    expect(html).toContain('Retry');
    expect(html).not.toContain('Commit');
  });

  test('falls back to a generic product name and an explicit missing author', () => {
    const html = renderToStaticMarkup(
      <AboutSettingsContent
        status="ready"
        info={{ version: 'v2.0.0', gitSha: 'abc1234', buildTime: '2026-10-16T09:30:00Z' }}
        detail={null}
      />,
    );

    expect(html).toContain('sber-designer');
    expect(html).toContain('v2.0.0');
    expect(html).not.toContain('vv2.0.0');
    expect(html).toContain('Not specified');
  });

  test('compact version label carries the full build summary in its tooltip', () => {
    const html = renderToStaticMarkup(<BuildVersionText status="ready" info={INFO} />);
    expect(html).toContain('>v1.0.0-beta<');
    expect(html).toContain(
      'title="sber-designer v1.0.0-beta · commit 0123456 · built 2026-10-16 09:30 UTC · by Jane Doe &lt;jane@example.com&gt;"',
    );

    expect(renderToStaticMarkup(<BuildVersionText status="unavailable" info={null} />)).toContain(
      'version unknown',
    );
    expect(renderToStaticMarkup(<BuildVersionText status="loading" info={null} />)).toBe('');
  });
});
