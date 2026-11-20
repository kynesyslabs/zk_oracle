import { ethers } from "ethers"
import { ConfigError, loadConfig, type OracleConfig } from "./config"
import { RegistryClient } from "./contract"
import { DemosReader } from "./demos"
import { startHealthServer, type HealthServer } from "./health"
import { loadWalletFromKeystore } from "./keystore"
import { Oracle } from "./oracle"
import { errorMessage, urlOrigin } from "./redact"

let config: OracleConfig
try {
    config = loadConfig()
} catch (err) {
    console.error(`[oracle] ${errorMessage(err)}`)
    if (err instanceof ConfigError) console.error("[oracle] Copy .env.example to .env and fill in the values")
    process.exit(1)
}

// Read on demand and never stored in the config object, where it could be
// serialised or logged.
const password = process.env.KEYSTORE_PASSWORD
if (!password) {
    console.error("[oracle] Missing required environment variable: KEYSTORE_PASSWORD")
    process.exit(1)
}

console.log(`[oracle] Loading wallet from keystore: ${config.keystorePath}`)
let registry: RegistryClient
try {
    const wallet = await loadWalletFromKeystore(config.keystorePath, password)
    const provider = new ethers.JsonRpcProvider(config.evm.rpcUrl, config.evm.chainId, {
        staticNetwork: ethers.Network.from(config.evm.chainId),
    })
    registry = new RegistryClient(wallet, provider, config.evm)
    await registry.assertNetwork()
} catch (err) {
    console.error(`[oracle] ${errorMessage(err)}`)
    process.exit(1)
}

console.log(`[oracle] Oracle ${registry.oracleAddress} on ${config.evm.networkName} (chain ${config.evm.chainId}), registry ${config.evm.contractAddress}`)
console.log(`[oracle] Demos nodes: ${config.demos.urls.map(urlOrigin).join(", ")} (quorum ${config.demos.quorum}${config.demos.requireAllReachable ? ", all reachable must agree" : ""})`)

const oracle = new Oracle(
    new DemosReader({ ...config.demos, maxBlockNumber: config.maxBlockNumber }),
    registry,
    config.evm.networkName,
    undefined,
    undefined,
    { maxLagTicks: config.maxLagTicks },
)

// A tick can wait on a vote through every fee bump; count that as fresh.
const staleAfterMs = config.pollIntervalMs * 3 + config.demos.fetchTimeoutMs
let health: HealthServer | null = null
if (config.health.port > 0) {
    health = startHealthServer(config.health.port, config.health.host, () => oracle.health(staleAfterMs))
    console.log(`[oracle] Health on http://${config.health.host}:${health.port}/health`)
}

let stopped = false
let timer: ReturnType<typeof setTimeout> | null = null

// Sequential ticks: the next starts only after the previous one, vote included,
// has finished, so two votes never race for the same nonce.
async function loop(): Promise<void> {
    if (stopped) return
    await oracle.tick()
    if (!stopped) timer = setTimeout(loop, config.pollIntervalMs)
}

function shutdown(signal: string): void {
    console.log(`[oracle] Received ${signal}, shutting down`)
    stopped = true
    if (timer) clearTimeout(timer)
    health?.stop()
    process.exit(0)
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

void loop()
