#!/bin/sh
# Builds the site and runs it on the server behind Traefik (deploy/compose.yml).
#   REMOTE_HARNESS_WEB_SSH  user@host of the server (required)
#   REMOTE_HARNESS_WEB_DIR  folder on the server (default /srv/remote-harness-web)
#   APP_INSTALL_URL         install link the landing's iPhone & iPad card opens (`/app/<token>/`), written
#                           to the server's `.env` when set; the token never goes into the repository
# The server keeps `.env` (publish tokens, generated there on the first deploy) and `data/`.
set -eu

host=${REMOTE_HARNESS_WEB_SSH:-}
[ -n "$host" ] || { echo "✗ set REMOTE_HARNESS_WEB_SSH (user@host of the server)" >&2; exit 1; }
dir=${REMOTE_HARNESS_WEB_DIR:-/srv/remote-harness-web}
install_url=${APP_INSTALL_URL:-}
case $install_url in
  '' | /* | https://*) ;;
  *) echo "✗ APP_INSTALL_URL must be a path (/app/<token>/) or an https URL" >&2; exit 1 ;;
esac
case $install_url in *[!A-Za-z0-9._~/:-]*) echo "✗ APP_INSTALL_URL has unexpected characters" >&2; exit 1 ;; esac

cd "$(dirname "$0")/.."
echo "▸ vite build"
pnpm exec vite build --logLevel warn

echo "▸ copy to $host:$dir"
ssh "$host" "mkdir -p '$dir/data/updates' '$dir/data/app'"
scp -q deploy/Dockerfile deploy/compose.yml dist/server.js "$host:$dir/"

echo "▸ docker compose up"
ssh "$host" sh -s -- "$dir" "'$install_url'" <<'REMOTE'
set -eu
cd "$1"
if [ ! -f .env ]; then
  (umask 077 && printf 'UPDATES_TOKEN=%s\nUPDATES_DEV_TOKEN=%s\n' \
    "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env)
  echo "▸ new publish tokens in $1/.env"
fi
if [ -n "${2:-}" ]; then
  (umask 077 && { grep -v '^APP_INSTALL_URL=' .env || true; printf 'APP_INSTALL_URL=%s\n' "$2"; } > .env.new)
  mv .env.new .env
  echo "▸ APP_INSTALL_URL set in $1/.env"
fi
# The container runs as `node` (uid 1000) and writes updates; install links are uploaded over SSH.
chown -R 1000:1000 data
docker compose up -d --build --wait --quiet-pull
REMOTE
echo "✓ deployed"
