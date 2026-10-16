import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  agentConcurrencyFromConfig,
  agentContextBudgetFromConfig,
  parseConfig,
} from '../packages/llm-gateway/src/config';
import {
  loadConfig,
  mergeConfigLayers,
  resetConfigCache,
  toFrontendConfig,
} from '../services/api/src/config-store';

test('root provider config exposes only current user-facing providers', async () => {
  const raw = await readFile('sber-designer.json', 'utf8');
  const config = parseConfig(JSON.parse(raw), { env: {}, strictEnv: false });

  expect(Object.keys(config.provider)).toEqual([
    'gigachat',
    'deepseek',
    'openrouter',
    'zai',
    'zai-coding-plan',
    'custom',
  ]);
  expect(config.provider.zai).toMatchObject({
    type: 'openai-compatible',
    name: 'Z.AI',
    options: {
      baseURL: 'https://api.z.ai/api/paas/v4',
      apiKey: '{env:ZAI_API_KEY}',
    },
  });
  expect(config.provider['zai-coding-plan']).toMatchObject({
    type: 'openai-compatible',
    name: 'Z.AI Coding Plan',
    options: {
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      apiKey: '{env:ZAI_CODING_PLAN_API_KEY}',
    },
  });
  expect(config.provider.deepseek?.models?.['deepseek-v4-pro']).toMatchObject({
    name: 'DeepSeek V4 Pro',
    vision: false,
    imageInput: {
      transport: 'text-only-with-ocr',
      verification: 'failed-openai-image-url',
      lastFailureCode: 'unknown_variant_image_url_expected_text',
    },
  });
  expect(config.provider.deepseek?.models?.['deepseek-v4-flash']).toMatchObject({
    name: 'DeepSeek V4 Flash',
    vision: false,
  });
  const frontend = toFrontendConfig(config);
  expect(frontend.provider.zai?.options?.apiKey).toBe('__env_unresolved__');
  expect(frontend.provider['zai-coding-plan']?.options?.apiKey).toBe('__env_unresolved__');
  expect(JSON.stringify(frontend)).not.toContain('ZAI_API_KEY');
  expect(JSON.stringify(frontend)).not.toContain('ZAI_CODING_PLAN_API_KEY');
  expect(config.provider.custom).toMatchObject({
    type: 'openai-compatible',
    name: 'Custom Provider',
  });
  expect(config.provider).not.toHaveProperty('mock');
  expect(config.provider).not.toHaveProperty('anthropic');
  expect(config.provider).not.toHaveProperty('vllm-internal');
  expect(config.provider).not.toHaveProperty('claude-code-bridge');
});

/**
 * 0139 — both shipped configs carry the same GLM presets: the general `zai`
 * endpoint and the separate Coding Plan endpoint. Model ids and display names
 * must be the current explicit ones (glm-5.3 / glm-5.3-flash); FlashX is not
 * part of the Coding Plan and must not appear; the legacy glm-5.2 alias is
 * gone.
 */
