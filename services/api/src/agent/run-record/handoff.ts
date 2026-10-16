/** handoff.md writer: scope, evidence, validation and next-agent prompt. */
import { writeFile } from 'node:fs/promises';
import { resolveInside } from '@sber-designer/ast-bridge';
import { readRunContinuationContextSnapshot } from '../continuation-context';
import type { AgentRunManifest, AgentToolReceipt } from './types';
import { runRoot, uniqueSorted } from './store';
import { readRunReceipts, summarizeComponentReuseFromReceipts } from './receipts';
import { readScreenshotEvidence } from './evidence';

export async function writeHandoff(
  workspacePath: string,
  manifest: AgentRunManifest,
): Promise<void> {
  const receipts = await readRunReceipts(workspacePath, manifest.runId);
  const continuationContext = await readRunContinuationContextSnapshot(
    workspacePath,
    manifest.runId,
  );
  const changedFiles = uniqueSorted(receipts.flatMap((receipt) => receipt.changedFiles));
  const screenshots = await readScreenshotEvidence(workspacePath, manifest.runId);
  const activeScreen = manifest.activeScreen;
  const summary = manifest.summary ?? 'No summary recorded.';
  const craftFindings = extractCraftFindings(receipts);
  const componentReuse = summarizeComponentReuseFromReceipts(receipts);
  const text = [
    '# Assistant Run Handoff',
    '',
    `- Run: ${manifest.runId}`,
    `- Status: ${manifest.status}`,
    `- Project: ${manifest.projectName ?? 'unknown'}`,
    `- Active screen: ${activeScreen?.name ?? 'none'}`,
    `- Route: ${manifest.route}`,
    '',
    '## User Goal',
    '',
    manifest.userGoal ?? '_No user goal captured for this run._',
    '',
    '## Scope',
    '',
    ...handoffScopeLines(manifest),
    '',
    '## Changed Files',
    '',
    ...(changedFiles.length > 0
      ? changedFiles.map((file) => `- ${file}`)
      : ['_No changed files were recorded in receipts._']),
    '',
    '## Source / Design Evidence',
    '',
    ...handoffEvidenceLines(manifest, receipts),
    '',
    '## Validation',
    '',
    ...handoffValidationLines(manifest, receipts),
    '',
    ...(componentReuse
      ? ['## Component Reuse', '', ...handoffComponentReuseLines(componentReuse), '']
      : []),
    '## Screenshots',
    '',
    ...(screenshots.length > 0
      ? screenshots.map((file) => `- ${file}`)
      : ['_No screenshots or visual evidence files were recorded for this run._']),
    '',
    '## Summary',
    '',
    summary,
    '',
    ...(craftFindings.length > 0
      ? [
          '## Craft Findings',
          '',
          ...craftFindings.map(
            (finding) =>
              `- [${finding.severity}] ${finding.ruleId}${finding.filePath ? ` (${finding.filePath})` : ''}: ${finding.message}`,
          ),
          '',
        ]
      : []),
    '## Open Assumptions',
    '',
    ...handoffAssumptionLines(manifest, receipts),
    '',
    '## Prompt For Next Coding Agent',
    '',
    '```text',
    nextAgentPrompt(manifest, changedFiles),
    '```',
    '',
    '## Machine Artifacts',
    '',
    '- Manifest: run-manifest.json',
    '- Timeline: timeline.jsonl',
    '- Receipts: receipts/',
    ...agentRunMachineArtifactLines(manifest, Boolean(continuationContext)),
    ...externalRuntimeMachineArtifactLines(receipts),
    '',
  ].join('\n');
  await writeFile(
    resolveInside(runRoot(workspacePath, manifest.runId), 'handoff.md'),
    text,
    'utf8',
  );
}

function handoffComponentReuseLines(summary: {
  expected: string[];
  used: string[];
  missing: string[];
}): string[] {
  return [
    `- Expected: ${summary.expected.length > 0 ? summary.expected.join(', ') : 'none'}`,
    `- Used: ${summary.used.length > 0 ? summary.used.join(', ') : 'none'}`,
    `- Missing: ${summary.missing.length > 0 ? summary.missing.join(', ') : 'none'}`,
  ];
}

