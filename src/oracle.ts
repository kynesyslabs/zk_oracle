import { OracleSubmitError, type Registry, type RegistryState, type OnChainRoot } from "./contract"
import type { NodeReading, NodeResult, QuorumResult } from "./demos"

export interface NodeSource {
    read(): Promise<QuorumResult>
}

export interface HealthSnapshot {
    healthy: boolean
    network: string
    contract: string
    oracle: string
    submitting: boolean
    lastTickAt: string | null
    lastSuccessfulVoteAt: string | null
    lastVoteTx: string | null
    lastSeenNodeRoot: (NodeReading & { agreeingNodes: number; seenAt: string }) | null
    nodes: Array<{ url: string; ok: boolean; error?: string; blockNumber?: number; rootHash?: string; genesisHash?: string }>
    onChain: {
        epochId: string
        genesisHash: string
        latestRoot: Omit<OnChainRoot, "epochId"> & { epochId: string }
        paused: boolean
        isOracle: boolean
    } | null
    epochMatch: boolean | null
    lagBlocks: number | null
    lastError: { at: string; message: string } | null
}

interface Cursor {
    epochId: bigint
    rootHash: string
    blockNumber: number
    leafCount: number
}

type Log = { info(m: string): void; warn(m: string): void; error(m: string): void }

const consoleLog: Log = {
    info: m => console.log(`[oracle] ${m}`),
    warn: m => console.warn(`[oracle] ${m}`),
    error: m => console.error(`[oracle] ${m}`),
}

/**
 * One oracle's loop: read the Demos nodes, check the registry's epoch, vote.
 * Never votes unless the nodes reach quorum and their chain is the registry's
 * current epoch.
 */
export class Oracle {
    private submitting = false
    private cursor: Cursor | null = null
    private epochMismatchSeen = false
    private tickFailed = false
    private lastTickAt: Date | null = null
    private lastVoteAt: Date | null = null
    private lastVoteTx: string | null = null
    private lastError: { at: Date; message: string } | null = null
    private lastQuorum: QuorumResult | null = null
    private lastReading: { reading: NodeReading; agreeing: number; at: Date } | null = null
    private lastState: RegistryState | null = null
    private epochMatch: boolean | null = null

    constructor(
        private readonly nodes: NodeSource,
        private readonly registry: Registry,
        private readonly networkName: string,
        private readonly log: Log = consoleLog,
        private readonly now: () => Date = () => new Date(),
    ) {}

    async tick(): Promise<void> {
        this.tickFailed = false
        try {
            await this.step()
        } catch (err) {
            this.fail(`tick failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            this.lastTickAt = this.now()
        }
    }

    private async step(): Promise<void> {
        const [quorum, state] = await Promise.all([this.nodes.read(), this.registry.readState()])
        this.lastQuorum = quorum
        this.lastState = state

        if (this.cursor && this.cursor.epochId !== state.epochId) {
            this.log.warn(`registry epoch changed ${this.cursor.epochId} -> ${state.epochId}; cursor reset`)
            this.cursor = null
        }

        if (!quorum.ok) {
            this.epochMatch = null
            return this.fail(`no node quorum: ${quorum.reason}`)
        }
        const reading = quorum.reading
        this.lastReading = { reading, agreeing: quorum.agreeing, at: this.now() }

        this.epochMatch = reading.genesisHash === state.genesisHash
        if (!this.epochMatch) {
            this.epochMismatchSeen = true
            return this.fail(
                `epoch mismatch: nodes are on genesis ${reading.genesisHash}, registry epoch ${state.epochId} is ${state.genesisHash}; ` +
                    `not voting until the owner calls startEpoch for this chain`,
            )
        }
        if (reading.leafCount === 0) return // empty tree on this chain: nothing to anchor yet
        if (!state.isOracle) return this.fail(`${this.registry.oracleAddress} is not an oracle of the registry`)
        if (state.paused) return this.fail("registry is paused")

        const latest = state.latest
        if (reading.blockNumber < latest.blockNumber) {
            return this.fail(
                `nodes report block ${reading.blockNumber}, older than the registry's latest ${latest.blockNumber} in this epoch`,
            )
        }
        if (reading.blockNumber === latest.blockNumber) {
            if (reading.rootHash !== latest.rootHash || reading.leafCount !== latest.leafCount) {
                return this.fail(
                    `registry root at block ${latest.blockNumber} is ${latest.rootHash}/${latest.leafCount}, nodes say ${reading.rootHash}/${reading.leafCount}`,
                )
            }
            return // up to date
        }

        const target: Cursor = {
            epochId: state.epochId,
            rootHash: reading.rootHash,
            blockNumber: reading.blockNumber,
            leafCount: reading.leafCount,
        }
        // The chain is the source of truth for "already voted": a removed
        // oracle bumps the vote key, and then the same root needs a fresh vote.
        if (await this.registry.hasVoted(target.rootHash, target.blockNumber, target.leafCount)) {
            if (!sameCursor(this.cursor, target)) {
                this.log.info(`already voted for block ${target.blockNumber}; waiting for the other oracles`)
            }
            this.cursor = target
            return
        }

        if (this.submitting) {
            this.log.info("a vote is already in flight; skipping this tick")
            return
        }
        this.submitting = true
        try {
            await this.vote(reading, target)
        } finally {
            this.submitting = false
        }
    }

