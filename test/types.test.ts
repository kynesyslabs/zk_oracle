import { describe, it, expect } from "bun:test"
import { parseSnapshot, InvalidSnapshotError } from "../src/types"

// The node returns rootHash as a DECIMAL field element (BigInt.toString()), not
// 0x-hex. These fixtures mirror the real `/zk/merkle-root` response shape.
const ROOT_DEC = "111122223333444455556666777788889999000011112222"
const ROOT_BYTES32 = "0x" + BigInt(ROOT_DEC).toString(16).padStart(64, "0")
const GOOD = { rootHash: ROOT_DEC, blockNumber: 100, leafCount: 5 }

// The live dev node's empty-tree root — a valid field element, but paired with
// blockNumber 0 because nothing has been committed yet.
const EMPTY_TREE_ROOT =
    "15019797232609675441998260052101280400536945603062888308240081994073687793470"

describe("parseSnapshot — reject bad node reads before they reach the chain", () => {
    it("accepts the node's decimal field-element root, normalised to bytes32", () => {
        const snap = parseSnapshot(GOOD)
        expect(snap.rootHash).toBe(ROOT_BYTES32)
        expect(snap.rootHash).toMatch(/^0x[0-9a-f]{64}$/)
        expect(snap.blockNumber).toBe(100)
        expect(snap.leafCount).toBe(5)
    })

    it("accepts an explicit 0x-hex root within the field", () => {
        const hex = "0x" + "1a".repeat(31) // 31 bytes -> comfortably below the field modulus
        expect(parseSnapshot({ ...GOOD, rootHash: hex }).rootHash).toBe(
            "0x" + BigInt(hex).toString(16).padStart(64, "0"),
        )
    })

    it("accepts leafCount 0 (an empty tree is valid once it has a block)", () => {
        expect(parseSnapshot({ ...GOOD, leafCount: 0 }).leafCount).toBe(0)
    })

    // The block number is what wedges the registry, so it gets the most scrutiny.
    it.each([
        ["NaN", NaN],
        ["negative", -1],
        ["zero", 0],
        ["non-integer", 1.5],
        ["above safe-integer range", 2 ** 53],
        ["a string", "100"],
    ])("rejects a %s block number", (_label, blockNumber) => {
        expect(() => parseSnapshot({ ...GOOD, blockNumber })).toThrow(InvalidSnapshotError)
    })

    it("rejects the empty-tree snapshot the live node returns (block 0)", () => {
        expect(() =>
            parseSnapshot({ rootHash: EMPTY_TREE_ROOT, blockNumber: 0, leafCount: 0 }),
        ).toThrow(InvalidSnapshotError)
    })

    it("rejects a zero root — decimal and hex", () => {
        expect(() => parseSnapshot({ ...GOOD, rootHash: "0" })).toThrow(InvalidSnapshotError)
        expect(() => parseSnapshot({ ...GOOD, rootHash: "0x0" })).toThrow(InvalidSnapshotError)
    })

    it("rejects a root at/above the field modulus", () => {
        const tooBig =
            "21888242871839275222246405745257275088548364400416034343698204186575808495617"
        expect(() => parseSnapshot({ ...GOOD, rootHash: tooBig })).toThrow(InvalidSnapshotError)
    })

    it("rejects a root that is neither decimal nor 0x-hex", () => {
        expect(() => parseSnapshot({ ...GOOD, rootHash: "not-hex" })).toThrow(InvalidSnapshotError)
        expect(() => parseSnapshot({ ...GOOD, rootHash: "abc123" })).toThrow(InvalidSnapshotError)
    })

    it("rejects a negative leafCount", () => {
        expect(() => parseSnapshot({ ...GOOD, leafCount: -1 })).toThrow(InvalidSnapshotError)
    })

    it("rejects junk — non-objects and malformed shapes", () => {
        for (const junk of [undefined, null, 42, "nope", [], { rootHash: ROOT_DEC }]) {
            expect(() => parseSnapshot(junk)).toThrow(InvalidSnapshotError)
        }
    })

    it("enforces the optional maxBlockNumber ceiling", () => {
        expect(() => parseSnapshot(GOOD, { maxBlockNumber: 50 })).toThrow(InvalidSnapshotError)
        expect(parseSnapshot(GOOD, { maxBlockNumber: 200 }).blockNumber).toBe(100)
    })
})
