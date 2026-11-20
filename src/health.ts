import type { HealthSnapshot } from "./oracle"

export interface HealthServer {
    readonly port: number
    stop(): void
}

/**
 * GET /health: the oracle's state as JSON, 200 when healthy and 503 otherwise,
 * so a container healthcheck or an uptime probe can alert on it directly.
 */
export function startHealthServer(
    port: number,
    hostname: string,
    snapshot: () => HealthSnapshot,
): HealthServer {
    const server = Bun.serve({
        port,
        hostname,
        fetch(req) {
            const { pathname } = new URL(req.url)
            if (req.method !== "GET" || (pathname !== "/health" && pathname !== "/healthz")) {
                return new Response("not found", { status: 404 })
            }
            const body = snapshot()
            return Response.json(body, { status: body.healthy ? 200 : 503 })
        },
    })
    return { port: server.port ?? port, stop: () => server.stop(true) }
}