test('zai and zai-coding-plan presets list current GLM models in both shipped configs', async () => {
  for (const path of ['sber-designer.json', 'apps/web/public/sber-designer.json']) {
    const raw = await readFile(path, 'utf8');
    const config = parseConfig(JSON.parse(raw), { env: {}, strictEnv: false });

    const codingPlan = config.provider['zai-coding-plan'];
    expect(codingPlan).toBeDefined();
    expect(codingPlan?.type).toBe('openai-compatible');
    expect(codingPlan?.options?.baseURL).toBe('https://api.z.ai/api/coding/paas/v4');
    expect(codingPlan?.models?.['glm-5.3']).toMatchObject({
      name: 'GLM-5.3',
      vision: false,
      limit: { context: 1000000, output: 131072 },
    });
    expect(codingPlan?.models?.['glm-5.3-flash']).toMatchObject({
      name: 'GLM-5.3-Flash',
      vision: true,
      imageInput: {
        transport: 'openai-image-url',
        acceptsDataUrl: true,
        acceptsRemoteUrl: true,
        // Live Data-URL smoke ran on the coding endpoint (task §6.1) —
        // manual-smoke belongs there; the general endpoint keeps
        // provider-docs (review C2).
        verification: 'manual-smoke',
      },
      limit: { context: 1000000, output: 131072 },
    });

    expect(config.provider.zai?.options?.baseURL).toBe('https://api.z.ai/api/paas/v4');
    expect(config.provider.zai?.models?.['glm-5.3']).toMatchObject({
      name: 'GLM-5.3',
      vision: false,
    });
    expect(config.provider.zai?.models?.['glm-5.3-flash']).toMatchObject({
      name: 'GLM-5.3-Flash',
      vision: true,
      imageInput: { verification: 'provider-docs' },
    });
    // No stale alias and no model that the Coding Plan does not include.
    expect(JSON.stringify(config)).not.toContain('glm-5.2');
    expect(JSON.stringify(config)).not.toContain('GLM-5.2');
    expect(JSON.stringify(config)).not.toContain('flashx');
    expect(Object.keys(codingPlan?.models ?? {})).toEqual(['glm-5.3', 'glm-5.3-flash']);
  }
});

test('static frontend fallback config exposes the Z.AI providers', async () => {
  const raw = await readFile('apps/web/public/sber-designer.json', 'utf8');
  const config = parseConfig(JSON.parse(raw), { env: {}, strictEnv: false });

  expect(Object.keys(config.provider)).toEqual([
    'gigachat',
    'deepseek',
    'openrouter',
    'zai',
    'zai-coding-plan',
    'custom',
  ]);
  expect(config.provider.zai).toMatchObject({
    type: 'openai-compatible',
    name: 'Z.AI',
    options: {
      baseURL: 'https://api.z.ai/api/paas/v4',
      apiKey: '{env:ZAI_API_KEY}',
    },
  });
  expect(config.provider['zai-coding-plan']).toMatchObject({
    type: 'openai-compatible',
    name: 'Z.AI Coding Plan',
    options: {
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      apiKey: '{env:ZAI_CODING_PLAN_API_KEY}',
    },
  });
  expect(config.provider.zai?.models?.['glm-5.3']).toMatchObject({
    name: 'GLM-5.3',
    vision: false,
  });
  expect(config.provider.deepseek?.models?.['deepseek-v4-pro']).toMatchObject({
    vision: false,
    imageInput: {
      transport: 'text-only-with-ocr',
      verification: 'failed-openai-image-url',
      lastFailureCode: 'unknown_variant_image_url_expected_text',
    },
  });
});

test('provider model entries can mark vision support explicitly', () => {
  const config = parseConfig({
    agent: { default: { provider: 'custom', model: 'cheap-text' } },
    provider: {
      custom: {
        type: 'openai-compatible',
        name: 'Custom',
        models: {
          'cheap-text': { name: 'Cheap text', vision: false },
          'vision-model': { name: 'Vision model', vision: true },
        },
      },
    },
  });

  expect(config.provider.custom?.models?.['cheap-text']?.vision).toBe(false);
  expect(config.provider.custom?.models?.['vision-model']?.vision).toBe(true);
});

test('frontend config exposes unresolved provider env without leaking secrets', () => {
  const config = parseConfig(
    {
      agent: { default: { provider: 'custom', model: 'cheap-text' } },
      provider: {
        custom: {
          type: 'openai-compatible',
          name: 'Custom',
          options: { apiKey: '{env:CUSTOM_API_KEY}' },
          models: { 'cheap-text': { name: 'Cheap text' } },
        },
        ready: {
          type: 'openai-compatible',
          name: 'Ready',
          options: { apiKey: '{env:READY_API_KEY}' },
          models: { 'cheap-text': { name: 'Cheap text' } },
        },
      },
    },
    { env: { READY_API_KEY: 'secret-value' }, strictEnv: false },
  );

  const frontend = toFrontendConfig(config);

  expect(frontend.provider.custom?.options?.apiKey).toBe('__env_unresolved__');
  expect(frontend.provider.ready?.options?.apiKey).toBe('__configured__');
  expect(JSON.stringify(frontend)).not.toContain('secret-value');
  expect(JSON.stringify(frontend)).not.toContain('CUSTOM_API_KEY');
});

