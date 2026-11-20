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

// BN254 scalar field modulus. A Poseidon merkle root is a field element in
// [1, FIELD). The Demos node returns it as a DECIMAL string — that's the form
// ZK circuits consume — while the registry stores a bytes32. We normalise the
// field element to a 32-byte hex string here, at the one boundary it enters the
// chain, so a decimal root is never misread as hex.
const BN254_FIELD =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n

/**
 * Parse the node's rootHash — a decimal field element, or an explicit 0x-hex
 * value — into a canonical 32-byte hex string. Rejects anything that isn't a
 * valid, non-zero field element before it can reach the contract.
 */
function normaliseRoot(rootHash: unknown): string {
    if (typeof rootHash !== "string" || rootHash.length === 0) {
        throw new InvalidSnapshotError(`rootHash must be a string, got ${JSON.stringify(rootHash)}`)
    }
    let value: bigint
    try {
        if (/^0x[0-9a-fA-F]+$/.test(rootHash)) {
            value = BigInt(rootHash) // explicit hex
        } else if (/^[0-9]+$/.test(rootHash)) {
            value = BigInt(rootHash) // decimal field element — the node's format
        } else {
            throw new Error("not a decimal or 0x-hex value")
        }
    } catch {
        throw new InvalidSnapshotError(
            `rootHash must be a decimal or 0x-hex field element, got ${JSON.stringify(rootHash)}`,
        )
    }
    if (value === 0n) {
        throw new InvalidSnapshotError("rootHash is zero (empty/uninitialised tree)")
    }
    if (value >= BN254_FIELD) {
        throw new InvalidSnapshotError(`rootHash ${rootHash} is not a valid field element`)
    }
    return `0x${value.toString(16).padStart(64, "0")}`
}

/**
 * Validate a `/zk/merkle-root` response before it is ever put on-chain.
 *
 * The registry takes whatever a whitelisted oracle submits and, once finalised,
 * only ever accepts a strictly-larger block number — so a single malformed read
 * (a NaN block, a garbage root, an absurd height) can wedge it. Reject anything
 * that isn't well-formed here, at the one place it enters the chain.
 *
 * @param raw   The parsed JSON body from the node.
 * @param opts.allowEmptyTree  Accept the empty tree (block 0, no leaves).
 * @param opts.maxBlockNumber  Optional ceiling; reject blocks above it. A cheap
 *              sanity bound against a corrupted read, disabled when omitted.
 * @throws InvalidSnapshotError on anything that isn't safe to submit.
 */
export function parseSnapshot(
    raw: unknown,
    opts: { maxBlockNumber?: number; allowEmptyTree?: boolean } = {},
): MerkleRootSnapshot {
    if (raw === null || typeof raw !== "object") {
        throw new InvalidSnapshotError(`expected an object, got ${typeof raw}`)
    }
    const { rootHash, blockNumber, leafCount } = raw as Record<string, unknown>

    // The node hands back the root as a decimal field element; the registry
    // takes bytes32. Normalise + validate before anything else.
    const root = normaliseRoot(rootHash)

    // A chain with no registration yet reports block 0 and no leaves. That is a
    // valid "nothing to anchor" answer, never something to vote on.
    const emptyTree = opts.allowEmptyTree === true && blockNumber === 0 && leafCount === 0
    if (!emptyTree && (!isSafeNonNegativeInt(blockNumber) || (blockNumber as number) <= 0)) {
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
        rootHash: root,
        blockNumber: blockNumber as number,
        leafCount: leafCount as number,
    }
}

function isSafeNonNegativeInt(v: unknown): v is number {
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0
}

/** The chain a node is on, as `getChainIdentity` reports it. */
export interface ChainIdentity {
    chainId: number | null
    /** Block-0 hash as 0x + 64 lower-case hex: the registry's epoch id. */
    genesisHash: string
}

/**
 * Validate the `response` of the node's `getChainIdentity` call. The genesis
 * hash is what the registry keys epochs by, so it must be an exact 32-byte value.
 */
export function parseChainIdentity(raw: unknown): ChainIdentity {
    if (raw === null || typeof raw !== "object") {
        throw new InvalidSnapshotError(`chain identity must be an object, got ${typeof raw}`)
    }
    const { chainId, genesisHash } = raw as Record<string, unknown>
    if (typeof genesisHash !== "string" || !/^(0x)?[0-9a-fA-F]{64}$/.test(genesisHash)) {
        throw new InvalidSnapshotError(`genesisHash must be 32 bytes of hex, got ${JSON.stringify(genesisHash)}`)
    }
    if (chainId !== null && !isSafeNonNegativeInt(chainId)) {
        throw new InvalidSnapshotError(`chainId must be an integer or null, got ${JSON.stringify(chainId)}`)
    }
    return {
        chainId: chainId as number | null,
        genesisHash: `0x${genesisHash.replace(/^0x/, "").toLowerCase()}`,
    }
}
