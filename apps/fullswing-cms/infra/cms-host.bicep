targetScope = 'resourceGroup'

@description('Azure region for the CMS App Service.')
param location string = resourceGroup().location

@description('Globally unique App Service name.')
param cmsAppName string

@secure()
@description('Storage account connection string. Stored as a protected App Service setting.')
param blobConnectionString string

@description('Private Azure Blob container used by the CMS composition.')
param blobContainerName string = 'fullswing-cms-state'

@secure()
@description('Base64-encoded 32-byte AES-256-GCM key for the CMS SecretStore.')
param secretEncryptionKey string

@description('Microsoft Entra tenant ID.')
param entraTenantId string

@description('Microsoft Entra application/client ID.')
param entraClientId string

@secure()
@description('Microsoft Entra confidential-client secret.')
param entraClientSecret string

@description('Registered Entra callback URI for this App Service hostname.')
param entraRedirectUri string

@description('Comma-separated administrator object IDs in the Entra tenant.')
param adminObjectIds string

@secure()
@description('CMS cookie-signing secret with at least 32 characters.')
param sessionCookieSecret string

resource hostingPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${cmsAppName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: 'F1'
    tier: 'Free'
    size: 'F1'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource cmsApp 'Microsoft.Web/sites@2022-09-01' = {
  name: cmsAppName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'node apps/fullswing-cms/.build/src/index.js'
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

resource cmsAppSettings 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: cmsApp
  name: 'appsettings'
  properties: {
    CMS_BOOTSTRAP_MODULE: './apps/fullswing-cms/blob-composition.mjs'
    CMS_BLOB_CONNECTION_STRING: blobConnectionString
    CMS_BLOB_CONTAINER_NAME: blobContainerName
    CMS_SECRET_ENCRYPTION_KEY: secretEncryptionKey
    CMS_ENTRA_TENANT_ID: entraTenantId
    CMS_ENTRA_CLIENT_ID: entraClientId
    CMS_ENTRA_CLIENT_SECRET: entraClientSecret
    CMS_ENTRA_REDIRECT_URI: entraRedirectUri
    CMS_ADMIN_OBJECT_IDS: adminObjectIds
    CMS_SESSION_COOKIE_SECRET: sessionCookieSecret
    NODE_ENV: 'production'
    PORT: '8080'
    WEBSITE_RUN_FROM_PACKAGE: '1'
    SCM_DO_BUILD_DURING_DEPLOYMENT: 'false'
  }
}

output cmsAppName string = cmsApp.name
output cmsHostname string = cmsApp.properties.defaultHostName
output cmsUrl string = 'https://${cmsApp.properties.defaultHostName}'