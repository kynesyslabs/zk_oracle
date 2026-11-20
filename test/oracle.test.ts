import { describe, it, expect } from "bun:test"
import { OracleSubmitError, type Registry, type RegistryState } from "../src/contract"
import type { NodeReading, QuorumResult } from "../src/demos"
import { startHealthServer } from "../src/health"
import { Oracle } from "../src/oracle"

const G1 = "0x" + "a1".repeat(32)
const G2 = "0x" + "b2".repeat(32)
const root = (n: number) => "0x" + n.toString(16).padStart(64, "0")

function reading(r: Partial<NodeReading> = {}): NodeReading {
    return { rootHash: root(5), blockNumber: 100, leafCount: 5, genesisHash: G1, chainId: 8587492, ...r }
}

class FakeNodes {
    next: QuorumResult = { ok: true, reading: reading(), agreeing: 2, nodes: [] }
    set(r: Partial<NodeReading>) {
        this.next = { ok: true, reading: reading(r), agreeing: 2, nodes: [] }
    }
    async read() {
        return this.next
    }
}

class FakeRegistry implements Registry {
    readonly oracleAddress = "0x" + "0a".repeat(20)
    readonly contractAddress = "0x" + "0c".repeat(20)
    state: RegistryState = {
        epochId: 1n,
        genesisHash: G1,
        latest: { rootHash: root(0), blockNumber: 0, leafCount: 0, updatedAt: 0, epochId: 1n },
        paused: false,
        isOracle: true,
    }
    votes: Array<[string, string, number, number]> = []
    voted = new Set<string>()
    submitImpl: ((g: string, r: string, b: number, l: number) => Promise<string>) | null = null

    async readState() {
        return structuredClone(this.state)
    }
    async hasVoted(r: string, b: number, l: number) {
        return this.voted.has(`${this.state.epochId}|${r}|${b}|${l}`)
    }
    async submitVote(g: string, r: string, b: number, l: number) {
        this.votes.push([g, r, b, l])
        if (this.submitImpl) return this.submitImpl(g, r, b, l)
        this.voted.add(`${this.state.epochId}|${r}|${b}|${l}`)
        return `0xtx${this.votes.length}`
    }
}

const silent = { info: () => {}, warn: () => {}, error: () => {} }

function make() {
    const nodes = new FakeNodes()
    const reg = new FakeRegistry()
    const errors: string[] = []
    const oracle = new Oracle(nodes, reg, "test-net", { ...silent, error: m => errors.push(m) })
    return { nodes, reg, oracle, errors }
}

