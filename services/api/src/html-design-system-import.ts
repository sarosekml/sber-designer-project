import { readdir } from 'node:fs/promises';
import { extname, posix } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import {
  HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES,
  HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES,
  HTML_DESIGN_SYSTEM_IMPORT_MAX_TOTAL_BYTES,
  HTML_DESIGN_SYSTEM_PATHS,
  classifyHtmlDesignSystemImportFileName,
  type HtmlDesignSystemImportedFile,
  type HtmlDesignSystemSkippedImportFile,
} from '@sber-designer/shared-types';

import { loadProjectDesignSystemBrowser } from './design-system-browser';
import { regenerateHtmlDesignSystemPreview } from './html-design-system-preview';
import { runProjectIndexJobNow } from './project-index/indexing-runner';
import {
  deleteWorkspaceFile,
  readWorkspaceFile,
  writeWorkspaceBytes,
  writeWorkspaceFile,
} from './safe-fs';

const MANAGED_PREVIEW_MARKER = 'data-sd-managed-design-system-preview';

export interface HtmlDesignSystemImportCandidate {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ImportHtmlDesignSystemFilesInput {
  workspacePath: string;
  projectName: string;
  files: HtmlDesignSystemImportCandidate[];
  canvasUrl?: string | null;
}

export interface ImportHtmlDesignSystemFilesResult {
  imported: HtmlDesignSystemImportedFile[];
  skipped: HtmlDesignSystemSkippedImportFile[];
  changedFiles: string[];
  preview: {
    changedFile: string;
    tokenCount: number;
    componentClassCount: number;
    referencePageCount: number;
  } | null;
  reindexJobId: string | null;
  browser: Awaited<ReturnType<typeof loadProjectDesignSystemBrowser>>;
}

export async function importHtmlDesignSystemFiles(
  input: ImportHtmlDesignSystemFilesInput,
): Promise<ImportHtmlDesignSystemFilesResult> {
  validateBatch(input.files);
  const existingPreview = await readWorkspaceFile(
    input.workspacePath,
    HTML_DESIGN_SYSTEM_PATHS.previewHtml,
  ).catch(() => null);
  if (existingPreview !== null && !existingPreview.includes(MANAGED_PREVIEW_MARKER)) {
    throw new Error(
      `${HTML_DESIGN_SYSTEM_PATHS.previewHtml} is user-owned. Move it into ${HTML_DESIGN_SYSTEM_PATHS.refsDir}/ before importing files.`,
    );
  }

  const reservedByDirectory = new Map<string, Set<string>>();
  const imported: HtmlDesignSystemImportedFile[] = [];
  const skipped: HtmlDesignSystemSkippedImportFile[] = [];
  const attemptedTargetPaths: string[] = [];
  try {
    for (const file of input.files) {
      const normalizedName = normalizeImportName(file.name);
      if (!normalizedName) {
        skipped.push({
          name: file.name,
          reason: 'invalid-name',
          detail: 'Use a plain file name without folders or control characters.',
        });
        continue;
      }
      if (file.bytes.byteLength > HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES) {
        skipped.push({
          name: normalizedName,
          reason: 'too-large',
          detail: 'The file exceeds the 10 MB import limit.',
        });
        continue;
      }
      const classification = classifyHtmlDesignSystemImportFileName(normalizedName);
      if (!classification) {
        skipped.push({
          name: normalizedName,
          reason: 'unsupported',
          detail: 'Supported files are HTML, CSS, JS, common images, icons, and web fonts.',
        });
        continue;
      }
      if (classification.kind !== 'asset' && !isUtf8(file.bytes)) {
        skipped.push({
          name: normalizedName,
          reason: 'unsupported',
          detail: 'HTML, CSS, JS, and Markdown imports must be UTF-8 text.',
        });
        continue;
      }
      const targetPath = await reserveTargetPath({
        workspacePath: input.workspacePath,
        originalName: normalizedName,
        classification,
        reservedByDirectory,
      });
      if (!targetPath) {
        skipped.push({
          name: normalizedName,
          reason: 'source-exists',
          detail: 'The canonical source already exists and was not overwritten.',
        });
        continue;
      }
      attemptedTargetPaths.push(targetPath);
      await writeWorkspaceBytes(input.workspacePath, targetPath, file.bytes);
      imported.push({
        originalName: normalizedName,
        targetPath,
        kind: classification.kind,
        size: file.bytes.byteLength,
        renamed: posix.basename(targetPath) !== normalizedName,
      });
    }

    if (imported.length === 0) {
      return {
        imported,
        skipped,
        changedFiles: [],
        preview: null,
        reindexJobId: null,
        browser: await loadProjectDesignSystemBrowser(input.workspacePath),
      };
    }

    const preview = await regenerateHtmlDesignSystemPreview(input.workspacePath, input.projectName);
    const job = await runProjectIndexJobNow({
      workspaceRoot: input.workspacePath,
      projectName: input.projectName,
      enrich: false,
      ...(input.canvasUrl ? { canvasUrl: input.canvasUrl } : {}),
    });
    if (job.status === 'failed') throw new Error(job.error ?? 'Project index generation failed.');
    return {
      imported,
      skipped,
      changedFiles: unique([
        ...imported.map((file) => file.targetPath),
        preview.changedFile,
        ...preview.descriptionSections.changedFiles,
        ...job.changedFiles,
      ]),
      preview: {
        changedFile: preview.changedFile,
        tokenCount: preview.tokenCount,
        componentClassCount: preview.componentClassCount,
        referencePageCount: preview.referencePageCount,
      },
      reindexJobId: job.id,
      browser: await loadProjectDesignSystemBrowser(input.workspacePath),
    };
  } catch (error) {
    await Promise.all(
      unique(attemptedTargetPaths).map((targetPath) =>
        deleteWorkspaceFile(input.workspacePath, targetPath).catch(() => undefined),
      ),
    );
    if (existingPreview === null) {
      await deleteWorkspaceFile(input.workspacePath, HTML_DESIGN_SYSTEM_PATHS.previewHtml).catch(
        () => undefined,
      );
    } else {
      await writeWorkspaceFile(
        input.workspacePath,
        HTML_DESIGN_SYSTEM_PATHS.previewHtml,
        existingPreview,
      ).catch(() => undefined);
    }
    throw error;
  }
}

function validateBatch(files: HtmlDesignSystemImportCandidate[]): void {
  if (files.length === 0) throw new Error('Choose at least one file to import.');
  if (files.length > HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES) {
    throw new Error(`Import at most ${HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES} files at once.`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (totalBytes > HTML_DESIGN_SYSTEM_IMPORT_MAX_TOTAL_BYTES) {
    throw new Error('The selected files exceed the 50 MB total import limit.');
  }
}

function normalizeImportName(value: string): string | null {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.length > 180 ||
    hasUnsafeImportNameCharacter(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function hasUnsafeImportNameCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === '/' || character === '\\' || codePoint < 32 || codePoint === 127;
  });
}

async function reserveTargetPath(input: {
  workspacePath: string;
  originalName: string;
  classification: NonNullable<ReturnType<typeof classifyHtmlDesignSystemImportFileName>>;
  reservedByDirectory: Map<string, Set<string>>;
}): Promise<string | null> {
  if (input.classification.canonicalPath) {
    const targetPath = input.classification.canonicalPath;
    const reserved = input.reservedByDirectory.get('[sources]') ?? new Set<string>();
    input.reservedByDirectory.set('[sources]', reserved);
    if (reserved.has(targetPath.toLowerCase())) return null;
    const targetDirectory = posix.dirname(targetPath);
    const targetName = posix.basename(targetPath).toLowerCase();
    const existingNames = await readdir(resolveInside(input.workspacePath, targetDirectory)).catch(
      () => [],
    );
    if (existingNames.some((name) => name.toLowerCase() === targetName)) return null;
    reserved.add(targetPath.toLowerCase());
    return targetPath;
  }
  const directory =
    input.classification.kind === 'asset'
      ? HTML_DESIGN_SYSTEM_PATHS.assetsDir
      : HTML_DESIGN_SYSTEM_PATHS.refsDir;
  let reserved = input.reservedByDirectory.get(directory);
  if (!reserved) {
    const names = await readdir(resolveInside(input.workspacePath, directory)).catch(() => []);
    reserved = new Set(names.map((name) => name.toLowerCase()));
    input.reservedByDirectory.set(directory, reserved);
  }
  const extension = extname(input.originalName);
  const stem = extension ? input.originalName.slice(0, -extension.length) : input.originalName;
  let candidate = input.originalName;
  let suffix = 2;
  while (reserved.has(candidate.toLowerCase())) {
    candidate = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }
  reserved.add(candidate.toLowerCase());
  return posix.join(directory, candidate);
}

function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
