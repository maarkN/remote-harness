#!/bin/sh
# Builds and runs the US connection relay on the site's server behind Traefik (deploy/compose.yml).
#   REMOTE_HARNESS_WEB_SSH    user@host of the server (required)
#   REMOTE_HARNESS_RELAY_DIR  folder on the server (default /srv/remote-harness-relay)
# The image is built on the server from the copied sources, whatever its architecture.
set -eu

host=${REMOTE_HARNESS_WEB_SSH:-}
[ -n "$host" ] || { echo "✗ set REMOTE_HARNESS_WEB_SSH (user@host of the server)" >&2; exit 1; }
dir=${REMOTE_HARNESS_RELAY_DIR:-/srv/remote-harness-relay}

cd "$(dirname "$0")/.."
echo "▸ go vet and go test"
go vet ./...
go test ./...

echo "▸ copy to $host:$dir"
ssh "$host" "mkdir -p '$dir'"
tar -cf - --exclude='*_test.go' Dockerfile .dockerignore go.mod go.sum main.go internal -C deploy compose.yml |
  ssh "$host" "tar -xf - -C '$dir'"

echo "▸ docker compose up"
ssh "$host" "cd '$dir' && docker compose up -d --build --wait --quiet-pull"
echo "✓ deployed"