test('api config store resolves provider env from a local env file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sd-config-env-'));
  const envName = 'SD_CONFIG_STORE_LOCAL_ENV_TEST_KEY';
  const prevConfigPath = process.env.SBER_DESIGNER_CONFIG_PATH;
  const prevEnvValue = process.env[envName];
  const configPath = join(dir, 'sber-designer.json');

  try {
    delete process.env[envName];
    process.env.SBER_DESIGNER_CONFIG_PATH = configPath;
    resetConfigCache();

    await writeFile(join(dir, '.env'), `${envName}=secret-from-dot-env\n`, 'utf8');
    await writeFile(
      configPath,
      JSON.stringify({
        agent: { default: { provider: 'custom', model: 'vision-model' } },
        provider: {
          custom: {
            type: 'openai-compatible',
            name: 'Custom',
            options: { apiKey: `{env:${envName}}` },
            models: {
              'vision-model': { name: 'Vision model', vision: true },
            },
          },
        },
      }),
      'utf8',
    );

    const config = await loadConfig();
    const frontend = toFrontendConfig(config);

    expect(config.provider.custom?.options?.apiKey).toBe('secret-from-dot-env');
    expect(frontend.provider.custom?.options?.apiKey).toBe('__configured__');
    expect(JSON.stringify(frontend)).not.toContain('secret-from-dot-env');
  } finally {
    resetConfigCache();
    if (prevConfigPath === undefined) {
      delete process.env.SBER_DESIGNER_CONFIG_PATH;
    } else {
      process.env.SBER_DESIGNER_CONFIG_PATH = prevConfigPath;
    }
    if (prevEnvValue === undefined) {
      delete process.env[envName];
    } else {
      process.env[envName] = prevEnvValue;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('agent attachment settings can override the SVG prompt attachment limit', () => {
  const config = parseConfig({
    agent: {
      default: { provider: 'custom', model: 'vision-model' },
      attachments: { svgMaxBytes: 8 * 1024 * 1024 },
    },
    provider: {
      custom: {
        type: 'openai-compatible',
        name: 'Custom',
        models: {
          'vision-model': { name: 'Vision model', vision: true },
        },
      },
    },
  });

  expect(config.agent.attachments?.svgMaxBytes).toBe(8 * 1024 * 1024);
});

test('agent concurrency settings can override run limits', () => {
  const config = parseConfig({
    agent: {
      default: { provider: 'custom', model: 'vision-model' },
      concurrency: {
        maxTotalRuns: 7,
        maxApiRuns: 3,
        maxCliRuns: 6,
        sameScreenPolicy: 'reject',
        sameFilePolicy: 'reject',
      },
    },
    provider: {
      custom: {
        type: 'openai-compatible',
        name: 'Custom',
        models: {
          'vision-model': { name: 'Vision model', vision: true },
        },
      },
    },
  });

  expect(agentConcurrencyFromConfig(config)).toMatchObject({
    maxTotalRuns: 7,
    maxApiRuns: 3,
    maxCliRuns: 6,
    sameScreenPolicy: 'reject',
    sameFilePolicy: 'reject',
  });
});

test('agent context budget config resolves warn, degrade, and block thresholds', () => {
  const config = parseConfig({
    agent: {
      default: { provider: 'custom', model: 'text-model' },
      contextBudget: {
        warningTokens: 100_000,
        degradePromptBytes: 40_000,
        blockPromptBytes: 120_000,
      },
    },
    provider: {
      custom: {
        type: 'openai-compatible',
        name: 'Custom',
        models: {
          'text-model': { name: 'Text model' },
        },
      },
    },
  });

  expect(agentContextBudgetFromConfig(config)).toEqual({
    warningTokens: 100_000,
    degradePromptBytes: 40_000,
    blockPromptBytes: 120_000,
  });
  expect(agentContextBudgetFromConfig(null)).toMatchObject({
    warningTokens: 200_000,
  });
});

test('root provider config declares image input support per current model', async () => {
  const raw = await readFile('sber-designer.json', 'utf8');
  const config = parseConfig(JSON.parse(raw), { env: {}, strictEnv: false });

  expect(config.agent.attachments?.svgMaxBytes).toBe(5 * 1024 * 1024);
  expect(agentConcurrencyFromConfig(config)).toMatchObject({
    maxTotalRuns: 10,
    maxApiRuns: 4,
    maxCliRuns: 10,
    sameScreenPolicy: 'reject',
    sameFilePolicy: 'reject',
  });
  const routedProviderModels = Object.values(config.provider.openrouter?.models ?? {});
  expect(config.provider.deepseek?.models?.['deepseek-v4-pro']).toMatchObject({
    vision: false,
    imageInput: {
      transport: 'text-only-with-ocr',
      verification: 'failed-openai-image-url',
      lastFailureCode: 'unknown_variant_image_url_expected_text',
    },
  });
  expect(config.provider.deepseek?.models?.['deepseek-v4-flash']?.vision).toBe(false);
  expect(routedProviderModels.some((model) => model.vision === false)).toBe(true);
  expect(routedProviderModels.some((model) => model.vision === true)).toBe(true);
});

/**
 * 0136 R07 — this used to assert the tracked sber-designer.json contained a
 * stdio MCP server with `cwd: /Users/<author>/...`, which pinned the defect:
 * a config that only works on one machine shipped as the shared template.
 * The same wiring now lives in the untracked sber-designer.local.json overlay,
 * so what is asserted here is the contract instead: the template stays
 * portable, and the overlay still produces the read-oriented Pixso allowlist.
 */
test('root MCP template is portable and the local overlay restores Pixso wiring', async () => {
  const raw = await readFile('sber-designer.json', 'utf8');
  const template = parseConfig(JSON.parse(raw), { env: {}, strictEnv: false });

  expect(template.mcpServers['talk-to-pixso-mcp']).toBeUndefined();
  expect(JSON.stringify(template.mcpServers)).not.toContain('/Users/');
  expect(template.mcpServers['pixso-desktop']?.enabled).toBe(false);

  const overlay = {
    mcpServers: {
      'pixso-desktop': { enabled: true },
      'talk-to-pixso-mcp': {
        type: 'stdio',
        command: 'bun',
        args: ['run', './dist/server.js'],
        cwd: '/somewhere/on/this/machine/simple-pixso-mcp',
        enabled: true,
        connectTool: { tool: 'connect_to_pixso', requiresChannel: false },
        allowedTools: ['connect_to_pixso', 'get_document_info', 'read_my_design', 'set_focus'],
        toolSafety: { set_focus: 'external-effect' },
      },
    },
  };
  const merged = parseConfig(mergeConfigLayers(JSON.parse(raw), overlay), {
    env: {},
    strictEnv: false,
  });
  const server = merged.mcpServers['talk-to-pixso-mcp'];

  expect(server).toMatchObject({
    type: 'stdio',
    command: 'bun',
    args: ['run', './dist/server.js'],
    cwd: '/somewhere/on/this/machine/simple-pixso-mcp',
    enabled: true,
    connectTool: { tool: 'connect_to_pixso', requiresChannel: false },
  });
  expect(server?.allowedTools).toEqual([
    'connect_to_pixso',
    'get_document_info',
    'read_my_design',
    'set_focus',
  ]);
  expect(server?.toolSafety).toMatchObject({ set_focus: 'external-effect' });
  expect(merged.mcpServers['pixso-desktop']?.enabled).toBe(true);
});
