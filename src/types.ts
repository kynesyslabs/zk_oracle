export interface MerkleRootSnapshot {
    rootHash: string
    blockNumber: number
    leafCount: number
}

/** Thrown when the node hands back a snapshot that isn't safe to submit. */
export class InvalidSnapshotError extends Error {
    constructor(message: string) {
        super(`Invalid merkle-root snapshot: ${message}`)
        this.name = "InvalidSnapshotError"
    }
}

const HEX_ROOT = /^(0x)?[0-9a-fA-F]{1,64}$/

/**
 * Validate a `/zk/merkle-root` response before it is ever put on-chain.
 *
 * The registry takes whatever a whitelisted oracle submits and, once finalised,
 * only ever accepts a strictly-larger block number — so a single malformed read
 * (a NaN block, a garbage root, an absurd height) can wedge it. Reject anything
 * that isn't well-formed here, at the one place it enters the chain.
 *
 * @param raw   The parsed JSON body from the node.
 * @param opts.maxBlockNumber  Optional ceiling; reject blocks above it. A cheap
 *              sanity bound against a corrupted read, disabled when omitted.
 * @throws InvalidSnapshotError on anything that isn't safe to submit.
 */
export function parseSnapshot(
    raw: unknown,
    opts: { maxBlockNumber?: number } = {},
): MerkleRootSnapshot {
    if (raw === null || typeof raw !== "object") {
        throw new InvalidSnapshotError(`expected an object, got ${typeof raw}`)
    }
    const { rootHash, blockNumber, leafCount } = raw as Record<string, unknown>

    if (typeof rootHash !== "string" || !HEX_ROOT.test(rootHash)) {
        throw new InvalidSnapshotError(`rootHash must be a hex string, got ${JSON.stringify(rootHash)}`)
    }
    // An all-zero root is the empty/uninitialised value, never a real tree.
    if (/^(0x)?0*$/.test(rootHash)) {
        throw new InvalidSnapshotError("rootHash is zero")
    }

    if (!isSafeNonNegativeInt(blockNumber) || (blockNumber as number) <= 0) {
        throw new InvalidSnapshotError(`blockNumber must be a positive integer, got ${JSON.stringify(blockNumber)}`)
    }
    if (opts.maxBlockNumber !== undefined && (blockNumber as number) > opts.maxBlockNumber) {
        throw new InvalidSnapshotError(
            `blockNumber ${blockNumber} exceeds the sanity ceiling ${opts.maxBlockNumber}`,
        )
    }

    if (!isSafeNonNegativeInt(leafCount)) {
        throw new InvalidSnapshotError(`leafCount must be a non-negative integer, got ${JSON.stringify(leafCount)}`)
    }

    return {
        rootHash,
        blockNumber: blockNumber as number,
        leafCount: leafCount as number,
    }
}

function isSafeNonNegativeInt(v: unknown): v is number {
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0
}
