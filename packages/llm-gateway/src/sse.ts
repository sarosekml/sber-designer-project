/**
 * Tiny line-oriented SSE parser. Reads `data: <json>\n` chunks from a
 * fetch ReadableStream and yields the JSON payloads. `data: [DONE]`
 * terminates the stream silently.
 *
 * No deps — sufficient for OpenAI / Anthropic / vLLM / GigaChat SSE.
 */

export interface SseChunk {
  data: string;
}

export async function* readSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIdx;
      while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 2);
        if (!frame) continue;
        const dataLines = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim());
        if (dataLines.length === 0) continue;
        const data = dataLines.join('\n');
        if (data === '[DONE]') return;
        yield { data };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