function extractCraftFindings(receipts: AgentToolReceipt[]): {
  severity: string;
  ruleId: string;
  message: string;
  filePath?: string;
}[] {
  const findings: {
    severity: string;
    ruleId: string;
    message: string;
    filePath?: string;
  }[] = [];
  for (const receipt of receipts) {
    if (receipt.tool !== 'validate_screen_craft') continue;
    if (!Array.isArray(receipt.metadata?.findings)) continue;
    for (const item of receipt.metadata.findings) {
      if (!item || typeof item !== 'object') continue;
      const finding = item as {
        severity?: unknown;
        ruleId?: unknown;
        message?: unknown;
        filePath?: unknown;
      };
      if (
        typeof finding.severity !== 'string' ||
        typeof finding.ruleId !== 'string' ||
        typeof finding.message !== 'string'
      ) {
        continue;
      }
      findings.push({
        severity: finding.severity,
        ruleId: finding.ruleId,
        message: finding.message,
        ...(typeof finding.filePath === 'string' ? { filePath: finding.filePath } : {}),
      });
    }
  }
  return findings.slice(0, 20);
}

function handoffScopeLines(manifest: AgentRunManifest): string[] {
  const lines = [
    `- route: ${manifest.route}`,
    `- provider: ${manifest.provider ?? 'unknown'}`,
    `- model: ${manifest.model ?? 'unknown'}`,
    `- workspace: ${manifest.workspacePath}`,
  ];
  if (!manifest.activeScreen) {
    lines.push('- activeScreen: none');
    return lines;
  }
  lines.push(`- activeScreen: ${manifest.activeScreen.name} (${manifest.activeScreen.id})`);
  if (manifest.activeScreen.filePath) lines.push(`- storyFile: ${manifest.activeScreen.filePath}`);
  if (manifest.activeScreen.implementationFilePath) {
    lines.push(`- implementationFile: ${manifest.activeScreen.implementationFilePath}`);
  }
  if (manifest.assistantTaskIntent) {
    lines.push(`- assistantTaskIntent: ${manifest.assistantTaskIntent.kind}`);
  }
  return lines;
}

function handoffEvidenceLines(manifest: AgentRunManifest, receipts: AgentToolReceipt[]): string[] {
  const lines: string[] = [];
  if (manifest.activeScreen?.description) {
    lines.push(`- activeScreenDescription: ${compactLine(manifest.activeScreen.description, 220)}`);
  }
  for (const attachment of (manifest.promptAttachments ?? []).slice(0, 8)) {
    if (attachment.kind === 'text') {
      lines.push(
        `- promptAttachment: ${attachment.name} (${attachment.mimeType}, text) -> ${attachment.runPath}`,
      );
      lines.push(`  - excerpt: ${compactLine(attachment.excerpt, 220)}`);
      continue;
    }
    const dimensions =
      attachment.width && attachment.height ? `, ${attachment.width}x${attachment.height}` : '';
    lines.push(
      `- promptAttachment: ${attachment.name} (${attachment.mimeType}${dimensions}) -> ${attachment.runPath}`,
    );
  }
  const externalDiff = receipts.find((receipt) => receipt.tool === 'external_runtime_target_diff');
  if (externalDiff?.summary) {
    lines.push(`- externalRuntimeDiff: ${compactLine(externalDiff.summary, 260)}`);
  }
  const designSourceReceipts = receipts.filter((receipt) =>
    ['design_source_reference', 'reference_evidence_pack'].includes(receipt.tool),
  );
  for (const receipt of designSourceReceipts.slice(0, 4)) {
    lines.push(`- ${receipt.tool}: ${compactLine(receipt.summary ?? receipt.status, 260)}`);
    const mappingReportPath = receipt.metadata?.mappingReportPath;
    if (typeof mappingReportPath === 'string') {
      lines.push(`  - mappingReport: ${mappingReportPath}`);
    }
    const sourceSummaryPath = receipt.metadata?.sourceSummaryPath;
    if (typeof sourceSummaryPath === 'string') {
      lines.push(`  - sourceSummary: ${sourceSummaryPath}`);
    }
  }
  if (lines.length === 0) {
    lines.push('_No source/design evidence receipt was recorded._');
  }
  return lines;
}

