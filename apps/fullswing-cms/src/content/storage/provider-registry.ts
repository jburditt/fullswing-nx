import { CmsError } from '../domain/content-errors.js';
import type { ContentStorageProvider, ProviderConfiguration } from './content-storage-provider.js';
import { parseOneDriveSettings } from './onedrive/onedrive-configuration.js';
import { OneDriveContentStorageProvider } from './onedrive/onedrive-provider.js';
import type { OneDriveGraphGateway } from './onedrive/onedrive-client.js';

export type ContentProviderFactory = (
  settings: Readonly<Record<string, unknown>>,
  revision: string,
  context?: ProviderResolutionContext,
) => ContentStorageProvider | Promise<ContentStorageProvider>;

export interface ProviderResolutionContext {
  tokenCacheReference: string;
}

export type DelegatedOneDriveGatewayFactory = (
  settings: Readonly<Record<string, unknown>>,
  revision: string,
  context?: ProviderResolutionContext,
) => OneDriveGraphGateway;

export class ContentProviderRegistry {
  private readonly factories = new Map<string, ContentProviderFactory>();

  register(type: string, factory: ContentProviderFactory): void {
    if (!type.trim()) {
      throw new CmsError('configuration-invalid', 'A content provider type is required.', 500);
    }
    if (this.factories.has(type)) {
      throw new CmsError('configuration-invalid', `The content provider type ${type} is already registered.`, 500);
    }
    this.factories.set(type, factory);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }

  types(): string[] {
    return [...this.factories.keys()];
  }

  async resolve(
    configuration: ProviderConfiguration,
    context?: ProviderResolutionContext,
  ): Promise<ContentStorageProvider> {
    const factory = this.factories.get(configuration.type);
    if (!factory) {
      throw new CmsError('configuration-invalid', 'The selected content provider is not supported.', 400);
    }

    const provider = await factory(configuration.settings, configuration.revision, context);
    if (provider.type !== configuration.type) {
      throw new CmsError('configuration-invalid', 'The selected content provider could not be initialized.', 500);
    }
    await provider.validateConfiguration(configuration);
    return provider;
  }
}

export function registerOneDriveProvider(
  registry: ContentProviderRegistry,
  createDelegatedGateway: DelegatedOneDriveGatewayFactory,
): void {
  registry.register('onedrive', (settings, revision, context) => {
    const location = parseOneDriveSettings(settings);
    return new OneDriveContentStorageProvider(
      createDelegatedGateway(settings, revision, context),
      location,
      revision,
    );
  });
}