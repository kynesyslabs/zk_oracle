import { config } from "./config"
import { startOracle } from "./oracle"
import { loadWalletFromKeystore, type KeystoreWallet } from "./keystore"

// ── Startup validation ────────────────────────────────────────────────────────
const required = ["KEYSTORE_PATH", "KEYSTORE_PASSWORD", "CONTRACT_ADDRESS"]
const missing = required.filter(k => !process.env[k])
if (missing.length > 0) {
    console.error(`[oracle] Missing required environment variables: ${missing.join(", ")}`)
    console.error(`[oracle] Copy .env.example to .env and fill in the values`)
    process.exit(1)
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string): void {
    console.log(`[oracle] Received ${signal} — shutting down`)
    process.exit(0)
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))

// ── Load wallet from encrypted keystore ──────────────────────────────────────
console.log(`[oracle] Loading wallet from keystore: ${config.keystorePath}`)

let wallet: KeystoreWallet
try {
    wallet = await loadWalletFromKeystore(config.keystorePath, config.keystorePassword)
} catch (err) {
    console.error(`[oracle] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
}

console.log(`[oracle] Wallet loaded — address: ${wallet.address}`)

// ── Start ─────────────────────────────────────────────────────────────────────
startOracle(wallet)
