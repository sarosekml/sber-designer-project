import { Buffer } from 'node:buffer';
import type {
  JiraTrackerConfig,
  LinearTrackerConfig,
  ProjectTask,
  SberDesignerProject,
  TaskTrackerConfig,
  TaskTrackerType,
} from '@sber-designer/shared-types';

import { readLocalEnvValue } from './local-env';

export interface TrackerConnectionResult {
  ok: boolean;
  message: string;
  taskCount?: number;
}

export interface TrackerEnvStatus {
  type: TaskTrackerType;
  ok: boolean;
  missingEnvVars: string[];
}

const COMMENT_TASK_PATTERN = /#\d+|[A-Z]{2,}-\d+|https?:\/\/(linear\.app|.*\.atlassian\.net)\//i;

export async function fetchLinearTasks(
  config: LinearTrackerConfig,
  project: SberDesignerProject,
): Promise<ProjectTask[]> {
  void project;
  const apiKey = envString('LINEAR_API_KEY');
  if (!apiKey) throw new Error('LINEAR_API_KEY is not set.');

  const labelFilter = config.labelFilter?.trim();
  const projectSlugId = linearProjectSlugId(config.projectUrl);
  const request = projectSlugId
    ? linearProjectIssuesRequest(projectSlugId, labelFilter)
    : linearAssignedIssuesRequest(labelFilter);
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const json = (await response.json().catch(() => null)) as LinearIssuesResponse | null;
  if (!response.ok || json?.errors?.length) {
    throw new Error(
      json?.errors?.[0]?.message ?? `Linear request failed with HTTP ${response.status}.`,
    );
  }

  const issues = projectSlugId
    ? (json?.data?.projects?.nodes?.[0]?.issues?.nodes ?? [])
    : (json?.data?.viewer?.assignedIssues?.nodes ?? []);

  return issues.map((issue) => {
    const description = issue.description ?? undefined;
    return {
      id: `linear-${issue.id}`,
      title: issue.title,
      ...(description ? { description } : {}),
      ...(issue.url ? { url: issue.url } : {}),
      source: 'linear',
      screenIds: inferTaskScreenIds(project, [issue.title, description]),
      ...(issue.state?.name ? { status: issue.state.name } : {}),
      ...(issue.priority !== undefined && issue.priority !== null
        ? { priority: String(issue.priority) }
        : {}),
    };
  });
}

export async function fetchJiraTasks(
  config: JiraTrackerConfig,
  project: SberDesignerProject,
): Promise<ProjectTask[]> {
  void project;
  const email = envString('JIRA_EMAIL');
  const apiToken = envString('JIRA_API_TOKEN');
  if (!email || !apiToken) throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set.');

  const baseUrl = jiraBaseUrl(config.projectUrl);
  const jql = [
    'assignee = currentUser()',
    'labels = "sber-designer"',
    config.projectKey ? `project = ${config.projectKey}` : '',
    'ORDER BY priority ASC',
  ]
    .filter(Boolean)
    .join(' AND ')
    .replace(' AND ORDER BY', ' ORDER BY');
  const url = new URL('/rest/api/3/search', baseUrl);
  url.searchParams.set('jql', jql);
  url.searchParams.set('fields', 'summary,description,status,priority');
  url.searchParams.set('maxResults', '50');

  const response = await fetch(url, {
    headers: {
      authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      accept: 'application/json',
    },
  });
  const json = (await response.json().catch(() => null)) as JiraSearchResponse | null;
  if (!response.ok) {
    throw new Error(
      json?.errorMessages?.[0] ?? `Jira request failed with HTTP ${response.status}.`,
    );
  }

  return (json?.issues ?? []).map((issue) => {
    const description = jiraDocumentToText(issue.fields?.description);
    return {
      id: `jira-${issue.id ?? issue.key}`,
      title: issue.fields?.summary || issue.key,
      ...(description ? { description } : {}),
      url: `${baseUrl.replace(/\/+$/, '')}/browse/${issue.key}`,
      source: 'jira',
      screenIds: [],
      ...(issue.fields?.status?.name ? { status: issue.fields.status.name } : {}),
      ...(issue.fields?.priority?.name ? { priority: issue.fields.priority.name } : {}),
    };
  });
}

export async function testLinearConnection(
  config: LinearTrackerConfig,
): Promise<TrackerConnectionResult> {
  const project = emptyProject();
  const tasks = await fetchLinearTasks(config, project);
  return {
    ok: true,
    message: `Connected · ${tasks.length} issue${tasks.length === 1 ? '' : 's'} found`,
    taskCount: tasks.length,
  };
}

export async function testJiraConnection(
  config: JiraTrackerConfig,
): Promise<TrackerConnectionResult> {
  const project = emptyProject();
  const tasks = await fetchJiraTasks(config, project);
  return {
    ok: true,
    message: `Connected · ${tasks.length} issue${tasks.length === 1 ? '' : 's'} found`,
    taskCount: tasks.length,
  };
}

export function extractCommentTasks(project: SberDesignerProject): ProjectTask[] {
  return (project.comments ?? [])
    .filter((comment) => comment.status === 'open')
    .map((comment): ProjectTask | null => {
      const body = comment.messages
        .map((message) => message.body.trim())
        .filter(Boolean)
        .join('\n\n');
      if (!body) return null;
      const ticketLike = COMMENT_TASK_PATTERN.test(body);
      const title = ticketLike ? firstLine(body) : compactLine(body, 80);
      return {
        id: `comment-${comment.id}`,
        title,
        description: body,
        source: 'comment' as const,
        screenIds: [comment.screenId],
        commentId: comment.id,
        status: comment.status,
      };
    })
    .filter((task): task is ProjectTask => task !== null);
}