describe("Oracle", () => {
    it("votes on a new root of the current epoch", async () => {
        const { reg, oracle } = make()
        await oracle.tick()
        expect(reg.votes).toEqual([[G1, root(5), 100, 5]])
        const h = oracle.health()
        expect(h.healthy).toBe(true)
        expect(h.lastVoteTx).toBe("0xtx1")
        expect(h.epochMatch).toBe(true)
        expect(h.lagBlocks).toBe(100)
    })

    it("stays healthy without voting while the new chain's tree is empty", async () => {
        const { nodes, reg, oracle } = make()
        nodes.set({ blockNumber: 0, leafCount: 0 })
        await oracle.tick()
        expect(reg.votes).toHaveLength(0)
        expect(oracle.health().healthy).toBe(true)
    })

    it("does not vote twice for the same root", async () => {
        const { reg, oracle } = make()
        await oracle.tick()
        await oracle.tick()
        expect(reg.votes).toHaveLength(1)
    })

    it("does not vote when the nodes are on another chain than the registry epoch", async () => {
        const { nodes, reg, oracle, errors } = make()
        nodes.set({ genesisHash: G2 })
        await oracle.tick()
        expect(reg.votes).toHaveLength(0)
        expect(errors.join()).toMatch(/epoch mismatch/)
        const h = oracle.health()
        expect(h.healthy).toBe(false)
        expect(h.epochMatch).toBe(false)
        expect(h.lastError?.message).toMatch(/startEpoch/)
    })

    it("does not vote without node quorum", async () => {
        const { nodes, reg, oracle } = make()
        nodes.next = { ok: false, reason: "nodes disagree", nodes: [] }
        await oracle.tick()
        expect(reg.votes).toHaveLength(0)
        expect(oracle.health().healthy).toBe(false)
    })

    it("resets the cursor when the epoch changes and votes from block 1 again", async () => {
        const { nodes, reg, oracle } = make()
        await oracle.tick()
        reg.state.latest = { rootHash: root(5), blockNumber: 100, leafCount: 5, updatedAt: 1, epochId: 1n }

        // The chain is reset: the owner starts epoch 2 and the nodes restart from block 1.
        reg.state.epochId = 2n
        reg.state.genesisHash = G2
        reg.state.latest = { rootHash: root(0), blockNumber: 0, leafCount: 0, updatedAt: 0, epochId: 2n }
        nodes.set({ genesisHash: G2, blockNumber: 1, leafCount: 1, rootHash: root(7) })
        await oracle.tick()
        expect(reg.votes.at(-1)).toEqual([G2, root(7), 1, 1])
        expect(oracle.health().healthy).toBe(true)
    })

    it("treats StaleRoot as benign when the other oracles finalised it first", async () => {
        const { reg, oracle } = make()
        reg.submitImpl = async () => {
            reg.state.latest = { rootHash: root(5), blockNumber: 100, leafCount: 5, updatedAt: 1, epochId: 1n }
            throw new OracleSubmitError("StaleRoot", "StaleRoot(100, 100)")
        }
        await oracle.tick()
        expect(oracle.health().healthy).toBe(true)
    })

    it("treats StaleRoot as an error when the registry does not hold the block", async () => {
        const { nodes, reg, oracle } = make()
        nodes.set({ genesisHash: G2 })
        await oracle.tick() // mismatch observed
        nodes.set({ genesisHash: G1 })
        reg.submitImpl = async () => {
            throw new OracleSubmitError("StaleRoot", "StaleRoot(100, 100)")
        }
        await oracle.tick()
        const h = oracle.health()
        expect(h.healthy).toBe(false)
        expect(h.lastError?.message).toMatch(/StaleRoot/)
    })

    it("treats StaleRoot as an error when the registry moved to another epoch", async () => {
        const { reg, oracle } = make()
        reg.submitImpl = async () => {
            reg.state.epochId = 2n
            reg.state.genesisHash = G2
            throw new OracleSubmitError("StaleRoot", "StaleRoot(100, 0)")
        }
        await oracle.tick()
        expect(oracle.health().healthy).toBe(false)
    })

    it("never leaves a vote in flight after a failure and retries next tick", async () => {
        const { reg, oracle } = make()
        reg.submitImpl = async () => {
            throw new Error("rpc exploded")
        }
        await oracle.tick()
        expect(oracle.health().submitting).toBe(false)
        expect(oracle.health().healthy).toBe(false)
        reg.submitImpl = null
        await oracle.tick()
        expect(reg.votes).toHaveLength(2)
        expect(oracle.health().healthy).toBe(true)
    })

    it("refuses when the nodes report an older block than the registry", async () => {
        const { reg, oracle } = make()
        reg.state.latest = { rootHash: root(9), blockNumber: 200, leafCount: 9, updatedAt: 1, epochId: 1n }
        await oracle.tick()
        expect(reg.votes).toHaveLength(0)
        expect(oracle.health().healthy).toBe(false)
    })

    it("flags a registry root that differs from the nodes at the same block", async () => {
        const { reg, oracle } = make()
        reg.state.latest = { rootHash: root(6), blockNumber: 100, leafCount: 5, updatedAt: 1, epochId: 1n }
        await oracle.tick()
        expect(reg.votes).toHaveLength(0)
        expect(oracle.health().lastError?.message).toMatch(/registry root at block 100/)
    })

    it("does not vote while paused or when not an oracle", async () => {
        const { reg, oracle } = make()
        reg.state.paused = true
        await oracle.tick()
        reg.state.paused = false
        reg.state.isOracle = false
        await oracle.tick()
        expect(reg.votes).toHaveLength(0)
    })

    it("marks a loop that stopped ticking as unhealthy", async () => {
        const nodes = new FakeNodes()
        const reg = new FakeRegistry()
        let now = 0
        const oracle = new Oracle(nodes, reg, "test-net", silent, () => new Date(now))
        await oracle.tick()
        expect(oracle.health(1000).healthy).toBe(true)
        now = 5000
        expect(oracle.health(1000).healthy).toBe(false)
    })
})

