import type { PublicCmsConfiguration } from '../config/configuration-store.js';
import type { ValidationIssue } from '../content/domain/content-errors.js';
import { escapeHtml, renderCmsLayout } from './layout.js';

export interface ConfigurationViewOptions {
  configuration?: PublicCmsConfiguration;
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
  const providerSettings = configuration?.contentProvider.settings ?? {};
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
  <form class="cms-editor-form" action="/configuration" method="post">
    <input type="hidden" name="_csrf" value="${csrf}" />
    <input type="hidden" name="expectedRevision" value="${revision}" />
    <fieldset><legend>Content storage</legend>
      <label class="cms-field">Provider<select name="providerType"><option value="onedrive"${providerType === 'onedrive' ? ' selected' : ''}>OneDrive</option></select></label>
      <label class="cms-field">Drive ID<input name="driveId" value="${escapeHtml(String(providerSettings.driveId ?? ''))}" required /></label>
      <label class="cms-field">Root folder ID<input name="rootFolderId" value="${escapeHtml(String(providerSettings.rootFolderId ?? ''))}" required /></label>
    </fieldset>
    <fieldset><legend>GitHub workflow</legend>
      <label class="cms-field">Owner<input name="owner" value="${escapeHtml(workflow?.owner ?? '')}" required /></label>
      <label class="cms-field">Repository<input name="repository" value="${escapeHtml(workflow?.repository ?? '')}" required /></label>
      <label class="cms-field">Workflow file or ID<input name="workflow" value="${escapeHtml(workflow?.workflow ?? '')}" required /></label>
      <label class="cms-field">Ref<input name="ref" value="${escapeHtml(workflow?.ref ?? '')}" required /></label>
      <label class="cms-field cms-field--wide">Workflow inputs<textarea name="inputs" rows="6">${inputs}</textarea></label>
      <label class="cms-field">GitHub token<input type="password" name="githubToken" value="" autocomplete="new-password" /></label>
      <p>Credential: ${workflow?.credentialConfigured ? 'Configured' : 'Not configured'}</p>
    </fieldset>
    <button type="submit">Save configuration</button>
  </form>
  <form action="/github/dispatch" method="post">
    <input type="hidden" name="_csrf" value="${csrf}" />
    <button type="submit">Dispatch saved workflow</button>
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