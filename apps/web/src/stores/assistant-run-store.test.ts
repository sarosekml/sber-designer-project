import { expect, test } from 'bun:test';

import { selectAssistantRunsList, useAssistantRunStore } from './assistant-run-store';

test('tracks active runs by screen and session', () => {
  useAssistantRunStore.getState().reset();
  useAssistantRunStore.getState().upsertRun({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    status: 'running',
    startedAt: 1,
    updatedAt: 1,
  });

  expect(useAssistantRunStore.getState().hasActiveRunForScreen('screen-a')).toBe(true);
  expect(useAssistantRunStore.getState().runForSession('session-a')).toMatchObject({
    clientRunId: 'client-a',
    status: 'running',
  });
});

test('removes runs and local cancel handlers when a run finishes', () => {
  useAssistantRunStore.getState().reset();
  let cancelled = false;
  useAssistantRunStore.getState().upsertRun({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    status: 'running',
    startedAt: 1,
    updatedAt: 1,
  });
  useAssistantRunStore.getState().setLocalCancel('client-a', () => {
    cancelled = true;
  });

  expect(useAssistantRunStore.getState().cancelLocal('client-a')).toBe(true);
  expect(cancelled).toBe(true);

  useAssistantRunStore.getState().finishRun('client-a');
  expect(useAssistantRunStore.getState().runsForScreen('screen-a')).toEqual([]);
  expect(useAssistantRunStore.getState().cancelLocal('client-a')).toBe(false);
});

test('keeps the runs list selector stable while the runs map is unchanged', () => {
  useAssistantRunStore.getState().reset();

  const empty = selectAssistantRunsList(useAssistantRunStore.getState());
  expect(selectAssistantRunsList(useAssistantRunStore.getState())).toBe(empty);

  useAssistantRunStore.getState().setLocalCancel('client-a', () => undefined);
  expect(selectAssistantRunsList(useAssistantRunStore.getState())).toBe(empty);

  useAssistantRunStore.getState().upsertRun({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    status: 'running',
    startedAt: 1,
    updatedAt: 1,
  });

  const withRun = selectAssistantRunsList(useAssistantRunStore.getState());
  expect(withRun).not.toBe(empty);
  expect(withRun).toHaveLength(1);
  expect(selectAssistantRunsList(useAssistantRunStore.getState())).toBe(withRun);
});
