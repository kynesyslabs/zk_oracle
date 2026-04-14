#!/usr/bin/env sh
# Translate localhost → host.docker.internal so the container reaches the host.
# The .env value is left unchanged — this only affects the running process.
DEMOS_RPC_URL="${DEMOS_RPC_URL/localhost/host.docker.internal}"
export DEMOS_RPC_URL
exec "$@"
