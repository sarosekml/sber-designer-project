import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { AgentRuntimeModel, RuntimeDiagnostic } from './types';

const MAX_STATE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_MODELS = 100;
const MAX_MODEL_ID_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 200;
const SAFE_MODEL_ID = /^[A-Za-z0-9._:@/-]+$/;

export interface GigaCodeStateSnapshot {
  auth: 'missing' | 'invalid' | 'expired' | 'ready';
  expiresAt?: number;
  configuredModel?: string;
  models: AgentRuntimeModel[];
  diagnostics: RuntimeDiagnostic[];
}

interface ReadGigaCodeStateOptions {
  stateDir?: string;
  now?: () => number;
}

type JsonReadResult =
  | { kind: 'missing' }
  | { kind: 'invalid'; code: string; message: string }
  | { kind: 'value'; value: unknown };

export function defaultGigaCodeStateDir(): string {
  const configured = process.env.SBER_DESIGNER_GIGACODE_HOME?.trim();
  return configured || join(homedir(), '.gigacode');
}

export async function readGigaCodeState(
  options: ReadGigaCodeStateOptions = {},
): Promise<GigaCodeStateSnapshot> {
  const stateDir = options.stateDir ?? defaultGigaCodeStateDir();
  const now = options.now?.() ?? Date.now();
  const tokenState = await readJsonStateFile(
    join(stateDir, 'gigacode_token.json'),
    'gigacode_state_invalid',
    'GigaCode authentication state is unreadable or invalid.',
  );

  if (tokenState.kind === 'missing') {
    return { auth: 'missing', models: [], diagnostics: [] };
  }
  if (tokenState.kind === 'invalid') {
    return {
      auth: 'invalid',
      models: [],
      diagnostics: [stateDiagnostic(tokenState.code, tokenState.message, 'error', 'auth')],
    };
  }

  const tokenRoot = asRecord(tokenState.value);
  const token = typeof tokenRoot?.token === 'string' ? tokenRoot.token.trim() : '';
  const expiresAt = parseExpiryDate(tokenRoot?.expiryDate);
  if (!tokenRoot || !token || expiresAt === null) {
    return {
      auth: 'invalid',
      models: [],
      diagnostics: [
        stateDiagnostic(
          'gigacode_state_invalid',
          'GigaCode authentication state is unreadable or invalid.',
          'error',
          'auth',
        ),
      ],
    };
  }

  const diagnostics: RuntimeDiagnostic[] = [];
  const models = parseChatModels(tokenRoot.config, diagnostics);
  const settingsState = await readJsonStateFile(
    join(stateDir, 'settings.json'),
    'gigacode_settings_invalid',
    'GigaCode settings are unreadable or invalid.',
  );
  let configuredModel: string | undefined;
  if (settingsState.kind === 'invalid') {
    diagnostics.push(
      stateDiagnostic(settingsState.code, settingsState.message, 'warning', 'models'),
    );
  } else if (settingsState.kind === 'value') {
    configuredModel = parseConfiguredModel(settingsState.value);
  }

  if (expiresAt !== undefined && expiresAt <= now) {
    return {
      auth: 'expired',
      expiresAt,
      ...(configuredModel ? { configuredModel } : {}),
      models,
      diagnostics: [
        ...diagnostics,
        stateDiagnostic(
          'gigacode_auth_expired',
          'GigaCode authentication has expired. Run `gigacode auth` and check again.',
          'warning',
          'auth',
        ),
      ],
    };
  }

  return {
    auth: 'ready',
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    ...(configuredModel ? { configuredModel } : {}),
    models,
    diagnostics,
  };
}

async function readJsonStateFile(
  path: string,
  code: string,
  message: string,
): Promise<JsonReadResult> {
  try {
    const file = await stat(path);
    if (!file.isFile() || file.size > MAX_STATE_FILE_BYTES) {
      return { kind: 'invalid', code, message };
    }
    const raw = await readFile(path, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > MAX_STATE_FILE_BYTES) {
      return { kind: 'invalid', code, message };
    }
    return { kind: 'value', value: JSON.parse(raw) as unknown };
  } catch (error) {
    if (isMissingFileError(error)) return { kind: 'missing' };
    return { kind: 'invalid', code, message };
  }
}

function parseChatModels(
  rawConfig: unknown,
  diagnostics: RuntimeDiagnostic[],
): AgentRuntimeModel[] {
  const config = asRecord(rawConfig);
  const chat = asRecord(config?.chat);
  const rawModels = Array.isArray(chat?.models) ? chat.models : [];
  const models: AgentRuntimeModel[] = [];
  const seen = new Set<string>();
  let skippedInvalid = false;

  for (const rawModel of rawModels.slice(0, MAX_MODELS)) {
    const record = asRecord(rawModel);
    if (!record) {
      skippedInvalid = true;
      continue;
    }
    const id = typeof record.model === 'string' ? record.model.trim() : '';
    if (!id || id.length > MAX_MODEL_ID_LENGTH || !SAFE_MODEL_ID.test(id) || seen.has(id)) {
      skippedInvalid = true;
      continue;
    }
    seen.add(id);
    const rawDescription = typeof record.description === 'string' ? record.description.trim() : '';
    const description = rawDescription
      ? rawDescription.slice(0, MAX_DESCRIPTION_LENGTH)
      : undefined;
    const pluginSide = asRecord(record.plugin_side);
    const contextWindowSize = positiveInteger(pluginSide?.context_window_size);
    models.push({
      runtime: 'gigacode',
      id,
      provider: 'gigacode',
      model: id,
      label: `GigaCode · ${id}`,
      ...(description ? { description } : {}),
      ...(contextWindowSize ? { contextWindowSize } : {}),
    });
  }

  if (rawModels.length > MAX_MODELS || skippedInvalid) {
    diagnostics.push(
      stateDiagnostic(
        'gigacode_model_entry_invalid',
        'One or more GigaCode model entries were ignored because they were invalid.',
        'warning',
        'models',
      ),
    );
  }
  return models;
}

function parseConfiguredModel(value: unknown): string | undefined {
  const root = asRecord(value);
  const model = asRecord(root?.model);
  const name = typeof model?.name === 'string' ? model.name.trim() : '';
  if (!name || name.length > MAX_MODEL_ID_LENGTH || !SAFE_MODEL_ID.test(name)) return undefined;
  return name;
}

function parseExpiryDate(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    return milliseconds > 0 ? milliseconds : null;
  }
  if (typeof value !== 'string') return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function stateDiagnostic(
  code: string,
  message: string,
  severity: RuntimeDiagnostic['severity'],
  phase: NonNullable<RuntimeDiagnostic['phase']>,
): RuntimeDiagnostic {
  return {
    code,
    message,
    severity,
    phase,
    retryHint: phase === 'auth' ? 'login' : 'check_config',
  };
}
