import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { AGENT_KIT_TOOLS } from '../services/api/src/agent-kit/tools';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import type { ToolContext } from '../services/api/src/agent/types';

test('default ai-product-designer persona speaks the Design mode protocol', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const body = kit.defaultAgent.body;

  expect(body).toContain('Interact / Design / Code');
  expect(body).toContain('one sandbox iframe');
  expect(body).toContain('live DOM');
  expect(body).toContain('AST');
  expect(body).toContain('baseline selection-to-agent');
  expect(body).toContain('Design-readable');
  expect(body).toContain('projectSupport');
  expect(body).toContain('sourceScope');
  expect(body).toContain('capabilities');
  expect(body).toContain('dom://');
  expect(body).toContain('screen_create');
  expect(body).toContain('apply_patch');
  expect(body).toContain('load_agent_skill');
  expect(body).toContain('read_agent_knowledge');
  expect(body).toContain('@ai-screen-architect');
  expect(body).toContain('@ai-component-author');
  expect(body).toContain('@ai-design-system-scout');
  expect(body).toContain('@ai-html-design-system-adapter');
  expect(body).toContain('@ai-git-deliverer');
});

test('default agent kit declares focused visible subagents', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const expected = [
    'ai-screen-architect',
    'ai-component-author',
    'ai-design-system-scout',
    'ai-html-design-system-adapter',
    'ai-git-deliverer',
  ];

  for (const name of expected) {
    expect(kit.agents).toContainEqual(
      expect.objectContaining({
        name,
        mode: 'subagent',
        hidden: false,
        permissionPolicy: expect.objectContaining({
          tools: expect.objectContaining({
            allow: expect.any(Array),
            deny: expect.any(Array),
          }),
        }),
      }),
    );
  }

  const architect = kit.agents.find((agent) => agent.name === 'ai-screen-architect');
  expect(architect?.permission.edit).toBe('ask');
  expect(architect?.permissionPolicy.tools.deny).toContain('apply_patch');
  expect(architect?.permissionPolicy.tools.allow).toContain('flow_add_edge');

  const gitDeliverer = kit.agents.find((agent) => agent.name === 'ai-git-deliverer');
  expect(gitDeliverer?.permissionPolicy.tools.allow).toContain('send_pr');
  expect(gitDeliverer?.permissionPolicy.tools.deny).toContain('apply_patch');
});

test('HTML design-system adapter preserves foreign bundles behind a thin facade', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const adapter = kit.agents.find((agent) => agent.name === 'ai-html-design-system-adapter');
  const skill = await loadSkill('html-design-system-adapter');

  expect(adapter).toMatchObject({
    mode: 'subagent',
    permission: expect.objectContaining({ edit: 'ask', run_script: 'deny' }),
  });
  expect(adapter?.permissionPolicy.tools.allow).toContain('rebuild_design_system_preview');
  expect(adapter?.permissionPolicy.tools.deny).toContain('apply_project_restructure');
  expect(skill.contents).toContain('thin canonical facade');
  expect(skill.contents).toContain('CSS imports may be nested');
  expect(skill.contents).toContain('Do not flatten or duplicate the bundle');
  expect(skill.contents).toContain('specs/_cheatsheet.md');
});

test('canonical refusal rules live in the default persona, not prompt-builder fallback', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const promptBuilder = await readFile(
    new URL('../services/api/src/prompt-builder.ts', import.meta.url),
    'utf8',
  );
  const canonicalGuardrail = 'Do not replace a screen with a standalone mockup';

  expect(kit.defaultAgent.body).toContain(canonicalGuardrail);
  expect(promptBuilder).not.toContain(canonicalGuardrail);
});

