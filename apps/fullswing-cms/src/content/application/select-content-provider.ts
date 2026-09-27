import { CmsError } from '../domain/content-errors.js';
import type { ContentStorageProvider, ProviderConfiguration } from '../storage/content-storage-provider.js';
import type { ContentProviderRegistry, ProviderResolutionContext } from '../storage/provider-registry.js';

export class ContentProviderSelection {
  private activeProvider?: ContentStorageProvider;

  constructor(private readonly registry: ContentProviderRegistry) {}

  get active(): ContentStorageProvider {
    if (!this.activeProvider) {
      throw new CmsError('configuration-invalid', 'No content provider is active.', 503);
    }
    return this.activeProvider;
  }

  async activate(
    configuration: ProviderConfiguration,
    context?: ProviderResolutionContext,
  ): Promise<ContentStorageProvider> {
    const candidate = await this.registry.resolve(configuration, context);
    this.activateResolved(candidate);
    return candidate;
  }

  activateResolved(provider: ContentStorageProvider): void {
    this.activeProvider = provider;
  }
}