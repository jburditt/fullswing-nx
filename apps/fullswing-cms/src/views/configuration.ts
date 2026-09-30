import type { PublicCmsConfiguration } from '../config/configuration-store.js';
import type { ValidationIssue } from '../content/domain/content-errors.js';
import { escapeHtml, renderCmsLayout } from './layout.js';

export interface ConfigurationViewOptions {
  configuration?: PublicCmsConfiguration;
  availableProviderTypes?: readonly string[];
  csrfToken: string;
  issues?: readonly ValidationIssue[];
  statusMessage?: string;
  statusKind?: 'success' | 'error';
  dispatchRunId?: number;
  dispatchRunUrl?: string;
}

export function renderConfigurationPage(options: ConfigurationViewOptions): string {
  const configuration = options.configuration;
  const providerType = configuration?.contentProvider.type ?? 'onedrive';
  const providerNames: Record<string, string> = { demo: 'Local demo', file: 'Local files', onedrive: 'OneDrive' };
  const providerTypes = new Set([...(options.availableProviderTypes ?? []), providerType]);
  const providerOptions = [...providerTypes].map(type => `<option value="${escapeHtml(type)}"${providerType === type ? ' selected' : ''}>${escapeHtml(providerNames[type] ?? type)}</option>`).join('');
  const providerSettings = configuration?.contentProvider.settings ?? {};
  const settingsGroups = [...providerTypes].map(type => {
    const fields = type === 'onedrive'
      ? `<label class="cms-field">Drive ID<input name="driveId" value="${escapeHtml(String(providerSettings.driveId ?? ''))}" /></label><label class="cms-field">Root folder ID<input name="rootFolderId" value="${escapeHtml(String(providerSettings.rootFolderId ?? ''))}" /></label>`
      : type === 'file'
        ? `<label class="cms-field cms-field--wide">Website public directory<input name="publicDirectory" value="${escapeHtml(String(providerSettings.publicDirectory ?? ''))}" /></label>`
        : '<p class="cms-credential-state">This provider has no additional settings.</p>';
    return `<div class="cms-settings-grid" data-provider-settings="${escapeHtml(type)}"${type === providerType ? '' : ' hidden'}>${fields}</div>`;
  }).join('');
  const workflow = configuration?.githubWorkflow;
  const errors = options.issues?.length
    ? `<section class="cms-errors" role="alert"><h2>Configuration was not saved</h2><ul>${options.issues.map(issue => `<li><strong>${escapeHtml(issue.field)}:</strong> ${escapeHtml(issue.message)}</li>`).join('')}</ul></section>`
    : '';
  const status = options.statusMessage
    ? `<p class="cms-validation-status" role="${options.statusKind === 'error' ? 'alert' : 'status'}" aria-live="${options.statusKind === 'error' ? 'assertive' : 'polite'}">${escapeHtml(options.statusMessage)}</p>`
    : '';
  const runUrl = safeGitHubRunUrl(options.dispatchRunUrl);
  const dispatchDetails = options.dispatchRunId !== undefined || runUrl
    ? `<p class="cms-dispatch-details" role="status">${options.dispatchRunId !== undefined ? `Run ID: ${options.dispatchRunId}` : ''}${runUrl ? ` <a href="${escapeHtml(runUrl)}" rel="noopener noreferrer">View run</a>` : ''}</p>`
    : '';
  const csrf = escapeHtml(options.csrfToken);
  const revision = escapeHtml(configuration?.revision ?? '');
  const inputs = escapeHtml(JSON.stringify(workflow?.inputs ?? {}, null, 2));

  const content = `${errors}${status}${dispatchDetails}
  <form class="cms-settings-form" action="/configuration" method="post">
    <input type="hidden" name="_csrf" value="${csrf}" />
    <input type="hidden" name="expectedRevision" value="${revision}" />
    <fieldset class="cms-settings-section"><legend>Content storage</legend><div class="cms-settings-grid">
      <label class="cms-field">Provider<select name="providerType">${providerOptions}</select></label>
    </div>${settingsGroups}</fieldset>
    <fieldset class="cms-settings-section"><legend>GitHub workflow</legend><div class="cms-settings-grid">
      <label class="cms-field">Owner<input name="owner" value="${escapeHtml(workflow?.owner ?? '')}" required /></label>
      <label class="cms-field">Repository<input name="repository" value="${escapeHtml(workflow?.repository ?? '')}" required /></label>
      <label class="cms-field">Workflow file or ID<input name="workflow" value="${escapeHtml(workflow?.workflow ?? '')}" required /></label>
      <label class="cms-field">Ref<input name="ref" value="${escapeHtml(workflow?.ref ?? '')}" required /></label>
      <label class="cms-field cms-field--wide">Workflow inputs<textarea name="inputs" rows="6">${inputs}</textarea></label>
      <label class="cms-field">GitHub token<input type="password" name="githubToken" value="" autocomplete="new-password" /></label>
      <p class="cms-credential-state">Credential <strong>${workflow?.credentialConfigured ? 'Configured' : 'Not configured'}</strong></p>
    </div></fieldset>
    <div class="cms-settings-actions"><button class="cms-button" type="submit">Save configuration</button></div>
  </form>
  <form class="cms-dispatch-form" action="/github/dispatch" method="post">
    <input type="hidden" name="_csrf" value="${csrf}" />
    <div><strong>Publish the website</strong><span>Run the saved GitHub Actions workflow.</span></div><button class="cms-button cms-button--quiet" type="submit">Dispatch workflow</button>
  </form>`;

  return renderCmsLayout({ title: 'Configuration', content, csrfToken: options.csrfToken, activeItem: 'configuration' });
}

function safeGitHubRunUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}