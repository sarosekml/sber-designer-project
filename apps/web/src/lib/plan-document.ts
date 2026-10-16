import type { ChatMessage } from '@/stores/chat-store';

const PLAN_PATH_PATTERN =
  /(?:^|[\s"'`(])((?:\.sber-designer\/plans\/)[A-Za-z0-9._/-]+\.md)(?=$|[\s"'`),])/gu;

export function isSafePlanDocumentPath(path: string): boolean {
  const normalized = path.replace(/\\/gu, '/');
  return (
    normalized.startsWith('.sber-designer/plans/') &&
    normalized.endsWith('.md') &&
    !normalized.split('/').includes('..')
  );
}

export function findLatestPlanDocumentPath(messages: readonly ChatMessage[]): string | null {
  const paths: string[] = [];
  for (const message of messages) {
    for (const match of message.content.matchAll(PLAN_PATH_PATTERN)) {
      const path = match[1];
      if (path && isSafePlanDocumentPath(path)) paths.push(path);
    }
    for (const call of message.toolCalls ?? []) {
      try {
        const parsed = JSON.parse(call.arguments) as { path?: unknown };
        if (typeof parsed.path === 'string' && isSafePlanDocumentPath(parsed.path)) {
          paths.push(parsed.path);
        }
      } catch {
        // Tool argument fragments can be incomplete while a run is streaming.
      }
    }
  }
  return paths.at(-1) ?? null;
}

export function generateFromPlanPrompt(path: string): string {
  return `Use \`${path}\` as the reviewed source of truth. Revalidate the current project component map, resolve exact component contracts and variants, then implement and validate the result.`;
}

export function refinePlanPrompt(path: string): string {
  return `Open \`${path}\`, refine it using my next feedback, and keep all changes inside that plan document.`;
}
