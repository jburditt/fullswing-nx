import { readFileSync } from 'node:fs';
import type { ServerOptions as HttpsServerOptions } from 'node:https';
import { CmsError } from '../content/domain/content-errors.js';

export function localHttpsOptionsFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): HttpsServerOptions | undefined {
  const certificatePath = environment.CMS_HTTPS_CERT_PATH?.trim();
  const privateKeyPath = environment.CMS_HTTPS_KEY_PATH?.trim();

  if (!certificatePath && !privateKeyPath) return undefined;
  if (!certificatePath || !privateKeyPath) {
    throw new CmsError(
      'configuration-invalid',
      'CMS_HTTPS_CERT_PATH and CMS_HTTPS_KEY_PATH must both be configured.',
      500,
    );
  }

  try {
    return {
      cert: readFileSync(certificatePath),
      key: readFileSync(privateKeyPath),
    };
  } catch {
    throw new CmsError(
      'configuration-invalid',
      'Unable to read the local HTTPS certificate or private key; verify both configured file paths.',
      500,
    );
  }
}
