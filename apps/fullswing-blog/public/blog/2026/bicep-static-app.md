Terraform works fine for Azure Static Web Apps, but it means managing a state file/backend for a resource that Azure already tracks itself. Bicep plus the Azure Developer CLI (`azd`) gives the same deploy/destroy/redeploy workflow without that overhead, and it fits naturally into a repo that already ships its own build output.

## Why Bicep + azd instead of Terraform

- No state file to store, lock, or lose — ARM tracks the deployed resource state server-side.
- `azd up` / `azd down` map directly to provision+deploy / teardown, which is exactly the deploy-to-save-costs-then-redeploy cycle a personal blog needs.
- A Static Web App is stateless: content is rebuilt from the repo on every deploy, so tearing the resource down between updates loses nothing.

## Files

**`infra/main.bicep`** declares the Static Web App resource:

```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

output staticWebAppDeploymentToken string = staticWebApp.listSecrets().properties.apiKey
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
```

**`infra/main.bicepparam`** supplies the default parameter values (name, region, SKU) so the template can be deployed without extra flags.

**`azure.yaml`** is the `azd` project file. It points at the compiled `dist/` output and runs the project's own build before packaging:

```yaml
resourceGroup: rg-typescript-blog

hooks:
  preprovision:
    shell: sh
    run: ./scripts/ensure-resource-group.sh
  postdown:
    shell: sh
    run: ./scripts/delete-resource-group.sh

services:
  web:
    project: .
    language: js
    host: staticwebapp
    dist: dist
    hooks:
      prepackage:
        shell: sh
        run: npm run build
```

## One-time setup

1. `azd auth login`
2. `azd env new typescript-blog`
3. `azd up` — creates or reuses `rg-typescript-blog`, provisions the Static Web App from `infra/main.bicep`, and deploys the current build

## Everyday workflow

- `azd up` — redeploy after content changes; reuses or recreates `rg-typescript-blog` as needed
- `azd down --purge` — tear down the app and then delete `rg-typescript-blog` entirely to stop paying for it between updates
- `azd up` again later — same Bicep template, same parameters, a fresh Static Web App with the latest build

## CI

`azd pipeline config` wires up GitHub OIDC federated credentials automatically, so CI never needs a stored client secret. The workflow ensures `rg-typescript-blog` exists before `azd up`, and on destroy it tears down the app and then deletes that resource group:

```yaml
- name: Deploy
  run: |
    ./scripts/ensure-resource-group.sh
    azd up --no-prompt

- name: Destroy
  if: inputs.action == 'down'
  run: |
    azd down --force --purge
    ./scripts/delete-resource-group.sh
```

### `azd pipeline config` walkthrough

Run the following command to use **Federated User Managed Identity (MSI + OIDC)** to handle the Github action authentication to Azure

Running `azd pipeline config --provider github` is interactive; here's what it asks for and why:

1. **Azure login** — prompts to log in if you aren't already. If your tenant enforces MFA, sign in against the specific tenant first: `azd auth login --tenant-id <tenant>`.
2. **Environment name** — creates (or reuses) an `azd` environment, e.g. `dev`. This maps to the `AZURE_ENV_NAME` value used by `azd up`/`azd down`.
3. **Azure subscription and location** — pick the subscription and region the Static Web App (and supporting identity) should live in.
4. **Resource group** — Use `rg-typescript-blog`. If you use another value, you will need to update the yaml files
5. **Missing workflow file** — if `.github/workflows/deploy.yml` doesn't exist yet, `azd` offers to generate a starter workflow.
6. **GitHub CLI login** — if you're not authenticated with `gh`, it walks through a device-code browser login.
7. **Pipeline auth method** — choose **Federated User Managed Identity (MSI + OIDC)** to avoid storing any client secret. `azd` creates the MSI, assigns it the needed roles, and adds federated credentials scoped to the repo's `main` branch and pull requests.
8. **Repo variables** — `azd` sets `AZURE_CLIENT_ID`, `AZURE_ENV_NAME`, `AZURE_LOCATION`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_TENANT_ID` as GitHub Actions repo variables so the workflow can authenticate via OIDC.
9. **Commit and push** — optionally commits the new workflow file and pushes to `origin` to kick off the first run. Declining just means you push manually later:

   ```bash
   git add .
   git commit -m "Add azd GitHub Actions pipeline config"
   git push --set-upstream origin main
   ```

After this, every push to `main` runs the workflow using the federated identity — no long-lived secrets in GitHub.

## What not to put in this template

Keep anything that should survive a teardown — a database, storage account, custom domain binding — in a separate Bicep module or resource group. That way `azd down` for the blog's Static Web App never touches it.
