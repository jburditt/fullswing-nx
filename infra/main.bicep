// Provisions the Azure Static Web App for this blog. Re-running after `azd down`
// recreates an identical resource; nothing persisted here needs to survive teardown,
// content is rebuilt from the repo on every deploy.
targetScope = 'resourceGroup'

@description('Name used for the Static Web App resource.')
param staticWebAppName string = 'swa-${uniqueString(resourceGroup().id)}'

@description('Azure region for the Static Web App. Must be one of the supported SWA regions.')
@allowed([
  'eastus2'
  'centralus'
  'westus2'
  'westeurope'
  'eastasia'
])
param location string = 'westus2'

@description('SKU for the Static Web App. Free is sufficient for a personal blog.')
@allowed([
  'Free'
  'Standard'
])
param sku string = 'Free'

@description('Tags applied to all resources, useful for cost tracking across deploy/destroy cycles.')
param tags object = {
  project: 'fullswing-blog'
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  // Required by azd to map the `web` service in azure.yaml to this resource for deploys.
  tags: union(tags, { 'azd-service-name': 'web' })
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    // Deployment is pushed via the Azure Static Web Apps CLI/GitHub Action, not GitHub-connected build.
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

@description('Deployment token used by CI to publish content. Treat as a secret.')
output staticWebAppDeploymentToken string = staticWebApp.listSecrets().properties.apiKey

@description('Default hostname assigned to the Static Web App.')
output staticWebAppHostname string = staticWebApp.properties.defaultHostname

@description('Resource name, echoed for azd/CI convenience.')
output staticWebAppName string = staticWebApp.name
