#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_RESOURCE_GROUP="rg-fullswing-blog"
resource_group="${AZURE_RESOURCE_GROUP:-$EXPECTED_RESOURCE_GROUP}"

if [[ "$resource_group" != "$EXPECTED_RESOURCE_GROUP" ]]; then
  echo "Refusing to delete unexpected resource group: $resource_group" >&2
  exit 1
fi

if [[ "$(az group exists --name "$resource_group" --output tsv)" != "true" ]]; then
  echo "Resource group $resource_group is already absent."
  exit 0
fi

echo "Deleting resource group $resource_group."
az group delete --name "$resource_group" --yes --no-wait --output none

while [[ "$(az group exists --name "$resource_group" --output tsv)" == "true" ]]; do
  sleep 5
done
