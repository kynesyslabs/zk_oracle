import { config } from "./config"
import { OracleContract } from "./contract"
import type { KeystoreWallet } from "./keystore"
import type { MerkleRootSnapshot } from "./types"

let contract: OracleContract
let lastKnownLeafCount = 0
let submitting = false  // prevent concurrent submissions
let running = false

async function fetchMerkleRoot(): Promise<MerkleRootSnapshot> {
    const url = `${config.demosRpcUrl}/zk/merkle-root`
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}`)
    }
    return response.json() as Promise<MerkleRootSnapshot>
}

async function tick(): Promise<void> {
    let snapshot: MerkleRootSnapshot

    try {
        snapshot = await fetchMerkleRoot()
    } catch (err) {
        console.warn(`[oracle] Failed to fetch merkle root: ${err instanceof Error ? err.message : String(err)}`)
        return
    }

    const { rootHash, blockNumber, leafCount } = snapshot
    const ts = new Date().toISOString()
    console.log(`[oracle] ${ts} | block: ${blockNumber} | leafCount: ${leafCount} | root: ${rootHash}`)

    if (leafCount <= lastKnownLeafCount) {
        return
    }

    // Guard: skip if a submission is already in flight
    if (submitting) {
        console.log(`[oracle] Submission already in progress, skipping this tick`)
        return
    }

    submitting = true
    // Optimistically advance cursor to prevent a second tick from re-submitting
    const prevLeafCount = lastKnownLeafCount
    lastKnownLeafCount = leafCount

    console.log(`[oracle] New root detected — leafCount: ${leafCount}, block: ${blockNumber}, root: ${rootHash}`)

    try {
        const txHash = await contract.submitVote(rootHash, blockNumber, leafCount)
        console.log(`[oracle] Vote submitted to Base Sepolia — tx: ${txHash}`)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const code = (err as any)?.code ?? ""

        // StaleRoot or AlreadyVoted: root already on-chain — keep cursor advanced, move on
        if (
            message.includes("StaleRoot") ||
            message.includes("Stale") ||
            message.includes("AlreadyVoted") ||
            // Custom solidity errors come back as CALL_EXCEPTION when not decoded
            // If we already advanced the cursor and get a revert, treat as already handled
            code === "CALL_EXCEPTION"
        ) {
            console.warn(`[oracle] Vote already recorded on-chain for block ${blockNumber} (${code || "known revert"})`)
        } else {
            // Unexpected error — roll back cursor so next tick retries
            lastKnownLeafCount = prevLeafCount
            console.error(`[oracle] Failed to submit vote: ${message}`)
        }
    } finally {
        submitting = false
    }
}

export function startOracle(wallet: KeystoreWallet): void {
    if (running) return
    running = true
    contract = new OracleContract(wallet)

    console.log(`[oracle] Starting — polling ${config.demosRpcUrl}/zk/merkle-root every ${config.pollIntervalMs}ms`)

    tick()
    setInterval(tick, config.pollIntervalMs)
}
