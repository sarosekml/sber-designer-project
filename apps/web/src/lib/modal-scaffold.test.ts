import { expect, test } from 'bun:test';

import {
  buildBlankModalHtml,
  buildBlankModalReactImplementation,
  buildModalStoryWrapper,
} from './modal-scaffold';

test('blank HTML modal materializes the full contract with the requested size', () => {
  const html = buildBlankModalHtml({
    name: 'Delete confirm',
    defaults: { width: '300px', height: '50%', longContent: 'grow' },
  });

  // Exactly one screen root, on the backdrop wrapper.
  expect(html.match(/data-sd-screen-root/g)).toHaveLength(1);
  expect(html).toContain('data-sd-modal-backdrop');
  // Window carries the marker, the inline size vars, and the content mode.
  expect(html).toContain('data-sd-modal-window');
  expect(html).toContain('style="--sd-modal-width: 300px; --sd-modal-height: 50%"');
  expect(html).toContain('data-sd-modal-content="grow"');
  // All three regions and the elastic body contract.
  expect(html).toContain('data-sd-modal-region="header"');
  expect(html).toContain('data-sd-modal-region="body"');
  expect(html).toContain('data-sd-modal-region="footer"');
  expect(html).toContain('min-height: 0');
  expect(html).toContain('overflow-y: auto');
  expect(html).toContain(':has(');
  expect(html).toContain('margin-block: auto');
  expect(html).toContain('overflow: visible');
  // a11y + transparent page background.
  expect(html).toContain('role="dialog"');
  expect(html).toContain('aria-modal="true"');
  expect(html).toContain('background: transparent');
});

test('blank HTML modal escapes the screen name', () => {
  const html = buildBlankModalHtml({ name: 'A < B & "C"' });
  expect(html).toContain('A &lt; B &amp; &quot;C&quot;');
  expect(html).not.toContain('<h2 id="sd-modal-title" class="sd-modal-title">A < B');
});

test('blank React modal puts the size vars inline on the window', () => {
  const tsx = buildBlankModalReactImplementation({
    name: 'Invite member',
    componentName: 'InviteMember',
    defaults: { width: '560px', height: 'auto', longContent: 'scroll' },
  });
  expect(tsx).toContain("'--sd-modal-width': '560px'");
  expect(tsx).toContain("'--sd-modal-height': 'auto'");
  expect(tsx).toContain('data-sd-modal-window');
  expect(tsx).toContain('data-sd-modal-content="scroll"');
  expect(tsx).toContain('data-sd-modal-region="body"');
  expect(tsx).toContain('as React.CSSProperties');
  expect(tsx).toContain('modalOverflowStyles');
  expect(tsx).toContain('overflow-y: auto !important');
  expect(tsx).toContain('height: auto !important');
  expect(tsx).toContain('export function InviteMember()');
});

test('modal story wrapper forces a transparent full-viewport preview host', () => {
  const story = buildModalStoryWrapper({
    screenName: 'Invite member',
    componentName: 'InviteMember',
    storyTitle: 'Screens/Dialogs/Invite member',
    componentImportPath: './InviteMember',
  });
  expect(story).toContain('#storybook-root');
  expect(story).toContain('background: transparent');
  expect(story).toContain("layout: 'fullscreen'");
  expect(story).toContain('InviteMember');
});
