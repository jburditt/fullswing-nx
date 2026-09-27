#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_RESOURCE_GROUP="rg-fullswing-blog"
resource_group="${AZURE_RESOURCE_GROUP:-$EXPECTED_RESOURCE_GROUP}"
location="${AZURE_LOCATION:-}"

if [[ "$resource_group" != "$EXPECTED_RESOURCE_GROUP" ]]; then
  echo "Refusing to manage unexpected resource group: $resource_group" >&2
  exit 1
fi

if [[ -z "$location" ]]; then
  echo "AZURE_LOCATION must be set before provisioning." >&2
  exit 1
fi

if [[ "$(az group exists --name "$resource_group" --output tsv)" == "true" ]]; then
  echo "Reusing existing resource group $resource_group."
  exit 0
fi

echo "Creating resource group $resource_group in $location."
az group create --name "$resource_group" --location "$location" --output none
