targetScope = 'resourceGroup'

@description('Azure region for the persistent CMS content account.')
param location string = resourceGroup().location

@description('GitHub Actions service principal object ID. It receives read-only access for static-site builds.')
param staticBuildPrincipalObjectId string

@description('Storage account name. Must be globally unique and use lowercase letters and numbers only.')
param storageAccountName string = 'fscms${uniqueString(resourceGroup().id)}'

@description('Private container used for CMS content and runtime state.')
param containerName string = 'fullswing-cms-state'

var storageBlobDataReaderRoleId = '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  tags: {
    project: 'fullswing-cms'
    data: 'persistent-content'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource contentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

resource staticBuildReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(contentContainer.id, staticBuildPrincipalObjectId, storageBlobDataReaderRoleId)
  scope: contentContainer
  properties: {
    principalId: staticBuildPrincipalObjectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataReaderRoleId)
  }
}

output storageAccountName string = storageAccount.name
output containerName string = contentContainer.name