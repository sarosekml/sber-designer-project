import type { ProjectTask } from '@sber-designer/shared-types';

export function buildAutoTaskPrompt(task: ProjectTask): string {
  return [
    `[auto-mode] Task: ${task.title}`,
    `Source: ${task.source}${task.url ? ` ${task.url}` : ''}`,
    task.description?.trim() ?? '',
    task.screenIds.length > 0 ? `Screen IDs: ${task.screenIds.join(', ')}` : '',
    task.commentId ? `Comment ID: ${task.commentId}` : '',
    `Read the task carefully and make all required changes. The task description
will reference the screen(s) or UI elements by name -- use those names to
locate the right files. When all changes for this task are complete, stop.
Do not create a git commit or PR -- the editor will handle that automatically.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function autoBranchName(taskId: string): string {
  return `auto/${taskId.replace(/[^a-z0-9._/-]+/gi, '-').replace(/^-+|-+$/g, '') || 'task'}`;
}
