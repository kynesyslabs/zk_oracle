#!/usr/bin/env bash
# ── zk-oracle-server startup script ──────────────────────────────────────────
# Usage:
#   ./start.sh            — build image and start in background
#   ./start.sh logs       — tail logs
#   ./start.sh stop       — stop and remove container
#   ./start.sh restart    — stop, rebuild, start

COMMAND="${1:-up}"

err() { echo "Error: $*" >&2; exit 1; }

check_deps() {
    command -v docker >/dev/null 2>&1 || err "docker is not installed"
    docker compose version >/dev/null 2>&1 || err "docker compose plugin is not available (requires Docker v2)"
}

check_env() {
    [ -f .env ] || err ".env file not found — run: cp .env.example .env"

    # Use grep with || true so set -e does not trigger on no-match
    local keystore
    keystore=$(grep -E '^KEYSTORE_PATH=' .env | cut -d= -f2 | tr -d '"' | tr -d "'" || true)

    [ -n "$keystore" ] || err "KEYSTORE_PATH is not set in .env"

    # Resolve ./relative and plain filenames to absolute path
    case "$keystore" in
        /*) ;;                                      # already absolute
        ./*) keystore="$(pwd)/${keystore#./}" ;;    # strip leading ./
        *)   keystore="$(pwd)/$keystore" ;;         # bare filename
    esac

    [ -f "$keystore" ] || err "keystore file not found: $keystore
  Run: ORACLE_PRIVATE_KEY=0x... bun run encrypt-key"
}

case "$COMMAND" in
    up)
        check_deps
        check_env
        echo "Building image and starting oracle..."
        docker compose up -d --build
        echo "Started. Follow logs with: ./start.sh logs"
        ;;
    logs)
        docker compose logs -f
        ;;
    stop)
        docker compose down
        echo "Stopped."
        ;;
    restart)
        check_deps
        check_env
        echo "Stopping..."
        docker compose down
        echo "Rebuilding and starting..."
        docker compose up -d --build
        echo "Restarted. Follow logs with: ./start.sh logs"
        ;;
    *)
        echo "Usage: ./start.sh [up|logs|stop|restart]"
        exit 1
        ;;
esac
