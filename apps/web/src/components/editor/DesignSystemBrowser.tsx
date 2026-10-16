import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Copy,
  FileCode2,
  Loader2,
  MessageSquareText,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  addProjectComponentNote,
  deleteProjectComponentNote,
  saveProjectSetupAnswers,
  updateProjectComponentNote,
  type ProjectComponentAgentNote,
  type ProjectDesignSystemBrowser,
} from '@/lib/api-client';
import {
  buildDesignSystemBrowserItems,
  filterDesignSystemBrowserItems,
  type DesignSystemBrowserCategory,
  type DesignSystemBrowserItem,
} from '@/lib/design-system-browser';
import { cn } from '@/lib/utils';

const CATEGORIES: { id: DesignSystemBrowserCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'components', label: 'Components' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'icons', label: 'Icons' },
  { id: 'assets', label: 'Assets' },
  { id: 'screens', label: 'Screens' },
  { id: 'routes', label: 'Routes' },
  { id: 'notes', label: 'Notes' },
  { id: 'health', label: 'Health' },
];

export function DesignSystemBrowser({
  browser,
  loading,
  running,
  workspacePath,
  onRefresh,
  onRunProfiler,
  onChanged,
}: {
  browser: ProjectDesignSystemBrowser | null;
  loading: boolean;
  running: boolean;
  workspacePath?: string;
  onRefresh: () => void;
  onRunProfiler: () => void;
  onChanged: () => void;
}) {
  const [category, setCategory] = useState<DesignSystemBrowserCategory>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answersBusy, setAnswersBusy] = useState(false);
  const [answersMessage, setAnswersMessage] = useState<string | null>(null);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const items = useMemo(() => buildDesignSystemBrowserItems(browser), [browser]);
  const filteredItems = useMemo(
    () => filterDesignSystemBrowserItems(items, { category, query }),
    [category, items, query],
  );
  const selected =
    items.find((item) => item.id === selectedId) ?? filteredItems[0] ?? items[0] ?? null;

  useEffect(() => {
    if (selectedId && items.some((item) => item.id === selectedId)) return;
    setSelectedId(filteredItems[0]?.id ?? items[0]?.id ?? null);
  }, [filteredItems, items, selectedId]);

  const profile = browser?.projectProfile;
  const setupQuestions = browser?.setupQuestions ?? [];
  const missingQuestions =
    browser?.setupQuestions.filter((question) => question.status === 'missing') ?? [];
  const status = browser?.context.projectSystem?.freshness ?? browser?.context.status ?? 'missing';
  const changedAnswers = setupQuestions.filter((question) => {
    const base = question.confirmedAnswer ?? question.detectedAnswer ?? '';
    return (answerDrafts[question.id] ?? '') !== base;
  });

  useEffect(() => {
    if (!browser) {
      setAnswerDrafts({});
      return;
    }
    setAnswerDrafts(
      Object.fromEntries(
        browser.setupQuestions.map((question) => [
          question.id,
          question.confirmedAnswer ?? question.detectedAnswer ?? '',
        ]),
      ),
    );
    setAnswersMessage(null);
    setAnswersError(null);
  }, [browser]);

  const saveAnswers = async () => {
    if (changedAnswers.length === 0 || answersBusy) return;
    setAnswersBusy(true);
    setAnswersMessage(null);
    setAnswersError(null);
    try {
      const input: {
        workspacePath?: string;
        answers: { id: string; answer: string | null }[];
      } = {
        answers: changedAnswers.map((question) => ({
          id: question.id,
          answer: answerDrafts[question.id]?.trim() || null,
        })),
      };
      if (workspacePath) input.workspacePath = workspacePath;
      const result = await saveProjectSetupAnswers(input);
      setAnswersMessage(
        result.changedFiles.length > 0
          ? `Saved ${changedAnswers.length} shared setup answer${changedAnswers.length === 1 ? '' : 's'}.`
          : 'Shared setup answers are already up to date.',
      );
      onChanged();
    } catch (err) {
      setAnswersError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnswersBusy(false);
    }
  };

  return (
    <section className="grid min-w-0 gap-3 rounded-md border border-border bg-background p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Boxes className="size-4 text-primary" />
            Design System Browser
            <BrowserBadge tone={status === 'ready' || status === 'valid' ? 'ok' : 'warn'}>
              {status}
            </BrowserBadge>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            AI-aware project index browser. Storybook is used when available, but this view also
            includes static components, tokens, routes, screens, assets, health, and agent notes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={onRunProfiler} disabled={running || loading}>
            {running ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            Run setup profiler
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="grid min-w-0 gap-3">
          <div className="grid min-w-0 gap-2 rounded-md border border-border bg-card p-3 text-xs">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <BrowserBadge tone={profile ? 'ok' : 'warn'}>
                {profile ? profile.packageManager : 'profile missing'}
              </BrowserBadge>
              <span className="min-w-0 truncate text-muted-foreground">
                {profile?.frameworks.join(', ') || 'No frameworks detected'}
              </span>
              <span className="ml-auto text-muted-foreground">
                {missingQuestions.length} unresolved
              </span>
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <MiniFact label="Project kind" value={profile?.kind ?? 'unknown'} />
              {profile?.kind === 'html-css' && (
                <MiniFact
                  label="HTML DS sources"
                  value={htmlDesignSystemLabel(profile.htmlDesignSystem)}
                />
              )}
              <MiniFact
                label="Screen unit"
                value={
                  profile
                    ? `${profile.screenUnit.storyRequired ? 'Story required' : 'No story'} · ${profile.screenUnit.sourceGlob}`
                    : 'unknown'
                }
              />
              <MiniFact label="Render probe" value={profile?.renderProbe ?? 'unknown'} />
              <MiniFact label="Source roots" value={profile?.sourceRoots.join(', ') || 'unknown'} />
              <MiniFact label="Styling" value={profile?.styling.join(', ') || 'unknown'} />
              <MiniFact
                label="Storybook"
                value={browser?.storybook?.exists ? 'detected' : 'not detected'}
              />
            </div>
            {missingQuestions.length > 0 && (
              <div className="rounded border border-warning/30 bg-warning/10 px-2 py-1.5 text-muted-foreground">
                Missing: {missingQuestions.map((question) => question.label).join(', ')}
              </div>
            )}
            {setupQuestions.length > 0 && (
              <div className="grid gap-2 border-t border-border pt-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-medium text-foreground">Setup answers</span>
                  <span className="text-muted-foreground">
                    {changedAnswers.length > 0
                      ? `${changedAnswers.length} changed`
                      : 'no pending changes'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="ml-auto"
                    disabled={answersBusy || changedAnswers.length === 0}
                    onClick={() => void saveAnswers()}
                  >
                    {answersBusy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3" />
                    )}
                    Save shared answers
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {setupQuestions.map((question) => (
                    <label key={question.id} className="grid min-w-0 gap-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[11px] font-medium text-foreground">
                          {question.label}
                        </span>
                        <BrowserBadge tone={question.status === 'confirmed' ? 'ok' : 'warn'}>
                          {question.status}
                        </BrowserBadge>
                      </span>
                      <input
                        value={answerDrafts[question.id] ?? ''}
                        onChange={(event) =>
                          setAnswerDrafts((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        placeholder={question.detectedAnswer ?? question.reason}
                        className="min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                      {question.detectedAnswer &&
                        question.confirmedAnswer &&
                        question.detectedAnswer !== question.confirmedAnswer && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            Detected: {question.detectedAnswer}
                          </span>
                        )}
                    </label>
                  ))}
                </div>
                {answersMessage && <div className="text-success">{answersMessage}</div>}
                {answersError && <div className="text-destructive-foreground">{answersError}</div>}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  category === item.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search components, tokens, routes, notes..."
              className="min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="grid max-h-[460px] min-w-0 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  'grid min-h-32 min-w-0 content-between rounded-md border p-3 text-left text-xs transition-colors',
                  selected?.id === item.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <PreviewBlock item={item} compact />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <KindIcon kind={item.kind} />
                    <span className="truncate font-medium text-foreground">{item.title}</span>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-muted-foreground">
                    {item.subtitle}
                  </span>
                  {item.descriptionView && (
                    <span className="mt-2 grid min-w-0 gap-1">
                      <span className="line-clamp-2 text-muted-foreground">
                        {item.descriptionView.purpose}
                      </span>
                      <span className="flex min-w-0 flex-wrap gap-1">
                        <BrowserBadge tone={item.descriptionView.diverged ? 'warn' : 'ok'}>
                          {item.descriptionView.provenance}
                        </BrowserBadge>
                        {item.descriptionView.diverged && (
                          <BrowserBadge tone="warn">diverged</BrowserBadge>
                        )}
                      </span>
                    </span>
                  )}
                </span>
                <span className="mt-3 flex min-w-0 items-center gap-2 text-muted-foreground">
                  <BrowserBadge tone={item.status === 'ready' ? 'ok' : 'warn'}>
                    {item.kind}
                  </BrowserBadge>
                  <span className="truncate">{item.meta}</span>
                  {item.noteCount ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      <MessageSquareText className="size-3" />
                      {item.noteCount}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-xs text-muted-foreground sm:col-span-2 xl:col-span-3">
                No indexed records match this filter.
              </div>
            )}
          </div>
        </div>

        <BrowserDetail item={selected} workspacePath={workspacePath} onChanged={onChanged} />
      </div>
    </section>
  );
}

function BrowserDetail({
  item,
  workspacePath,
  onChanged,
}: {
  item: DesignSystemBrowserItem | null;
  workspacePath?: string | undefined;
  onChanged: () => void;
}) {
  const [intent, setIntent] = useState<ProjectComponentAgentNote['intent']>('usage');
  const [note, setNote] = useState('');
  const [editIntent, setEditIntent] = useState<ProjectComponentAgentNote['intent']>('usage');
  const [editNote, setEditNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIntent('usage');
    setNote('');
    setEditIntent(item?.noteIntent ?? 'usage');
    setEditNote(item?.noteText ?? '');
    setMessage(null);
    setError(null);
  }, [item?.id, item?.noteIntent, item?.noteText]);

  const canComment = item?.kind === 'component' && Boolean(item.componentId);
  const canEditNote = item?.kind === 'note' && Boolean(item.noteId);

  const saveNote = async () => {
    if (!item?.componentId || !note.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const input: {
        workspacePath?: string;
        componentId: string;
        note: string;
        intent: ProjectComponentAgentNote['intent'];
        sourcePath?: string;
      } = {
        componentId: item.componentId,
        intent,
        note: note.trim(),
      };
      if (workspacePath) input.workspacePath = workspacePath;
      if (item.sourcePath) input.sourcePath = item.sourcePath;
      await addProjectComponentNote(input);
      setNote('');
      setMessage('Saved to agent notes and refreshed the project index.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const updateNote = async () => {
    if (!item?.noteId || !editNote.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const input: {
        workspacePath?: string;
        note: string;
        intent: ProjectComponentAgentNote['intent'];
      } = {
        note: editNote.trim(),
        intent: editIntent,
      };
      if (workspacePath) input.workspacePath = workspacePath;
      await updateProjectComponentNote(item.noteId, input);
      setMessage('Updated agent note.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteNote = async () => {
    if (!item?.noteId || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await deleteProjectComponentNote(item.noteId, workspacePath ? { workspacePath } : {});
      setMessage('Deleted agent note.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!item) {
    return (
      <aside className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        Select an indexed record.
      </aside>
    );
  }

  return (
    <aside className="grid min-w-0 content-start gap-3 rounded-md border border-border bg-card p-3 text-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <KindIcon kind={item.kind} />
          <span className="min-w-0 truncate font-medium text-foreground">{item.title}</span>
        </div>
        <p className="mt-1 break-words text-muted-foreground">{item.subtitle}</p>
      </div>

      <PreviewBlock item={item} />

      {item.descriptionView && (
        <div className="grid min-w-0 gap-2 rounded-md border border-border bg-background p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">Description for AI</span>
            <BrowserBadge tone={item.descriptionView.diverged ? 'warn' : 'ok'}>
              {item.descriptionView.provenance}
            </BrowserBadge>
            <BrowserBadge tone={item.descriptionView.status === 'confirmed' ? 'ok' : 'warn'}>
              {item.descriptionView.status}
            </BrowserBadge>
            {item.descriptionView.diverged && <BrowserBadge tone="warn">diverged</BrowserBadge>}
          </div>
          <p className="break-words text-muted-foreground">{item.descriptionView.purpose}</p>
          {item.descriptionView.keywords.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-1">
              {item.descriptionView.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
          {item.descriptionView.guidance.length > 0 && (
            <ul className="grid gap-1 text-muted-foreground">
              {item.descriptionView.guidance.slice(0, 3).map((guidance) => (
                <li key={guidance} className="break-words">
                  {guidance}
                </li>
              ))}
            </ul>
          )}
          {item.descriptionView.diagnostics.length > 0 && (
            <div className="rounded border border-warning/30 bg-warning/10 px-2 py-1.5 text-warning">
              {item.descriptionView.diagnostics.join(' ')}
            </div>
          )}
        </div>
      )}

      {item.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyText(action.value, setMessage)}
            >
              <Copy className="size-3" />
              {action.label}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-2">
        {item.details.map((detail) => (
          <div key={detail.label} className="grid min-w-0 gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {detail.label}
            </span>
            <span className="break-words font-mono text-[11px] text-foreground">
              {detail.value}
            </span>
          </div>
        ))}
      </div>

      {canComment && (
        <div className="grid gap-2 border-t border-border pt-3">
          <div className="font-medium text-foreground">Comment for AI agents</div>
          <select
            value={intent}
            onChange={(event) =>
              setIntent(event.target.value as ProjectComponentAgentNote['intent'])
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none"
          >
            <option value="usage">Usage note</option>
            <option value="prefer">Prefer this component</option>
            <option value="avoid">Avoid for this case</option>
            <option value="requirement">Requirement</option>
            <option value="deprecated">Deprecated</option>
            <option value="other">Other</option>
          </select>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Example: Prefer this component for dense finance tables."
            rows={4}
            className="resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none"
          />
          {message && <div className="text-success">{message}</div>}
          {error && <div className="text-destructive-foreground">{error}</div>}
          <Button size="sm" onClick={() => void saveNote()} disabled={!note.trim() || busy}>
            {busy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <MessageSquareText className="size-3" />
            )}
            Save comment
          </Button>
        </div>
      )}

      {canEditNote && (
        <div className="grid gap-2 border-t border-border pt-3">
          <div className="font-medium text-foreground">Edit agent note</div>
          <select
            value={editIntent}
            onChange={(event) =>
              setEditIntent(event.target.value as ProjectComponentAgentNote['intent'])
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none"
          >
            <option value="usage">Usage note</option>
            <option value="prefer">Prefer</option>
            <option value="avoid">Avoid</option>
            <option value="requirement">Requirement</option>
            <option value="deprecated">Deprecated</option>
            <option value="other">Other</option>
          </select>
          <textarea
            value={editNote}
            onChange={(event) => setEditNote(event.target.value)}
            rows={4}
            className="resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void updateNote()} disabled={!editNote.trim() || busy}>
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              Save note
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void deleteNote()}
              disabled={busy}
            >
              <Trash2 className="size-3" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}

async function copyText(value: string, onMessage: (message: string | null) => void) {
  await navigator.clipboard?.writeText(value).catch(() => undefined);
  onMessage('Copied to clipboard.');
}

function PreviewBlock({
  item,
  compact = false,
}: {
  item: DesignSystemBrowserItem;
  compact?: boolean;
}) {
  if (item.preview.kind === 'color') {
    return (
      <div
        className={cn(
          'mb-3 rounded-md border border-border bg-background p-2',
          compact ? 'h-12' : 'h-20',
        )}
      >
        <div
          className="h-full rounded border border-border"
          style={{ background: item.preview.value ?? 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mb-3 grid place-items-center rounded-md border border-border bg-background p-2 text-center',
        compact ? 'h-12' : 'h-20',
      )}
    >
      {item.preview.kind === 'health' ? (
        <CheckCircle2 className="size-5 text-success" />
      ) : item.preview.kind === 'note' ? (
        <MessageSquareText className="size-5 text-primary" />
      ) : item.preview.kind === 'token' ? (
        <Palette className="size-5 text-primary" />
      ) : (
        <FileCode2 className="size-5 text-primary" />
      )}
      {!compact && (
        <div className="mt-1 max-w-full truncate text-[11px] text-muted-foreground">
          {item.preview.label}
        </div>
      )}
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{value}</div>
    </div>
  );
}

function htmlDesignSystemLabel(
  htmlDesignSystem: NonNullable<ProjectDesignSystemBrowser['projectProfile']>['htmlDesignSystem'],
) {
  if (!htmlDesignSystem) return 'missing';
  if (htmlDesignSystem.status === 'canonical' || htmlDesignSystem.status === 'connected') {
    return 'canonical';
  }
  if (htmlDesignSystem.status === 'non-canonical') return 'restructure required';
  return `missing: ${htmlDesignSystem.missingRequired.join(', ')}`;
}

function BrowserBadge({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone === 'ok'
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-warning/40 bg-warning/10 text-warning',
      )}
    >
      {children}
    </span>
  );
}

function KindIcon({ kind }: { kind: DesignSystemBrowserItem['kind'] }) {
  if (kind === 'health') return <CheckCircle2 className="size-3.5 text-success" />;
  if (kind === 'note') return <MessageSquareText className="size-3.5 text-primary" />;
  return <FileCode2 className="size-3.5 text-primary" />;
}
