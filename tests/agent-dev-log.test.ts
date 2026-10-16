import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  createAgentAttemptLogger,
  createAgentDevRunLogger,
} from '../services/api/src/agent/dev-log';

test('agent dev log records project, active screen, selection, and tool results as jsonl', async () => {
  const previousDir = process.env.SBER_DESIGNER_AGENT_LOG_DIR;
  const previousFlag = process.env.SBER_DESIGNER_AGENT_DEV_LOG;
  const dir = await mkdtemp(join(tmpdir(), 'sd-agent-log-test-'));
  process.env.SBER_DESIGNER_AGENT_LOG_DIR = dir;
  process.env.SBER_DESIGNER_AGENT_DEV_LOG = '1';

  try {
    const logger = await createAgentDevRunLogger({
      route: 'chat-stream',
      user: 'test-user',
      provider: 'test-provider',
      model: 'test-model',
      maxIterations: 10,
      state: {
        mode: 'design',
        projectName: 'demo-project-experiments',
        workspacePath: '/work/demo-project-experiments',
        activeScreen: {
          id: 'screen-ai-analysis',
          name: 'AI Analysis',
          kind: 'story',
          storyId: 'screens-demo--ai-analysis-screen',
          folder: 'Demo',
        },
        selection: {
          loc: 'dom://button',
          tagName: 'BUTTON',
          text: 'Generate memo',
          rect: { x: 1, y: 2, width: 3, height: 4 },
        },
      },
      messages: [{ role: 'user', content: 'Rename the selected button' }],
    });

    expect(logger).not.toBeNull();
    await logger!.log('tool.result', {
      iteration: 1,
      tool: 'read_file',
      status: 'ok',
      result: 'src/pages/AiAnalysis.tsx',
    });

    const lines = (await readFile(logger!.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(lines[0].event).toBe('run.start');
    expect(lines[0].context.project.name).toBe('demo-project-experiments');
    expect(lines[0].context.activeScreen.name).toBe('AI Analysis');
    expect(lines[0].context.selection.text).toBe('Generate memo');
    expect(lines[0].messages[0].content).toBe('Rename the selected button');
    expect(lines[1]).toMatchObject({
      event: 'tool.result',
      iteration: 1,
      tool: 'read_file',
      status: 'ok',
    });
  } finally {
    if (previousDir === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_LOG_DIR;
    } else {
      process.env.SBER_DESIGNER_AGENT_LOG_DIR = previousDir;
    }
    if (previousFlag === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_DEV_LOG;
    } else {
      process.env.SBER_DESIGNER_AGENT_DEV_LOG = previousFlag;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('agent attempt log records preflight failures before the agent loop starts', async () => {
  const previousDir = process.env.SBER_DESIGNER_AGENT_LOG_DIR;
  const previousFlag = process.env.SBER_DESIGNER_AGENT_DEV_LOG;
  const dir = await mkdtemp(join(tmpdir(), 'sd-agent-attempt-log-test-'));
  process.env.SBER_DESIGNER_AGENT_LOG_DIR = dir;
  process.env.SBER_DESIGNER_AGENT_DEV_LOG = '1';

  try {
    const logger = await createAgentAttemptLogger({
      route: 'chat-stream',
      user: 'test-user',
      provider: 'opencode-runtime',
      model: 'providerA/selected-model',
      agentTarget: {
        targetKind: 'cli',
        runtimeKind: 'opencode',
        imageInputMode: 'cli-files-warning',
        rasterImageInput: false,
        svgSourceInput: true,
        nativeFileInput: false,
        projectMcpTools: false,
        ownMcpConfig: true,
      },
      userGoal: 'Generate the current screen',
      messageCount: 1,
      state: {
        mode: 'design',
        projectName: 'ibp-ui-kit',
        workspacePath: '/work/ibp-ui-kit',
        activeScreen: {
          id: 'screen-new',
          name: 'New screen',
          kind: 'project-file',
          implementationFilePath: 'src/screens/NewScreen.tsx',
        },
      },
    });

    expect(logger).not.toBeNull();
    expect(logger!.attemptId.startsWith('attempt-')).toBe(true);
    await logger!.log('preflight.rejected', {
      status: 'rejected',
      errorCode: 'runtime_not_connected',
    });

    const lines = (await readFile(logger!.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(lines[0]).toMatchObject({
      event: 'attempt.start',
      attemptId: logger!.attemptId,
      route: 'chat-stream',
      user: 'test-user',
      provider: 'opencode-runtime',
      model: 'providerA/selected-model',
      agentTarget: {
        targetKind: 'cli',
        runtimeKind: 'opencode',
        imageInputMode: 'cli-files-warning',
        rasterImageInput: false,
        svgSourceInput: true,
        nativeFileInput: false,
        projectMcpTools: false,
        ownMcpConfig: true,
      },
      userGoal: 'Generate the current screen',
      messageCount: 1,
      context: {
        project: {
          name: 'ibp-ui-kit',
          workspacePath: '/work/ibp-ui-kit',
        },
        activeScreen: {
          id: 'screen-new',
          implementationFilePath: 'src/screens/NewScreen.tsx',
        },
      },
    });
    expect(lines[1]).toMatchObject({
      event: 'preflight.rejected',
      attemptId: logger!.attemptId,
      status: 'rejected',
      errorCode: 'runtime_not_connected',
    });
  } finally {
    if (previousDir === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_LOG_DIR;
    } else {
      process.env.SBER_DESIGNER_AGENT_LOG_DIR = previousDir;
    }
    if (previousFlag === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_DEV_LOG;
    } else {
      process.env.SBER_DESIGNER_AGENT_DEV_LOG = previousFlag;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('agent attempt and dev-run logs cross-link each other and the run manifest', async () => {
  const previousDir = process.env.SBER_DESIGNER_AGENT_LOG_DIR;
  const previousFlag = process.env.SBER_DESIGNER_AGENT_DEV_LOG;
  const dir = await mkdtemp(join(tmpdir(), 'sd-agent-log-link-test-'));
  process.env.SBER_DESIGNER_AGENT_LOG_DIR = dir;
  process.env.SBER_DESIGNER_AGENT_DEV_LOG = '1';

  try {
    const attemptLogger = await createAgentAttemptLogger({
      route: 'chat-stream',
      user: 'test-user',
      provider: 'opencode-runtime',
      model: 'providerA/selected-model',
      state: {
        mode: 'design',
        projectName: 'ibp-ui-kit',
        workspacePath: '/work/ibp-ui-kit',
      },
      userGoal: 'Generate the current screen',
      messageCount: 1,
    });
    const devLogger = await createAgentDevRunLogger({
      route: 'chat-stream',
      user: 'test-user',
      provider: 'opencode-runtime',
      model: 'providerA/selected-model',
      state: {
        mode: 'design',
        projectName: 'ibp-ui-kit',
        workspacePath: '/work/ibp-ui-kit',
      },
      messages: [{ role: 'user', content: 'Generate the current screen' }],
      maxIterations: 6,
    });

    expect(attemptLogger).not.toBeNull();
    expect(devLogger).not.toBeNull();

    const runManifestPath = '.sber-designer/runs/run-123/run-manifest.json';
    await attemptLogger!.logLink({
      runId: 'run-123',
      devLogPath: devLogger!.filePath,
      runManifestPath,
    });
    await devLogger!.logLink({
      attemptId: attemptLogger!.attemptId,
      attemptLogPath: attemptLogger!.filePath,
      runManifestPath,
    });

    const attemptLines = (await readFile(attemptLogger!.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const devLines = (await readFile(devLogger!.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(attemptLines.at(-1)).toMatchObject({
      event: 'attempt.linked_run',
      runId: 'run-123',
      devLogPath: devLogger!.filePath,
      runManifestPath,
    });
    expect(devLines.at(-1)).toMatchObject({
      event: 'run.linked_attempt',
      attemptId: attemptLogger!.attemptId,
      attemptLogPath: attemptLogger!.filePath,
      runManifestPath,
    });
  } finally {
    if (previousDir === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_LOG_DIR;
    } else {
      process.env.SBER_DESIGNER_AGENT_LOG_DIR = previousDir;
    }
    if (previousFlag === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_DEV_LOG;
    } else {
      process.env.SBER_DESIGNER_AGENT_DEV_LOG = previousFlag;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