export function trackerEnvStatus(type: TaskTrackerType): TrackerEnvStatus {
  const missingEnvVars =
    type === 'linear'
      ? envString('LINEAR_API_KEY')
        ? []
        : ['LINEAR_API_KEY']
      : [
          ...(envString('JIRA_EMAIL') ? [] : ['JIRA_EMAIL']),
          ...(envString('JIRA_API_TOKEN') ? [] : ['JIRA_API_TOKEN']),
        ];
  return { type, ok: missingEnvVars.length === 0, missingEnvVars };
}

export async function fetchTrackerTasks(
  config: TaskTrackerConfig,
  project: SberDesignerProject,
): Promise<ProjectTask[]> {
  return config.type === 'linear'
    ? fetchLinearTasks(config, project)
    : fetchJiraTasks(config, project);
}

export async function testTrackerConnection(
  config: TaskTrackerConfig,
): Promise<TrackerConnectionResult> {
  return config.type === 'linear' ? testLinearConnection(config) : testJiraConnection(config);
}

export function dedupeTasks(tasks: ProjectTask[]): ProjectTask[] {
  const seen = new Set<string>();
  const next: ProjectTask[] = [];
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    next.push(task);
  }
  return next;
}

function envString(name: string): string {
  return readLocalEnvValue(name);
}

function linearProjectSlugId(projectUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(projectUrl);
  } catch {
    return undefined;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const projectIndex = parts.findIndex((part) => part.toLowerCase() === 'project');
  return projectIndex >= 0 ? parts[projectIndex + 1] : undefined;
}

function linearProjectIssuesRequest(projectSlugId: string, labelFilter: string | undefined) {
  return {
    query: labelFilter
      ? `
        query ProjectIssues($projectSlugId: String!, $labelFilter: String!) {
          projects(filter: { slugId: { eq: $projectSlugId } }, first: 1) {
            nodes {
              issues(first: 50, filter: { labels: { name: { eq: $labelFilter } } }) {
                nodes {
                  id
                  title
                  description
                  url
                  state { name }
                  priority
                }
              }
            }
          }
        }
      `
      : `
        query ProjectIssues($projectSlugId: String!) {
          projects(filter: { slugId: { eq: $projectSlugId } }, first: 1) {
            nodes {
              issues(first: 50) {
                nodes {
                  id
                  title
                  description
                  url
                  state { name }
                  priority
                }
              }
            }
          }
        }
      `,
    variables: {
      projectSlugId,
      ...(labelFilter ? { labelFilter } : {}),
    },
  };
}

function linearAssignedIssuesRequest(labelFilter: string | undefined) {
  return {
    query: labelFilter
      ? `
        query AssignedIssues($labelFilter: String!) {
          viewer {
            assignedIssues(first: 50, filter: { labels: { name: { eq: $labelFilter } } }) {
              nodes {
                id
                title
                description
                url
                state { name }
                priority
              }
            }
          }
        }
      `
      : `
        query AssignedIssues {
          viewer {
            assignedIssues(first: 50) {
              nodes {
                id
                title
                description
                url
                state { name }
                priority
              }
            }
          }
        }
      `,
    variables: labelFilter ? { labelFilter } : {},
  };
}

function jiraBaseUrl(projectUrl: string): string {
  const parsed = new URL(projectUrl);
  return `${parsed.protocol}//${parsed.host}`;
}

function firstLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .find((line) => line.trim())
      ?.trim() ?? 'Comment task'
  );
}

function compactLine(value: string, max: number): string {
  const compacted = value.replace(/\s+/g, ' ').trim();
  return compacted.length > max ? `${compacted.slice(0, max - 3)}...` : compacted;
}

function inferTaskScreenIds(project: SberDesignerProject, values: (string | undefined)[]) {
  const haystack = normalizeSearchText(values.filter(Boolean).join('\n'));
  if (!haystack) return [];
  return project.screens
    .filter((screen) => {
      const name = normalizeSearchText(screen.name);
      return name.length >= 4 && haystack.includes(name);
    })
    .map((screen) => screen.id);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function jiraDocumentToText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  const record = value as { text?: unknown; content?: unknown };
  const ownText = typeof record.text === 'string' ? record.text : '';
  const childText = Array.isArray(record.content)
    ? record.content.map(jiraDocumentToText).filter(Boolean).join(' ')
    : '';
  return [ownText, childText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function emptyProject(): SberDesignerProject {
  return {
    version: 1,
    name: 'Connection test',
    workspacePath: '',
    screens: [],
    flow: [],
  };
}

interface LinearIssuesResponse {
  data?: {
    projects?: {
      nodes?: {
        issues?: {
          nodes?: LinearIssueNode[];
        };
      }[];
    };
    viewer?: {
      assignedIssues?: {
        nodes?: LinearIssueNode[];
      };
    };
  };
  errors?: { message?: string }[];
}

interface LinearIssueNode {
  id: string;
  title: string;
  description?: string | null;
  url?: string | null;
  state?: { name?: string | null } | null;
  priority?: number | null;
}

interface JiraSearchResponse {
  issues?: {
    id?: string;
    key: string;
    fields?: {
      summary?: string;
      description?: unknown;
      status?: { name?: string };
      priority?: { name?: string };
    };
  }[];
  errorMessages?: string[];
}
