import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CmsApplicationDependencies } from './bootstrap.js';
import { startCms } from './bootstrap.js';
import { CmsError } from './content/domain/content-errors.js';

export { createCmsApp, startCms } from './bootstrap.js';

export function getProjectName(): string {
  return 'fullswing-cms';
}

interface CmsCompositionModule {
  createCmsDependencies?: () => CmsApplicationDependencies | Promise<CmsApplicationDependencies>;
}

export async function runCmsFromEnvironment(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const compositionPath = environment.CMS_BOOTSTRAP_MODULE;
  if (!compositionPath?.trim()) {
    throw new CmsError('configuration-invalid', 'CMS_BOOTSTRAP_MODULE must identify a deployment composition module.', 500);
  }
  const compositionUrl = pathToFileURL(resolve(compositionPath)).href;
  const composition = await import(compositionUrl) as CmsCompositionModule;
  if (typeof composition.createCmsDependencies !== 'function') {
    throw new CmsError('configuration-invalid', 'The CMS composition module must export createCmsDependencies().', 500);
  }
  await startCms(await composition.createCmsDependencies());
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryPoint === import.meta.url) {
  runCmsFromEnvironment().catch(() => {
    process.stderr.write('CMS startup failed. Check CMS_BOOTSTRAP_MODULE and deployment settings.\n');
    process.exitCode = 1;
  });
}
