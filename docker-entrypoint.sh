#!/usr/bin/env sh
set -eu

# Inside the container localhost is the container itself; point local Demos
# node URLs at the host instead. Only the running process sees the change.
to_host() {
  printf '%s' "$1" | sed \
    -e 's#//localhost\([:/,]\)#//host.docker.internal\1#g' -e 's#//localhost$#//host.docker.internal#' \
    -e 's#//127\.0\.0\.1\([:/,]\)#//host.docker.internal\1#g' -e 's#//127\.0\.0\.1$#//host.docker.internal#'
}
if [ -n "${DEMOS_RPC_URLS:-}" ]; then DEMOS_RPC_URLS="$(to_host "$DEMOS_RPC_URLS")"; export DEMOS_RPC_URLS; fi
if [ -n "${DEMOS_RPC_URL:-}" ]; then DEMOS_RPC_URL="$(to_host "$DEMOS_RPC_URL")"; export DEMOS_RPC_URL; fi

if [ -z "${KEYSTORE_PATH:-}" ]; then
  echo "[entrypoint] KEYSTORE_PATH is not set" >&2
  exit 1
fi

if [ -f "$KEYSTORE_PATH" ]; then
  # The supported path: an encrypted keystore file mounted read-only.
  if [ -n "${ORACLE_PRIVATE_KEY:-}" ]; then
    echo "[entrypoint] ORACLE_PRIVATE_KEY ignored: using the mounted keystore $KEYSTORE_PATH" >&2
  fi
elif [ "${ALLOW_ENV_PRIVATE_KEY:-}" = "1" ] && [ -n "${ORACLE_PRIVATE_KEY:-}" ]; then
  # Development fallback only: the raw key sits in the deployment's environment,
  # where every process and anyone who can read the service config can see it.
  echo "[entrypoint] WARNING: minting $KEYSTORE_PATH from ORACLE_PRIVATE_KEY (ALLOW_ENV_PRIVATE_KEY=1, development only)" >&2
  bun -e 'import { Wallet } from "ethers"; import { writeFileSync, mkdirSync } from "node:fs"; import { dirname } from "node:path"; const p = process.env.KEYSTORE_PATH; mkdirSync(dirname(p), { recursive: true }); const w = new Wallet(process.env.ORACLE_PRIVATE_KEY); writeFileSync(p, await w.encrypt(process.env.KEYSTORE_PASSWORD), { mode: 0o600 }); console.log("[entrypoint] keystore ready for", w.address);'
else
  echo "[entrypoint] no keystore at $KEYSTORE_PATH: mount the encrypted keystore file there (see README, Key management)" >&2
  exit 1
fi
unset ORACLE_PRIVATE_KEY ALLOW_ENV_PRIVATE_KEY

exec "$@"
