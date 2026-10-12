import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CmsError } from '../../src/content/domain/content-errors.js';
import { localHttpsOptionsFromEnvironment } from '../../src/server/local-https.js';

test('local HTTPS remains disabled when certificate settings are absent', () => {
  assert.equal(localHttpsOptionsFromEnvironment({}), undefined);
});

test('local HTTPS requires both certificate and private-key paths', () => {
  assert.throws(
    () => localHttpsOptionsFromEnvironment({ CMS_HTTPS_CERT_PATH: 'localhost.pem' }),
    (error: unknown) => error instanceof CmsError
      && error.code === 'configuration-invalid'
      && /must both be configured/.test(error.message),
  );
});

test('local HTTPS loads certificate and private key from configured paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fullswing-local-https-'));
  const certificatePath = join(directory, 'localhost.pem');
  const privateKeyPath = join(directory, 'localhost-key.pem');
  const certificate = 'test certificate data';
  const privateKey = 'test private key data';

  try {
    writeFileSync(certificatePath, certificate);
    writeFileSync(privateKeyPath, privateKey);

    const options = localHttpsOptionsFromEnvironment({
      CMS_HTTPS_CERT_PATH: certificatePath,
      CMS_HTTPS_KEY_PATH: privateKeyPath,
    });

    assert.deepEqual(options?.cert, readFileSync(certificatePath));
    assert.deepEqual(options?.key, readFileSync(privateKeyPath));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('local HTTPS reports unreadable certificate files as configuration errors', () => {
  assert.throws(
    () => localHttpsOptionsFromEnvironment({
      CMS_HTTPS_CERT_PATH: join(tmpdir(), 'missing-fullswing-cert.pem'),
      CMS_HTTPS_KEY_PATH: join(tmpdir(), 'missing-fullswing-key.pem'),
    }),
    (error: unknown) => error instanceof CmsError
      && error.code === 'configuration-invalid'
      && /Unable to read/.test(error.message),
  );
});
