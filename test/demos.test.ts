import { describe, it, expect } from "bun:test"
import { DemosReader, evaluateQuorum, type NodeReading, type NodeResult } from "../src/demos"

const GENESIS = "ab".repeat(32)
const ROOT_DEC = "111122223333444455556666777788889999000011112222"
const READING: NodeReading = {
    rootHash: "0x" + BigInt(ROOT_DEC).toString(16).padStart(64, "0"),
    blockNumber: 100,
    leafCount: 5,
    genesisHash: "0x" + GENESIS,
    chainId: 8587492,
}

const ok = (url: string, r: Partial<NodeReading> = {}): NodeResult => ({ url, ok: true, reading: { ...READING, ...r } })
const down = (url: string): NodeResult => ({ url, ok: false, error: "timeout" })

describe("evaluateQuorum", () => {
    it("accepts a single configured node", () => {
        const q = evaluateQuorum([ok("a")], 1, true)
        expect(q.ok).toBe(true)
    })

    it("requires two answers by default when several nodes are configured", () => {
        expect(evaluateQuorum([ok("a"), down("b")], 2, true).ok).toBe(false)
        expect(evaluateQuorum([ok("a"), ok("b"), down("c")], 2, true).ok).toBe(true)
    })

    it("refuses when reachable nodes disagree on any field, genesis included", () => {
        expect(evaluateQuorum([ok("a"), ok("b", { blockNumber: 101 })], 2, true).ok).toBe(false)
        expect(evaluateQuorum([ok("a"), ok("b", { genesisHash: "0x" + "cd".repeat(32) })], 2, true).ok).toBe(false)
    })

    it("with an explicit quorum, votes on k matching answers despite a dissenter", () => {
        const q = evaluateQuorum([ok("a"), ok("b"), ok("c", { leafCount: 9 })], 2, false)
        expect(q.ok).toBe(true)
        if (q.ok) expect(q.agreeing).toBe(2)
    })

    it("refuses an even split", () => {
        expect(evaluateQuorum([ok("a"), ok("b", { leafCount: 9 })], 1, false).ok).toBe(false)
    })
})

function nodeFetch(identity: unknown, root: unknown = { rootHash: ROOT_DEC, blockNumber: 100, leafCount: 5 }) {
    return async (input: string, init?: RequestInit): Promise<Response> => {
        if (input.endsWith("/zk/merkle-root")) return Response.json(root)
        expect(init?.method).toBe("POST")
        expect(JSON.parse(String(init?.body))).toEqual({ method: "nodeCall", params: [{ message: "getChainIdentity", data: {} }] })
        return Response.json({ result: 200, response: identity, require_reply: false, extra: null })
    }
}

describe("DemosReader", () => {
    it("reads the root and the chain identity of every node", async () => {
        const reader = new DemosReader({
            urls: ["http://a", "http://b"],
            quorum: 2,
            requireAllReachable: true,
            fetchTimeoutMs: 1000,
            fetch: nodeFetch({ chainId: 8587492, genesisHash: GENESIS, genesisDataHash: "x" }),
        })
        const q = await reader.read()
        expect(q.ok).toBe(true)
        if (q.ok) expect(q.reading).toEqual(READING)
    })

    it("times out a node that never answers", async () => {
        const hang = (_: string, init?: RequestInit) =>
            new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))
        const reader = new DemosReader({ urls: ["http://slow"], quorum: 1, requireAllReachable: true, fetchTimeoutMs: 50, fetch: hang })
        const started = Date.now()
        const q = await reader.read()
        expect(Date.now() - started).toBeLessThan(2000)
        expect(q.ok).toBe(false)
        expect(q.nodes[0].ok).toBe(false)
    })

    it("treats a refused identity call as a failed node", async () => {
        const fetch = async (input: string) =>
            input.endsWith("/zk/merkle-root")
                ? Response.json({ rootHash: ROOT_DEC, blockNumber: 100, leafCount: 5 })
                : Response.json({ result: 503, response: { error: "state_not_ready" } })
        const reader = new DemosReader({ urls: ["http://a"], quorum: 1, requireAllReachable: true, fetchTimeoutMs: 1000, fetch })
        const q = await reader.read()
        expect(q.ok).toBe(false)
        expect(q.nodes[0]).toMatchObject({ ok: false })
    })

    it("rejects a malformed genesis hash", async () => {
        const reader = new DemosReader({
            urls: ["http://a"],
            quorum: 1,
            requireAllReachable: true,
            fetchTimeoutMs: 1000,
            fetch: nodeFetch({ chainId: 1, genesisHash: "abc" }),
        })
        expect((await reader.read()).ok).toBe(false)
    })
})