    private async vote(reading: NodeReading, target: Cursor): Promise<void> {
        this.log.info(
            `voting on ${this.networkName}: epoch ${target.epochId} block ${target.blockNumber} leaves ${target.leafCount} root ${target.rootHash}`,
        )
        try {
            const txHash = await this.registry.submitVote(
                reading.genesisHash,
                target.rootHash,
                target.blockNumber,
                target.leafCount,
            )
            this.cursor = target
            this.lastVoteAt = this.now()
            this.lastVoteTx = txHash
            this.epochMismatchSeen = false
            this.log.info(`vote mined on ${this.networkName}: ${txHash}`)
        } catch (err) {
            const reason = err instanceof OracleSubmitError ? err.reason : "error"
            const message = err instanceof Error ? err.message : String(err)
            if (reason === "AlreadyVoted") {
                this.cursor = target
                this.log.warn(`vote for block ${target.blockNumber} already recorded (${message})`)
                return
            }
            if (reason === "StaleRoot" && (await this.staleIsBenign(target))) {
                this.cursor = target
                this.log.warn(`block ${target.blockNumber} was finalised by the other oracles first`)
                return
            }
            this.fail(`vote failed (${reason}): ${message}`)
        }
    }

    /**
     * StaleRoot is harmless only when the registry, in the epoch we voted in,
     * already holds this block or a later one, i.e. the other oracles got there
     * first. After an epoch mismatch it means the registry and the nodes track
     * different chains, which must be fixed, not skipped.
     */
    private async staleIsBenign(target: Cursor): Promise<boolean> {
        if (this.epochMismatchSeen) return false
        const state = await this.registry.readState()
        this.lastState = state
        return state.epochId === target.epochId && state.latest.blockNumber >= target.blockNumber
    }

    private fail(message: string): void {
        this.tickFailed = true
        this.lastError = { at: this.now(), message }
        this.log.error(message)
    }

    /**
     * @param staleAfterMs a loop that has not finished a tick for this long is
     *        unhealthy, unless it is waiting on a vote transaction.
     */
    health(staleAfterMs = Number.POSITIVE_INFINITY): HealthSnapshot {
        const q = this.lastQuorum
        const s = this.lastState
        const reading = q?.ok ? q.reading : null
        const lag =
            reading && s && this.epochMatch ? Math.max(0, reading.blockNumber - s.latest.blockNumber) : null
        const fresh =
            this.submitting ||
            (this.lastTickAt !== null && this.now().getTime() - this.lastTickAt.getTime() <= staleAfterMs)
        return {
            healthy: fresh && this.lastTickAt !== null && !this.tickFailed && this.epochMatch === true,
            network: this.networkName,
            contract: this.registry.contractAddress,
            oracle: this.registry.oracleAddress,
            submitting: this.submitting,
            lastTickAt: this.lastTickAt?.toISOString() ?? null,
            lastSuccessfulVoteAt: this.lastVoteAt?.toISOString() ?? null,
            lastVoteTx: this.lastVoteTx,
            lastSeenNodeRoot: this.lastReading
                ? { ...this.lastReading.reading, agreeingNodes: this.lastReading.agreeing, seenAt: this.lastReading.at.toISOString() }
                : null,
            nodes: (q?.nodes ?? []).map(nodeSummary),
            onChain: s
                ? {
                      epochId: s.epochId.toString(),
                      genesisHash: s.genesisHash,
                      latestRoot: { ...s.latest, epochId: s.latest.epochId.toString() },
                      paused: s.paused,
                      isOracle: s.isOracle,
                  }
                : null,
            epochMatch: this.epochMatch,
            lagBlocks: lag,
            lastError: this.lastError ? { at: this.lastError.at.toISOString(), message: this.lastError.message } : null,
        }
    }
}

function sameCursor(a: Cursor | null, b: Cursor): boolean {
    return (
        a !== null &&
        a.epochId === b.epochId &&
        a.rootHash === b.rootHash &&
        a.blockNumber === b.blockNumber &&
        a.leafCount === b.leafCount
    )
}

function nodeSummary(n: NodeResult): HealthSnapshot["nodes"][number] {
    return n.ok
        ? { url: n.url, ok: true, blockNumber: n.reading.blockNumber, rootHash: n.reading.rootHash, genesisHash: n.reading.genesisHash }
        : { url: n.url, ok: false, error: n.error }
}