test('product-screen-generation skill defines Design-readable screen output', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const skill = await loadSkill('product-screen-generation');

  expect(
    kit.skills.find((candidate) => candidate.name === 'product-screen-generation')?.critiquePolicy,
  ).toBe('opt-in');
  expect(skill.contents).toContain('design-mode-contract');
  expect(skill.contents).toContain('Design-readable');
  expect(skill.contents).toContain('baseline selection');
  expect(skill.contents).toContain('screen implementation file');
  expect(skill.contents).toContain('thin Storybook wrapper');
  expect(skill.contents).toContain('Do not rename the Storybook `meta.title`');
  expect(skill.contents).toContain('projectSupport');
  expect(skill.contents).toContain('sourceScope');
  expect(skill.contents).toContain('capabilities');
  expect(skill.contents).toContain('validate_design_screen');
  expect(skill.contents).toContain('list_screen_templates');
  expect(skill.contents).toContain('screen_create');
});

test('product-screen-generation skill hardens active-screen generation tool contract', async () => {
  const skill = await loadSkill('product-screen-generation');

  expect(skill.contents).toContain(
    'For active empty screens, write the active implementation file first and do not call screen_create.',
  );
  expect(skill.contents).toContain(
    'After full-file generation, use write_file or replace-text for structural repairs',
  );
  expect(skill.contents).toContain('Validate with validate_design_screen before final response.');
});

test('product-screen-generation skill defines image-to-screen fidelity rules', async () => {
  const skill = await loadSkill('product-screen-generation');

  expect(skill.contents).toContain('## Image-to-screen fidelity');
  expect(skill.contents).toContain('section-by-section');
  expect(skill.contents).toContain('cards-inside-cards-inside-cards');
  expect(skill.contents).toContain('first viewport');
  expect(skill.contents).toContain('small laptop viewport');
  expect(skill.contents).toContain('omitted sections');
  expect(skill.contents).toContain('language of the user brief or specification');
  expect(skill.contents).toContain(
    'names, amounts, dates, identifiers, and status labels verbatim',
  );
});

test('Sprint 4 wireframe and polish skills are discoverable and linked from screen generation', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const screenGeneration = await loadSkill('product-screen-generation');
  const wireframe = await loadSkill('screen-wireframe');
  const polish = await loadSkill('screen-polish');

  expect(kit.skills).toContainEqual(expect.objectContaining({ name: 'screen-wireframe' }));
  expect(kit.skills).toContainEqual(expect.objectContaining({ name: 'screen-polish' }));
  expect(screenGeneration.contents).toContain('screen-wireframe');
  expect(screenGeneration.contents).toContain('screen-polish');
  expect(wireframe.contents).toContain('greybox first');
  expect(wireframe.contents).toContain('sd.craft.requires');
  expect(polish.contents).toContain('polish pass');
  expect(polish.contents).toContain('quality score');
});

test('B7 screen-redesign preserves the existing screen contract before changing composition', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const skill = await loadSkill('screen-redesign');

  expect(kit.skills).toContainEqual(expect.objectContaining({ name: 'screen-redesign' }));
  expect(kit.defaultAgent.body).toContain('Use `screen-redesign`');
  expect(skill.contents).toContain('preservation inventory');
  expect(skill.contents).toContain('information architecture');
  expect(skill.contents).toContain('business facts');
  expect(skill.contents).toContain('active screen implementation file');
  expect(skill.contents).toContain('component pack');
  expect(skill.contents).toContain('validate_screen_craft');
  expect(skill.contents).toContain('Do not create a replacement screen');
});

test('visual-design-editing skill documents shared operation names and DOM fallback', async () => {
  const skill = await loadSkill('visual-design-editing');

  expect(skill.contents).toContain('design-mode-contract');
  expect(skill.contents).toContain('dom://');
  expect(skill.contents).toContain('sourceScope');
  expect(skill.contents).toContain('capabilities');
  expect(skill.contents).toContain('baseline-selection');
  expect(skill.contents).toContain('Design-readable');
  expect(skill.contents).toContain('set-children-text');
  expect(skill.contents).toContain('set-prop');
  expect(skill.contents).toContain('remove-prop');
  expect(skill.contents).toContain('set-style');
  expect(skill.contents).toContain('remove-style');
  expect(skill.contents).toContain('set-class-token');
  expect(skill.contents).not.toContain('setClassName');
  expect(skill.contents).not.toContain('setProps');
  expect(skill.contents).not.toContain('setChildrenText');
  expect(skill.contents).not.toContain('nodeId');
});

