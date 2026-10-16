import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentStreamEvent } from '../../../services/api/src/agent/stream';

export interface MockOpenCodeWritesScreenInput {
  workspacePath: string;
  targetPath: string;
  source?: string;
}

export async function* mockOpenCodeWritesScreen(
  input: MockOpenCodeWritesScreenInput,
): AsyncGenerator<AgentStreamEvent> {
  yield {
    type: 'status',
    iteration: 1,
    message: 'OpenCode connected · model ready',
  };
  yield {
    type: 'usage',
    iteration: 1,
    usage: {
      inputTokens: 700,
      outputTokens: 106,
    },
  };
  await writeFile(
    join(input.workspacePath, input.targetPath),
    input.source ??
      [
        'export function Admin() {',
        '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
        '}',
        '',
      ].join('\n'),
    'utf8',
  );
  yield {
    type: 'done',
    transcript: [{ role: 'assistant', content: 'Implemented the active screen.' }],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    usage: {
      inputTokens: 700,
      outputTokens: 106,
    },
    finalResponse: {
      text: 'Implemented the active screen.',
      provider: 'opencode-runtime',
      model: 'mock-opencode',
      finishReason: 'stop',
      usage: {
        inputTokens: 700,
        outputTokens: 106,
      },
    },
  };
}