describe("Oracle health truthfulness", () => {
    const KEY = "apiKey0123456789abcdef"

    it("never logs or serves an RPC URL with its key", async () => {
        const { reg, oracle, errors } = make()
        reg.submitImpl = async () => {
            throw new Error(`server response 429 (requestUrl="https://rpc.example/v3/${KEY}")`)
        }
        await oracle.tick()
        const h = oracle.health()
        expect(h.lastError?.message).toContain("https://rpc.example/<redacted>")
        expect(JSON.stringify(h)).not.toContain(KEY)
        expect(errors.join()).not.toContain(KEY)
    })

    it("redacts node URLs and node errors in /health", async () => {
        const { nodes, oracle } = make()
        nodes.next = {
            ok: false,
            reason: "only 0 of 1 node(s) answered, quorum is 1",
            nodes: [{ url: `https://node.example/${KEY}`, ok: false, error: `HTTP 502 from https://node.example/${KEY}/zk/merkle-root` }],
        }
        await oracle.tick()
        expect(JSON.stringify(oracle.health())).not.toContain(KEY)
    })

    it("does not report a tick in progress as healthy after a failed one", async () => {
        const { nodes, reg, oracle } = make()
        nodes.next = { ok: false, reason: "down", nodes: [] }
        await oracle.tick()
        expect(oracle.health().healthy).toBe(false)

        nodes.set({})
        const seen: boolean[] = []
        reg.submitImpl = async () => {
            seen.push(oracle.health().healthy) // observed mid-tick
            return "0xtx"
        }
        await oracle.tick()
        expect(seen).toEqual([false])
        expect(oracle.health().healthy).toBe(true)
    })

    it("turns unhealthy when the root never finalises", async () => {
        const nodes = new FakeNodes()
        const reg = new FakeRegistry()
        const oracle = new Oracle(nodes, reg, "test-net", silent, undefined, { maxLagTicks: 2 })
        await oracle.tick() // votes; registry still behind (threshold not met)
        expect(oracle.health().healthy).toBe(true)
        await oracle.tick() // already voted, waiting
        expect(oracle.health().healthy).toBe(true)
        await oracle.tick()
        expect(oracle.health().healthy).toBe(false)
        expect(oracle.health().lagTicks).toBe(3)

        reg.state.latest = { rootHash: root(5), blockNumber: 100, leafCount: 5, updatedAt: 1, epochId: 1n }
        await oracle.tick()
        expect(oracle.health().healthy).toBe(true)
        expect(oracle.health().lagTicks).toBe(0)
    })

    it("forgets an epoch mismatch once the epochs match again", async () => {
        const { nodes, reg, oracle } = make()
        nodes.set({ genesisHash: G2 })
        await oracle.tick() // mismatch
        nodes.set({ genesisHash: G1 })
        reg.submitImpl = async () => {
            // The other oracles finalised it first.
            reg.state.latest = { rootHash: root(5), blockNumber: 100, leafCount: 5, updatedAt: 1, epochId: 1n }
            throw new OracleSubmitError("StaleRoot", "StaleRoot(100, 100)")
        }
        await oracle.tick()
        expect(oracle.health().healthy).toBe(true)
    })
})

describe("health server", () => {
    it("serves the snapshot with 200 when healthy and 503 when not", async () => {
        const { nodes, oracle } = make()
        const server = startHealthServer(0, "127.0.0.1", () => oracle.health())
        try {
            await oracle.tick()
            let res = await fetch(`http://127.0.0.1:${server.port}/health`)
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.lastSeenNodeRoot.rootHash).toBe(root(5))
            expect(body.onChain.epochId).toBe("1")

            nodes.set({ genesisHash: G2 })
            await oracle.tick()
            res = await fetch(`http://127.0.0.1:${server.port}/health`)
            expect(res.status).toBe(503)
            expect((await res.json()).epochMatch).toBe(false)
        } finally {
            server.stop()
        }
    })
})