test('pixso simple MCP skill is discoverable and prevents known tool-name failures', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();

  expect(kit.skills).toContainEqual(expect.objectContaining({ name: 'pixso-simple-mcp' }));
  expect(kit.defaultAgent.body).toContain('pixso-simple-mcp');
  expect(kit.defaultAgent.body).toContain('talk-to-pixso-mcp');

  const skill = await loadSkill('pixso-simple-mcp');
  expect(skill.contents).toContain('mcp__talk_to_pixso_mcp__connect_to_pixso');
  expect(skill.contents).toContain('mcp__pixso_desktop__read_frame');
  expect(skill.contents).toContain('connect_to_pixso');
  expect(skill.contents).toContain('get_selection');
  expect(skill.contents).toContain('read_my_design');
  expect(skill.contents).toContain('design_skeleton');
  expect(skill.contents).toContain('product-screen-generation');
  expect(skill.contents).toContain('first 64 tools');
  expect(skill.contents).toContain('list_product_mcp_tools');
  expect(skill.contents).toContain('get_design_context');
  expect(skill.contents).toContain('talk-to-pixso-mcp--');
  expect(skill.contents).toContain('## Tool call examples');
  expect(skill.contents).toContain('"tool":');
  expect(skill.contents).toContain('"input":');
});

test('core skills are runbooks with examples and defer guidance', async () => {
  const coreSkills = [
    'product-screen-generation',
    'design-system-context',
    'visual-design-editing',
    'storybook-component-work',
    'html-component-work',
    'screen-redesign',
    'prototype-wiring',
    'git-pr-workflow',
  ];

  for (const name of coreSkills) {
    const skill = await loadSkill(name);
    expect(skill.contents).toContain('## When to use vs when to defer');
    expect(skill.contents).toContain('Use this skill when:');
    expect(skill.contents).toContain('Defer to another skill when:');
    expect(skill.contents).toContain('Anti-examples:');
    expect(skill.contents).toContain('## Tool call examples');
    expect(skill.contents).toContain('"tool":');
    expect(skill.contents).toContain('"input":');
  }
});

test('git PR workflow documents send_pr input and backlog 0013 lifecycle', async () => {
  const skill = await loadSkill('git-pr-workflow');

  expect(skill.contents).toContain('send_pr');
  expect(skill.contents).toContain('"title"');
  expect(skill.contents).toContain('"body"');
  expect(skill.contents).toContain('"branch"');
  expect(skill.contents).toContain('"baseBranch"');
  expect(skill.contents).toContain('0013-git-branch-pr-lifecycle.md');
});

test('design-mode-compatible-screen skill documents validation and repair rules', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const skill = await loadSkill('design-mode-compatible-screen');

  expect(kit.skills).toContainEqual(
    expect.objectContaining({ name: 'design-mode-compatible-screen' }),
  );
  expect(skill.contents).toContain('design-mode-contract');
  expect(skill.contents).toContain('Design-readable');
  expect(skill.contents).toContain('baseline-selection');
  expect(skill.contents).toContain('validate_design_screen');
  expect(skill.contents).toContain('screens.jsonl');
  expect(skill.contents).toContain('projectSupport');
  expect(skill.contents).toContain('sourceScope');
  expect(skill.contents).toContain('capabilities');
  expect(skill.contents).toContain('raw HTML');
  expect(skill.contents).toContain('thin Storybook wrapper');
});

test('design-system-distill skill defines evidence-based HTML proposal output', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const scout = kit.agents.find((agent) => agent.name === 'ai-design-system-scout');
  const skill = await loadSkill('design-system-distill');

  expect(kit.skills).toContainEqual(expect.objectContaining({ name: 'design-system-distill' }));
  expect(scout?.body).toContain('design-system-distill');
  expect(skill.contents).toContain('design/proposals/<timestamp>');
  expect(skill.contents).toContain('Design.md');
  expect(skill.contents).toContain('tokens.css');
  expect(skill.contents).toContain('components.css');
  expect(skill.contents).toContain('extraction-report.md');
  expect(skill.contents).toContain('frequency');
  expect(skill.contents).toContain('conflicts');
  expect(skill.contents).toContain('Do not invent');
  expect(skill.contents).toContain('real values');
  expect(skill.contents).toContain('2-3 pages');
  expect(skill.contents).toContain('html-css-catalog-manifest.json');
  expect(skill.contents).toContain('distillation');
  expect(skill.contents).toContain('## Tool call examples');
});

