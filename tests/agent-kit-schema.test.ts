import { expect, test } from 'bun:test';

import {
  AgentKitConfigSchema,
  AgentKitScriptManifestSchema,
  AgentKitSkillNameSchema,
  parseAgentFrontmatter,
  parseSkillFrontmatter,
} from '../services/api/src/agent-kit/schema';

test('agent kit config accepts instructions knowledge skills and script manifests', () => {
  const parsed = AgentKitConfigSchema.parse({
    $schema: 'https://sber-designer.example/agents.schema.json',
    defaultAgent: 'ai-product-designer',
    instructions: ['agents/ai-product-designer.md', 'instructions/*.md'],
    knowledge: [
      {
        id: 'product-ui-patterns',
        path: 'knowledge/product-ui-patterns.md',
        description: 'Reusable product UI patterns.',
      },
    ],
    skills: {
      allow: ['*'],
      deny: [],
    },
    scripts: {
      'validate-design-context': {
        description: 'Validate design context.',
        command: 'bun',
        args: ['run', 'validate:design'],
        cwd: 'workspace',
        permission: 'ask',
        timeoutMs: 120000,
      },
    },
  });

  expect(parsed.defaultAgent).toBe('ai-product-designer');
  expect(parsed.instructions).toEqual(['agents/ai-product-designer.md', 'instructions/*.md']);
  expect(parsed.scripts?.['validate-design-context']?.permission).toBe('ask');
});

test('skill names are lowercase kebab case', () => {
  expect(AgentKitSkillNameSchema.parse('visual-design-editing')).toBe('visual-design-editing');
  expect(() => AgentKitSkillNameSchema.parse('VisualDesign')).toThrow();
  expect(() => AgentKitSkillNameSchema.parse('../escape')).toThrow();
});

test('agent and skill frontmatter are parsed from markdown', () => {
  const agent = parseAgentFrontmatter(
    [
      '---',
      'name: ai-product-designer',
      'description: Product-aware code designer.',
      'mode: primary',
      'maxIterations: 10',
      'temperature: 0.2',
      '---',
      '',
      'Body text.',
    ].join('\n'),
  );
  const skill = parseSkillFrontmatter(
    [
      '---',
      'name: product-screen-generation',
      'description: Generate screens from project context.',
      'license: MIT',
      'compatibility: sber-designer',
      'sd:',
      '  critique:',
      '    policy: opt-in',
      '---',
      '',
      '# Skill',
    ].join('\n'),
  );

  expect(agent.frontmatter.name).toBe('ai-product-designer');
  expect(agent.frontmatter.maxIterations).toBe(10);
  expect(agent.body.trim()).toBe('Body text.');
  expect(skill.frontmatter.name).toBe('product-screen-generation');
  expect(skill.frontmatter.license).toBe('MIT');
  expect(skill.frontmatter.sd?.critique?.policy).toBe('opt-in');
});

test('skill critique policy accepts only the three jury modes', () => {
  for (const policy of ['required', 'opt-in', 'opt-out']) {
    const skill = parseSkillFrontmatter(
      [
        '---',
        'name: product-screen-generation',
        'description: Generate screens.',
        'sd:',
        '  critique:',
        `    policy: ${policy}`,
        '---',
      ].join('\n'),
    );
    expect(skill.frontmatter.sd?.critique?.policy).toBe(policy);
  }
  expect(() =>
    parseSkillFrontmatter(
      [
        '---',
        'name: product-screen-generation',
        'description: Generate screens.',
        'sd:',
        '  critique:',
        '    policy: sometimes',
        '---',
      ].join('\n'),
    ),
  ).toThrow();
});

test('script manifest requires command args cwd permission and timeout', () => {
  const parsed = AgentKitScriptManifestSchema.parse({
    name: 'validate-design-context',
    description: 'Validate DESIGN.md and design-index artifacts.',
    command: 'bun',
    args: ['run', 'validate:design'],
    cwd: 'workspace',
    permission: 'ask',
    timeoutMs: 120000,
  });

  expect(parsed.command).toBe('bun');
  expect(() =>
    AgentKitScriptManifestSchema.parse({
      name: 'bad',
      description: 'Bad script.',
      command: 'bash -lc rm -rf .',
      args: [],
      cwd: 'workspace',
      permission: 'ask',
      timeoutMs: 1000,
    }),
  ).toThrow();
});

test('agent kit config rejects unsafe paths and unknown fields', () => {
  expect(() =>
    AgentKitConfigSchema.parse({
      defaultAgent: 'ai-product-designer',
      knowledge: [
        {
          id: 'escaped-doc',
          path: '../DESIGN.md',
          description: 'Escapes the .agents root.',
        },
      ],
    }),
  ).toThrow('Path must stay inside .agents');

  expect(() =>
    AgentKitConfigSchema.parse({
      defaultAgent: 'ai-product-designer',
      unexpected: true,
    }),
  ).toThrow();

  expect(() =>
    AgentKitScriptManifestSchema.parse({
      name: 'unknown-field-script',
      description: 'Unknown fields are not accepted.',
      command: 'bun',
      args: [],
      cwd: 'workspace',
      permission: 'ask',
      timeoutMs: 1000,
      shell: true,
    }),
  ).toThrow();
});
