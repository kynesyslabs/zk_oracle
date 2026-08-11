#!/usr/bin/env sh
# Translate localhost → host.docker.internal so the container reaches the host.
# The .env value is left unchanged — this only affects the running process.
DEMOS_RPC_URL="${DEMOS_RPC_URL/localhost/host.docker.internal}"
export DEMOS_RPC_URL

# Env-only deploys (Coolify, Kubernetes, a secret manager): if no keystore file is
# present but a raw key is supplied via ORACLE_PRIVATE_KEY, mint the encrypted
# keystore at startup so nothing has to be baked into the image or mounted. The
# raw key is dropped from the environment immediately afterwards.
if [ -n "${ORACLE_PRIVATE_KEY:-}" ] && [ -n "${KEYSTORE_PATH:-}" ] && [ ! -f "$KEYSTORE_PATH" ]; then
  echo "[entrypoint] minting keystore at $KEYSTORE_PATH from ORACLE_PRIVATE_KEY"
  bun -e 'import { Wallet } from "ethers"; import { writeFileSync, mkdirSync } from "node:fs"; import { dirname } from "node:path"; const p = process.env.KEYSTORE_PATH; mkdirSync(dirname(p), { recursive: true }); const w = new Wallet(process.env.ORACLE_PRIVATE_KEY); const json = await w.encrypt(process.env.KEYSTORE_PASSWORD); writeFileSync(p, json, { mode: 0o600 }); console.log("[entrypoint] keystore ready for", w.address);'
  unset ORACLE_PRIVATE_KEY
fi

exec "$@"
