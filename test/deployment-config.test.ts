import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readRepoFile = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');

test('azure deployment config should pin azd to rg-fullswing-blog and manage its lifecycle hooks', () => {
  const azureYaml = readRepoFile('azure.yaml');

  assert.match(azureYaml, /^resourceGroup: rg-fullswing-blog$/m);
  assert.match(azureYaml, /preprovision:\n\s+shell: sh\n\s+run: \.\/scripts\/ensure-resource-group\.sh/);
  assert.match(azureYaml, /postdown:\n\s+shell: sh\n\s+run: \.\/scripts\/delete-resource-group\.sh/);
});

test('workflow should use rg-fullswing-blog for deploy and destroy automation', () => {
  const workflow = readRepoFile('.github/workflows/deploy.yml');

  assert.match(workflow, /^\s+AZURE_RESOURCE_GROUP: rg-fullswing-blog$/m);
  assert.match(workflow, /run: \|\s+set -euo pipefail\s+\.\/scripts\/ensure-resource-group\.sh\s+azd provision --no-prompt[\s\S]*?azd deploy --no-prompt/);
  assert.match(workflow, /az group exists --name "\$AZURE_RESOURCE_GROUP" --output tsv/);
  assert.match(workflow, /\.\/scripts\/delete-resource-group\.sh/);
});

test('resource group lifecycle scripts should only manage rg-fullswing-blog', () => {
  const ensureScript = readRepoFile('scripts/ensure-resource-group.sh');
  const deleteScript = readRepoFile('scripts/delete-resource-group.sh');
  const infra = readRepoFile('infra/main.bicep');

  assert.match(ensureScript, /EXPECTED_RESOURCE_GROUP="rg-fullswing-blog"/);
  assert.match(ensureScript, /az group create --name "\$resource_group" --location "\$location" --output none/);

  assert.match(deleteScript, /EXPECTED_RESOURCE_GROUP="rg-fullswing-blog"/);
  assert.match(deleteScript, /az group delete --name "\$resource_group" --yes --no-wait --output none/);
  assert.match(deleteScript, /while \[\[ "\$\(az group exists --name "\$resource_group" --output tsv\)" == "true" \]\]/);

  assert.match(infra, /targetScope = 'resourceGroup'/);
});
