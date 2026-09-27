export interface ContentProviderSettings {
  type: string;
  settings: Readonly<Record<string, unknown>>;
}

export interface GitHubWorkflowSettings {
  owner: string;
  repository: string;
  workflow: string;
  ref: string;
  inputs: Readonly<Record<string, string>>;
  credentialReference: string;
}

export interface CmsConfiguration {
  revision: string;
  contentProvider: ContentProviderSettings;
  githubWorkflow: GitHubWorkflowSettings;
}

export type PublicCmsConfiguration = Omit<CmsConfiguration, 'githubWorkflow'> & {
  githubWorkflow: Omit<GitHubWorkflowSettings, 'credentialReference'> & {
    credentialConfigured: boolean;
  };
};

export interface ConfigurationStore {
  read(): Promise<CmsConfiguration | undefined>;
  save(configuration: CmsConfiguration, expectedRevision?: string): Promise<CmsConfiguration>;
}

export function toPublicCmsConfiguration(
  configuration: CmsConfiguration,
  githubCredentialConfigured: boolean,
): PublicCmsConfiguration {
  const { credentialReference: _credentialReference, ...githubWorkflow } = configuration.githubWorkflow;
  return {
    revision: configuration.revision,
    contentProvider: structuredClone(configuration.contentProvider),
    githubWorkflow: {
      ...structuredClone(githubWorkflow),
      credentialConfigured: githubCredentialConfigured,
    },
  };
}