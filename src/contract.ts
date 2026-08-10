import { ethers } from "ethers"
import { config } from "./config"
import { ABI } from "./abi"
import type { KeystoreWallet } from "./keystore"

/**
 * A revert from `submitVote`, decoded to the contract's named custom error.
 * `reason` is the error name (e.g. "StaleRoot", "AlreadyVoted") when we could
 * decode it, or "unknown" when we could not — the caller must not treat an
 * undecodable revert as a benign, already-handled one.
 */
export class OracleSubmitError extends Error {
    constructor(
        readonly reason: string,
        readonly benign: boolean,
        message: string,
    ) {
        super(message)
        this.name = "OracleSubmitError"
    }
}

// Reverts that mean "this root is already accounted for on-chain" — safe to
// skip and move the cursor on. Anything else is a real failure to surface.
const BENIGN_REVERTS = new Set(["StaleRoot", "AlreadyVoted"])

/**
 * Thin wrapper around ZKOracleRegistry on Base Sepolia.
 * The wallet is injected from the decrypted keystore — this class never reads
 * the private key directly.
 */
export class OracleContract {
    private contract: ethers.Contract

    constructor(wallet: KeystoreWallet) {
        const provider = new ethers.JsonRpcProvider(config.evm.rpcUrl)
        this.contract = new ethers.Contract(
            config.evm.contractAddress,
            ABI,
            wallet.connect(provider),
        )
    }

    /**
     * Cast this oracle's vote for a new ZK merkle root.
     * When `threshold` unique oracles submit the same (root, block, leafCount),
     * the contract finalises it automatically.
     * @returns the transaction hash.
     * @throws OracleSubmitError with the decoded revert reason on failure.
     */
    async submitVote(rootHash: string, blockNumber: number, leafCount: number): Promise<string> {
        const normalised = normaliseBytes32(rootHash)
        try {
            const tx = await this.contract.submitVote(
                normalised,
                BigInt(blockNumber),
                BigInt(leafCount),
            )
            const receipt = await tx.wait()
            return receipt.hash as string
        } catch (err) {
            throw this.decodeError(err)
        }
    }

    /**
     * Turn an ethers error into a named `OracleSubmitError`. A raw CALL_EXCEPTION
     * carries the ABI-encoded revert; decode it against the contract interface so
     * the caller knows *which* revert it was rather than lumping every failure
     * together as "already recorded".
     */
    private decodeError(err: unknown): OracleSubmitError {
        const data = extractRevertData(err)
        if (data) {
            const parsed = this.contract.interface.parseError(data)
            if (parsed) {
                return new OracleSubmitError(
                    parsed.name,
                    BENIGN_REVERTS.has(parsed.name),
                    `submitVote reverted: ${parsed.name}(${parsed.args.join(", ")})`,
                )
            }
        }
        const message = err instanceof Error ? err.message : String(err)
        return new OracleSubmitError("unknown", false, `submitVote failed: ${message}`)
    }
}

/** Pull the revert payload out of the various shapes ethers wraps it in. */
function extractRevertData(err: unknown): string | null {
    if (!err || typeof err !== "object") return null
    const e = err as Record<string, unknown>
    if (typeof e.data === "string" && e.data.startsWith("0x")) return e.data
    const info = e.info as { error?: { data?: unknown } } | undefined
    const nested = info?.error?.data
    if (typeof nested === "string" && nested.startsWith("0x")) return nested
    const revert = (e.revert as { data?: unknown } | undefined)?.data
    if (typeof revert === "string" && revert.startsWith("0x")) return revert
    return null
}

// parseSnapshot already normalises the root to a canonical 32-byte hex string,
// so this is a strict guard, not a converter: never silently truncate or pad a
// value into bytes32, which would put a wrong root on-chain.
function normaliseBytes32(value: string): string {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(`expected a 0x-prefixed 32-byte hex root, got ${value}`)
    }
    return value.toLowerCase()
}
