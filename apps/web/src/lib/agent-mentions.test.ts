import { expect, test } from 'bun:test';

import {
  applyAgentMentionSuggestion,
  cyclePrimaryAgent,
  parseLeadingAgentMention,
  suggestAgentMentions,
} from './agent-mentions';

const agents = [
  { name: 'ai-product-designer', mode: 'primary' },
  { name: 'ai-plan-designer', mode: 'primary' },
  { name: 'ai-design-system-scout', mode: 'subagent' },
  { name: 'ai-component-author', mode: 'subagent' },
  { name: 'ai-flex-agent', mode: 'all' },
  { name: 'ai-hidden-indexer', mode: 'subagent', hidden: true },
] as const;

test('parseLeadingAgentMention extracts a leading subagent mention', () => {
  expect(parseLeadingAgentMention('@ai-design-system-scout which token?')).toEqual({
    agent: 'ai-design-system-scout',
    content: 'which token?',
  });
  expect(parseLeadingAgentMention('please ask @ai-design-system-scout')).toBeNull();
});

test('suggestAgentMentions returns all visible agents for an empty @ query', () => {
  expect(suggestAgentMentions('@', agents).map((agent) => agent.name)).toEqual([
    'ai-product-designer',
    'ai-plan-designer',
    'ai-design-system-scout',
    'ai-component-author',
    'ai-flex-agent',
  ]);
});

test('suggestAgentMentions filters visible agents for the current @ query', () => {
  expect(suggestAgentMentions('@ai-d', agents)).toEqual([
    { name: 'ai-design-system-scout', mode: 'subagent' },
  ]);
  expect(suggestAgentMentions('@ai-', agents).map((agent) => agent.name)).toEqual([
    'ai-product-designer',
    'ai-plan-designer',
    'ai-design-system-scout',
    'ai-component-author',
    'ai-flex-agent',
  ]);
  expect(suggestAgentMentions('@ai-hidden', agents)).toEqual([]);
});

test('applyAgentMentionSuggestion completes the active @ query', () => {
  expect(applyAgentMentionSuggestion('@ai-d', 'ai-design-system-scout')).toBe(
    '@ai-design-system-scout ',
  );
  expect(applyAgentMentionSuggestion('please @ai-c', 'ai-component-author')).toBe(
    'please @ai-component-author ',
  );
});

test('cyclePrimaryAgent cycles only visible primary-capable agents', () => {
  expect(cyclePrimaryAgent(agents, 'ai-product-designer')?.name).toBe('ai-plan-designer');
  expect(cyclePrimaryAgent(agents, 'ai-plan-designer')?.name).toBe('ai-flex-agent');
  expect(cyclePrimaryAgent(agents, 'ai-flex-agent')?.name).toBe('ai-product-designer');
  expect(cyclePrimaryAgent(agents, 'ai-product-designer', -1)?.name).toBe('ai-flex-agent');
});
