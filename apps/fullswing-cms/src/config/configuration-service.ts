import { randomUUID } from 'node:crypto';
import type {
  CmsConfiguration,
  ConfigurationStore,
  PublicCmsConfiguration,
} from './configuration-store.js';
import { toPublicCmsConfiguration } from './configuration-store.js';
import type { SecretStore } from './secret-store.js';
import { CmsError } from '../content/domain/content-errors.js';
import type { ContentProviderSelection } from '../content/application/select-content-provider.js';
import type { ContentProviderRegistry, ProviderResolutionContext } from '../content/storage/provider-registry.js';
import { validateGitHubWorkflowSettings, type GitHubWorkflowDraft } from '../integrations/github/github-configuration.js';

export interface ConfigurationDraft {
  expectedRevision?: string;
  contentProvider: { type: string; settings: Readonly<Record<string, unknown>> };
  githubWorkflow: GitHubWorkflowDraft;
  githubToken?: string;
}

export class ConfigurationService {
  constructor(
    private readonly configurations: ConfigurationStore,
    private readonly secrets: SecretStore,
    private readonly providers: ContentProviderRegistry,
    private readonly selection: ContentProviderSelection,
  ) {}

  async readPublic(): Promise<PublicCmsConfiguration | undefined> {
    const configuration = await this.configurations.read();
    if (!configuration) return undefined;
    const credential = await this.secrets.get(configuration.githubWorkflow.credentialReference);
    return toPublicCmsConfiguration(configuration, credential !== undefined);
  }

  availableProviderTypes(): string[] {
    return this.providers.types();
  }

  async save(draft: ConfigurationDraft, context?: ProviderResolutionContext): Promise<CmsConfiguration> {
    const current = await this.configurations.read();
    if (current && draft.expectedRevision !== current.revision) {
      throw new CmsError('configuration-conflict', 'Configuration changed. Reload it before saving.', 409);
    }
    if (!draft.contentProvider.type.trim()) {
      throw new CmsError('configuration-invalid', 'Select a supported content provider.', 400);
    }
    await this.providers.resolve({
      ...draft.contentProvider,
      revision: draft.expectedRevision ?? 'candidate',
    }, context);

    const replacementToken = typeof draft.githubToken === 'string' ? draft.githubToken.trim() : '';
    const previousReference = current?.githubWorkflow.credentialReference;
    if (!replacementToken && !previousReference) {
      throw new CmsError('configuration-invalid', 'A GitHub credential is required.', 400);
    }
    if (!replacementToken && previousReference && !await this.secrets.get(previousReference)) {
      throw new CmsError('configuration-invalid', 'A GitHub credential is required.', 400);
    }
    const credentialReference = replacementToken ? `github-${randomUUID()}` : previousReference!;
    const githubWorkflow = validateGitHubWorkflowSettings(draft.githubWorkflow, credentialReference);
    if (replacementToken) await this.secrets.set(credentialReference, replacementToken);

    const candidate: CmsConfiguration = {
      revision: current?.revision ?? '',
      contentProvider: structuredClone(draft.contentProvider),
      githubWorkflow,
    };
    let saved: CmsConfiguration;
    try {
      saved = await this.configurations.save(candidate, draft.expectedRevision);
    } catch (error) {
      if (replacementToken) await this.secrets.delete(credentialReference);
      throw error;
    }

    const provider = await this.providers.resolve({
      ...saved.contentProvider,
      revision: saved.revision,
    }, context);
    this.selection.activateResolved(provider);
    if (replacementToken && previousReference) await this.secrets.delete(previousReference);
    return saved;
  }
}