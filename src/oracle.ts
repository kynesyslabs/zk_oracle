import { config } from "./config"
import { OracleContract, OracleSubmitError } from "./contract"
import type { KeystoreWallet } from "./keystore"
import { parseSnapshot, type MerkleRootSnapshot } from "./types"

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
    // Validate at the boundary: a malformed read must never reach the contract,
    // where a bad block number can wedge the registry.
    return parseSnapshot(await response.json(), { maxBlockNumber: config.maxBlockNumber })
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
        // Only a decoded StaleRoot/AlreadyVoted means the root is already
        // accounted for — keep the cursor advanced and move on. Every other
        // revert (paused, jump-too-large, an undecodable failure) is real: roll
        // the cursor back so the next tick retries, and surface it loudly. The
        // old code treated *any* CALL_EXCEPTION as "already recorded", which
        // silently swallowed genuine failures — including a wedged registry.
        if (err instanceof OracleSubmitError && err.benign) {
            console.warn(`[oracle] Root already recorded on-chain for block ${blockNumber} (${err.reason})`)
        } else {
            lastKnownLeafCount = prevLeafCount
            const reason = err instanceof OracleSubmitError ? err.reason : "error"
            console.error(`[oracle] Failed to submit vote (${reason}) — will retry: ${err instanceof Error ? err.message : String(err)}`)
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