test('B3 style scout skill keeps reference extraction reviewable and nine-section', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const skill = await loadSkill('ai-design-system-scout');

  expect(kit.skills).toContainEqual(
    expect.objectContaining({
      name: 'ai-design-system-scout',
      profiles: ['react-storybook', 'react', 'html-css'],
    }),
  );
  expect(skill.contents).toContain('screenshot');
  expect(skill.contents).toContain('Pixso link');
  expect(skill.contents).toContain('reference URL');
  expect(skill.contents).toContain('design/proposals/<proposal-id>');
  expect(skill.contents).toContain('Visual Theme & Atmosphere');
  expect(skill.contents).toContain("Do's and Don'ts");
  expect(skill.contents).toContain('Agent Prompt Guide');
  expect(skill.contents).toContain('Do not write root `Design.md`');
  expect(skill.contents).toContain('Accept or Reject');
});

test('html-component-work skill defines html-css reusable component scope', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const skillRecord = kit.skills.find((skill) => skill.name === 'html-component-work');
  const skill = await loadSkill('html-component-work');

  expect(skillRecord).toMatchObject({
    name: 'html-component-work',
    profiles: ['html-css'],
  });
  expect(skill.contents).toContain('components.css');
  expect(skill.contents).toContain('tokens.css');
  expect(skill.contents).toContain('rebuild_design_system_preview');
  expect(skill.contents).toContain('request_project_reindex');
  expect(skill.contents).toContain('Do not hand-edit `design-system/index.html`');
  expect(skill.contents).toContain('## Tool call examples');
});

test('prototype wiring skill and knowledge define dual-profile flow contract', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const architect = kit.agents.find((agent) => agent.name === 'ai-screen-architect');
  const productDesigner = kit.defaultAgent.body;
  const skillRecord = kit.skills.find((skill) => skill.name === 'prototype-wiring');
  const skill = await loadSkill('prototype-wiring');
  const knowledge = await readKnowledge('interactive-prototype');

  expect(skillRecord).toMatchObject({
    name: 'prototype-wiring',
    profiles: ['react-storybook', 'react', 'html-css'],
  });
  expect(productDesigner).toContain('prototype-wiring');
  expect(architect?.permissionPolicy.tools.allow).toContain('flow_add_edge');
  expect(architect?.permissionPolicy.tools.deny).not.toContain('flow_add_edge');
  expect(architect?.permission.edit).toBe('ask');
  expect(knowledge).toContain('.sber-designer/project.sdproj');
  expect(knowledge).toContain('real `<a href>`');
  expect(knowledge).toContain('flow_add_edge');
  expect(skill.contents).toContain('interactive-prototype');
  expect(skill.contents).toContain('flow_add_edge');
  expect(skill.contents).toContain('real `<a href>`');
  expect(skill.contents).toContain('Do not create new screens');
});

test('default agent kit includes Design mode compatibility validation script', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();

  expect(kit.scripts).toContainEqual(
    expect.objectContaining({
      name: 'validate-design-mode-compatibility',
      command: 'bun',
      permission: 'ask',
    }),
  );
});

