import { errorMessage } from "./redact"
import { parseChainIdentity, parseSnapshot, type MerkleRootSnapshot } from "./types"

/** What one node says: its tree state plus the chain it is on. */
export interface NodeReading extends MerkleRootSnapshot {
    genesisHash: string
    chainId: number | null
}

export type NodeResult = { url: string; ok: true; reading: NodeReading } | { url: string; ok: false; error: string }

export type QuorumResult =
    | { ok: true; reading: NodeReading; agreeing: number; nodes: NodeResult[] }
    | { ok: false; reason: string; nodes: NodeResult[] }

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

export interface DemosReaderOptions {
    urls: string[]
    quorum: number
    requireAllReachable: boolean
    fetchTimeoutMs: number
    maxBlockNumber?: number
    fetch?: FetchFn
}

function readingKey(r: NodeReading): string {
    return [r.genesisHash, r.rootHash, r.blockNumber, r.leafCount].join("|")
}

/**
 * Decide whether the nodes' answers are trustworthy enough to vote on.
 * Pure, so the rule is testable without a network.
 */
export function evaluateQuorum(
    nodes: NodeResult[],
    quorum: number,
    requireAllReachable: boolean,
): QuorumResult {
    const answered = nodes.filter((n): n is Extract<NodeResult, { ok: true }> => n.ok)
    if (answered.length < quorum) {
        return { ok: false, reason: `only ${answered.length} of ${nodes.length} node(s) answered, quorum is ${quorum}`, nodes }
    }
    const groups = new Map<string, { reading: NodeReading; count: number }>()
    for (const n of answered) {
        const key = readingKey(n.reading)
        const g = groups.get(key)
        if (g) g.count += 1
        else groups.set(key, { reading: n.reading, count: 1 })
    }
    const ranked = [...groups.values()].sort((a, b) => b.count - a.count)
    const top = ranked[0]
    if (requireAllReachable && ranked.length > 1) {
        return { ok: false, reason: `nodes disagree (${ranked.length} distinct answers from ${answered.length} nodes)`, nodes }
    }
    if (top.count < quorum) {
        return { ok: false, reason: `best answer has ${top.count} of the ${quorum} matching node(s) required`, nodes }
    }
    if (ranked.length > 1 && ranked[1].count === top.count) {
        return { ok: false, reason: "nodes split evenly between answers", nodes }
    }
    return { ok: true, reading: top.reading, agreeing: top.count, nodes }
}

/** Reads every configured Demos node, each call bounded by a timeout. */
export class DemosReader {
    private readonly fetchFn: FetchFn

    constructor(private readonly opts: DemosReaderOptions) {
        this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init))
    }

    async read(): Promise<QuorumResult> {
        const nodes = await Promise.all(this.opts.urls.map(url => this.readNode(url)))
        return evaluateQuorum(nodes, this.opts.quorum, this.opts.requireAllReachable)
    }

    private async readNode(url: string): Promise<NodeResult> {
        try {
            const [rootBody, identityBody] = await Promise.all([
                this.getJson(`${url}/zk/merkle-root`),
                this.getJson(url, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ method: "nodeCall", params: [{ message: "getChainIdentity", data: {} }] }),
                }),
            ])
            const snapshot = parseSnapshot(rootBody, { maxBlockNumber: this.opts.maxBlockNumber, allowEmptyTree: true })
            const envelope = identityBody as { result?: unknown; response?: unknown }
            if (envelope?.result !== 200) {
                throw new Error(`getChainIdentity answered ${JSON.stringify(envelope?.result)}: ${JSON.stringify(envelope?.response)}`)
            }
            const identity = parseChainIdentity(envelope.response)
            return { url, ok: true, reading: { ...snapshot, ...identity } }
        } catch (err) {
            return { url, ok: false, error: errorMessage(err) }
        }
    }

    private async getJson(url: string, init: RequestInit = {}): Promise<unknown> {
        const response = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(this.opts.fetchTimeoutMs) })
        if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
        return await response.json()
    }
}
