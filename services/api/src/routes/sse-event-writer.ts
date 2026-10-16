export interface SseRawWriter {
  writeSSE(input: { data: string }): Promise<unknown> | unknown;
}

export interface SseEventWriter extends SseRawWriter {
  close(): Promise<void>;
  writeJson(event: unknown): Promise<void>;
}

export interface SseEventWriterOptions {
  heartbeatMs?: number;
  heartbeat?: () => unknown;
}

const DEFAULT_HEARTBEAT_MS = 15_000;

export function createSseEventWriter(
  stream: SseRawWriter,
  options: SseEventWriterOptions = {},
): SseEventWriter {
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const heartbeat = options.heartbeat ?? (() => ({ type: 'heartbeat' }));
  let closed = false;
  let queue = Promise.resolve();

  const writeSSE = (input: { data: string }): Promise<void> => {
    if (closed) return queue;
    queue = queue.then(async () => {
      await stream.writeSSE(input);
    });
    return queue;
  };

  const timer =
    heartbeatMs > 0
      ? setInterval(() => {
          void writeSSE({ data: JSON.stringify(heartbeat()) }).catch(() => undefined);
        }, heartbeatMs)
      : null;

  return {
    writeSSE,
    writeJson: (event: unknown) => writeSSE({ data: JSON.stringify(event) }),
    close: async () => {
      closed = true;
      if (timer) clearInterval(timer);
      await queue.catch(() => undefined);
    },
  };
}