test('default knowledge is sber-designer specific and registered', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const requiredKnowledge = [
    'sber-designer-architecture',
    'design-mode-contract',
    'project-index-anatomy',
    'apply-patch-recipes',
    'screen-template-format',
    'catalog-response-shape',
  ];

  for (const id of requiredKnowledge) {
    const resource = kit.knowledge.find((candidate) => candidate.id === id);
    expect(resource).toBeDefined();
    expect(resource?.description.length).toBeGreaterThan(24);
    const contents = await readKnowledge(id);
    expect(contents).toContain('sber-designer');
  }

  const architecture = await readKnowledge('sber-designer-architecture');
  expect(architecture).toContain('Interact / Design / Code');
  expect(architecture).toContain('sandbox iframe');
  expect(architecture).toContain('live-DOM');
  expect(architecture).toContain('AST');

  const designModeContract = await readKnowledge('design-mode-contract');
  expect(designModeContract).toContain('baseline-selection');
  expect(designModeContract).toContain('Design-readable output');

  const projectIndexAnatomy = await readKnowledge('project-index-anatomy');
  expect(projectIndexAnatomy).toContain('.sber-designer/design-index');
  expect(projectIndexAnatomy).toContain('components.jsonl');
  expect(projectIndexAnatomy).toContain('agent-notes.jsonl');

  const patchRecipes = await readKnowledge('apply-patch-recipes');
  expect(patchRecipes).toContain('apply_patch');
  expect(patchRecipes).toContain('set-style-prop');
  expect(patchRecipes).toContain('wrap-with');

  const templateFormat = await readKnowledge('screen-template-format');
  expect(templateFormat).toContain('list_screen_templates');
  expect(templateFormat).toContain('Without template');

  const catalogShape = await readKnowledge('catalog-response-shape');
  expect(catalogShape).toContain('list_components');
  expect(catalogShape).toContain('search_project_index');
  expect(catalogShape).toContain('read_file');
});

test('skills hot-link registered knowledge before runbooks', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const knowledgeIds = new Set(kit.knowledge.map((resource) => resource.id));

  expect(kit.defaultAgent.body).toContain('load referenced knowledge');
  expect(kit.defaultAgent.body).toContain('load_agent_skill');
  expect(kit.defaultAgent.body).toContain('act');

  for (const skill of kit.skills) {
    const loaded = await loadSkill(skill.name);
    expect(loaded.contents).toContain('## Load first');
    expect(loaded.contents).toContain('read_agent_knowledge');

    const section = loaded.contents.split('## Load first')[1]?.split('\n## ')[0] ?? '';
    const references = Array.from(section.matchAll(/`([^`]+)`/g))
      .map((match) => match[1])
      .filter((id) => knowledgeIds.has(id));

    expect(references.length).toBeGreaterThan(0);
  }
});

test('agent kit docs describe permission grammar and approval flow', async () => {
  const defaultReadme = await readFile(
    new URL('../packages/agent-kit/kit/README.md', import.meta.url),
    'utf8',
  );
  const integrationGuide = await readFile(
    new URL('../docs/integrations/project-agent-kit.md', import.meta.url),
    'utf8',
  );

  for (const contents of [defaultReadme, integrationGuide]) {
    expect(contents).toContain('permission');
    expect(contents).toContain('allow');
    expect(contents).toContain('ask');
    expect(contents).toContain('deny');
    expect(contents).toContain('read');
    expect(contents).toContain('edit');
    expect(contents).toContain('run_script');
    expect(contents).toContain('load_skill');
    expect(contents).toContain('send_pr');
    expect(contents).toContain('set_mode');
    expect(contents).toContain('Always allow this session');
  }
});

async function loadSkill(name: string): Promise<{ contents: string }> {
  resetAgentKitCache();
  const tool = AGENT_KIT_TOOLS.find((candidate) => candidate.name === 'load_agent_skill');
  if (!tool) throw new Error('missing load_agent_skill tool');
  return (await tool.handler({ name }, toolContext())) as { contents: string };
}

async function readKnowledge(id: string): Promise<string> {
  const tool = AGENT_KIT_TOOLS.find((candidate) => candidate.name === 'read_agent_knowledge');
  if (!tool) throw new Error('missing read_agent_knowledge tool');
  const result = (await tool.handler({ id }, toolContext())) as { contents: string };
  return result.contents;
}

function toolContext(): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Agent Design Contract Project',
    activeScreen: null,
    workspacePath: null,
    canvasUrl: null,
  };
}
