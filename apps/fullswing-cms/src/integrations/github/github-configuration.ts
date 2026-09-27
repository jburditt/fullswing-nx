import { CmsError } from '../../content/domain/content-errors.js';
import type { GitHubWorkflowSettings } from '../../config/configuration-store.js';

export type GitHubWorkflowDraft = Omit<GitHubWorkflowSettings, 'credentialReference'>;

export function validateGitHubWorkflowSettings(
  value: unknown,
  credentialReference: string,
): GitHubWorkflowSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidConfiguration();
  }
  const draft = value as Partial<GitHubWorkflowDraft>;
  const owner = normalizeSegment(draft.owner, /^[A-Za-z0-9-]{1,39}$/);
  const repository = normalizeSegment(draft.repository, /^[A-Za-z0-9_.-]{1,100}$/);
  const workflow = typeof draft.workflow === 'string' ? draft.workflow.trim() : '';
  const ref = typeof draft.ref === 'string' ? draft.ref.trim() : '';
  if (!owner || !repository || !isWorkflowIdentifier(workflow) || !isValidRef(ref)) {
    throw invalidConfiguration();
  }
  const inputs = normalizeInputs(draft.inputs);
  if (!credentialReference.trim()) throw invalidConfiguration();
  return { owner, repository, workflow, ref, inputs, credentialReference };
}

function normalizeSegment(value: unknown, pattern: RegExp): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return pattern.test(normalized) ? normalized : undefined;
}

function isWorkflowIdentifier(value: string): boolean {
  if (/^\d+$/.test(value)) return true;
  if (!value || value.startsWith('/') || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) return false;
  return /\.(?:yml|yaml)$/i.test(value) && value.length <= 255;
}

function isValidRef(value: string): boolean {
  const forbiddenCharacters = new Set(['~', '^', ':', '?', '*', '[', ']', '\\']);
  const segments = value.split('/');
  return value.length > 0 && value.length <= 255
    && ![...value].some(character => character.charCodeAt(0) <= 0x20 || forbiddenCharacters.has(character))
    && value !== '@' && !value.includes('..') && !value.includes('@{') && !value.includes('//')
    && !value.endsWith('/') && !value.endsWith('.') && !value.endsWith('.lock')
    && segments.every(segment => segment.length > 0 && !segment.startsWith('.') && !segment.endsWith('.'));
}

function normalizeInputs(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidConfiguration();
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 20) throw invalidConfiguration();
  const inputs: Record<string, string> = {};
  for (const [name, input] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(name) || /token|secret|password|credential|authorization/i.test(name)
      || typeof input !== 'string' || input.length > 1024) {
      throw invalidConfiguration();
    }
    inputs[name] = input;
  }
  return inputs;
}

function invalidConfiguration(): CmsError {
  return new CmsError('configuration-invalid', 'The GitHub workflow configuration is invalid.', 400);
}