function handoffValidationLines(
  manifest: AgentRunManifest,
  receipts: AgentToolReceipt[],
): string[] {
  const validationReceipts = receipts.filter(
    (receipt) =>
      receipt.tool.startsWith('validate_') ||
      receipt.tool.includes('validation') ||
      receipt.tool === 'external_runtime_target_diff',
  );
  const lines = validationReceipts.map(
    (receipt) =>
      `- ${receipt.tool}: ${receipt.status}${receipt.summary ? ` - ${compactLine(receipt.summary, 260)}` : ''}`,
  );
  if (manifest.status === 'failed') {
    lines.unshift('- runStatus: failed - inspect timeline and receipts before continuing.');
  } else if (manifest.status === 'needs_review') {
    lines.unshift(
      '- runStatus: legacy needs_review - classify current source/render state before continuing.',
    );
  }
  if (lines.length === 0) {
    lines.push('_No validation receipts were recorded._');
  }
  return lines;
}

function handoffAssumptionLines(
  manifest: AgentRunManifest,
  receipts: AgentToolReceipt[],
): string[] {
  const assumptions: string[] = [];
  if (!manifest.userGoal) assumptions.push('- User goal was not captured in the run manifest.');
  if (receipts.length === 0) assumptions.push('- No receipts were recorded.');
  if (manifest.status === 'needs_review') {
    assumptions.push(
      '- Legacy needs_review evidence must be mapped to complete, failed, or a concrete user question.',
    );
  }
  if (manifest.status === 'failed') {
    assumptions.push('- Run failed; continue only after reading the failure timeline event.');
  }
  if (assumptions.length === 0) {
    assumptions.push(
      '- No open assumptions were recorded. Review receipts before broad follow-up edits.',
    );
  }
  return assumptions;
}

function nextAgentPrompt(manifest: AgentRunManifest, changedFiles: string[]): string {
  const files =
    changedFiles.length > 0 ? changedFiles.map((file) => `- ${file}`).join('\n') : '- none';
  return [
    'Review the run artifacts and continue from this handoff.',
    `Run: ${manifest.runId}`,
    `User goal: ${manifest.userGoal ?? 'not captured'}`,
    `Status: ${manifest.status}`,
    `Active screen: ${manifest.activeScreen?.name ?? 'none'}`,
    'Changed files:',
    files,
    'Read run-manifest.json, timeline.jsonl, and receipts/ before editing.',
    'Do not claim success unless validation receipts or a fresh check support it.',
  ].join('\n');
}

function externalRuntimeMachineArtifactLines(receipts: AgentToolReceipt[]): string[] {
  const structurePlan = receipts.find((receipt) => receipt.tool === 'screen_structure_plan');
  const componentPack = receipts.find((receipt) => receipt.tool === 'task_relevant_component_pack');
  const bundle = receipts.find((receipt) => receipt.tool === 'external_runtime_context_bundle');
  return [
    ...(structurePlan ? ['- screen_structure_plan: screen-structure-plan.json'] : []),
    ...(componentPack ? ['- task_relevant_component_pack: component-pack.json'] : []),
    ...(bundle
      ? [
          '- external_runtime_context_bundle: external-runtime/prompt.md',
          '- External runtime agent kit summary: external-runtime/agent-kit-summary.md',
          '- External runtime skill inventory: external-runtime/skill-inventory.md',
          '- External runtime knowledge inventory: external-runtime/knowledge-inventory.md',
          '- External runtime context budget: external-runtime/context-budget.json',
        ]
      : []),
  ];
}

function agentRunMachineArtifactLines(
  manifest: AgentRunManifest,
  hasContinuationContext: boolean,
): string[] {
  const lines: string[] = [];
  const attemptLogPath = manifest.diagnostics?.attemptLogPath;
  const debugLogPath = manifest.diagnostics?.debugLogPath;
  const runManifestPath = manifest.diagnostics?.runManifestPath;
  if (attemptLogPath) lines.push(`- Attempt log: ${attemptLogPath}`);
  if (debugLogPath) lines.push(`- Debug log: ${debugLogPath}`);
  if (runManifestPath) lines.push(`- Run manifest: ${runManifestPath}`);
  if (hasContinuationContext) lines.push('- Continuation context: continuation-context.json');
  return lines;
}

function compactLine(value: string, maxLength: number): string {
  const compacted = value.replace(/\s+/g, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 3))}...`;
}
