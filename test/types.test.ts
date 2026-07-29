import { describe, it, expect } from "bun:test"
import { parseSnapshot, InvalidSnapshotError } from "../src/types"

const GOOD = { rootHash: "0x" + "ab".repeat(32), blockNumber: 100, leafCount: 5 }

describe("parseSnapshot — reject bad node reads before they reach the chain", () => {
    it("accepts a well-formed snapshot unchanged", () => {
        expect(parseSnapshot(GOOD)).toEqual(GOOD)
    })

    it("accepts leafCount 0 (an empty tree is valid)", () => {
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

    it("rejects a zero root", () => {
        expect(() => parseSnapshot({ ...GOOD, rootHash: "0x0" })).toThrow(InvalidSnapshotError)
    })

    it("rejects a non-hex root", () => {
        expect(() => parseSnapshot({ ...GOOD, rootHash: "not-hex" })).toThrow(InvalidSnapshotError)
    })

    it("rejects a negative leafCount", () => {
        expect(() => parseSnapshot({ ...GOOD, leafCount: -1 })).toThrow(InvalidSnapshotError)
    })

    it("rejects junk — non-objects and malformed shapes", () => {
        for (const junk of [undefined, null, 42, "nope", [], { rootHash: GOOD.rootHash }]) {
            expect(() => parseSnapshot(junk)).toThrow(InvalidSnapshotError)
        }
    })

    it("enforces the optional maxBlockNumber ceiling", () => {
        expect(() => parseSnapshot(GOOD, { maxBlockNumber: 50 })).toThrow(InvalidSnapshotError)
        expect(parseSnapshot(GOOD, { maxBlockNumber: 200 }).blockNumber).toBe(100)
    })
})
