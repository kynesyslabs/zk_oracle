import { describe, it, expect } from "bun:test"
import { TxRevertedError, TxSender, TxTimeoutError, type ReceiptLike, type TxRequest } from "../src/txsender"

const GWEI = 1_000_000_000n

function setup(opts: { mineOn?: (sent: TxRequest[], hash: string) => boolean; sendError?: (n: number) => unknown; feeCap?: bigint; status?: number } = {}) {
    const sent: TxRequest[] = []
    const hashes: string[] = []
    const chain = {
        getFeeData: async () => ({ maxFeePerGas: 10n * GWEI, maxPriorityFeePerGas: 1n * GWEI }),
        getTransactionCount: async () => 7,
        getTransactionReceipt: async (hash: string): Promise<ReceiptLike | null> =>
            opts.mineOn?.(sent, hash) ? { hash, status: opts.status ?? 1, blockNumber: 1 } : null,
    }
    const signer = {
        address: "0x" + "22".repeat(20),
        sendTransaction: async (tx: TxRequest) => {
            const err = opts.sendError?.(sent.length)
            if (err) {
                sent.push(tx)
                throw err
            }
            sent.push(tx)
            const hash = `0xhash${sent.length}`
            hashes.push(hash)
            return { hash }
        },
    }
    const sender = new TxSender(chain, signer, {
        chainId: 1n,
        maxFeePerGasWei: opts.feeCap ?? 100n * GWEI,
        maxPriorityFeePerGasWei: 5n * GWEI,
        waitTimeoutMs: 30,
        feeBumpPercent: 25,
        maxFeeBumps: 3,
        receiptPollMs: 5,
        log: () => {},
    })
    return { sender, sent, hashes }
}

describe("TxSender", () => {
    it("returns the receipt when the first send is mined", async () => {
        const { sender, sent } = setup({ mineOn: () => true })
        const r = await sender.send("0xto", "0x", 100n)
        expect(r.hash).toBe("0xhash1")
        expect(sent).toHaveLength(1)
        expect(sent[0]).toMatchObject({ nonce: 7, maxFeePerGas: 10n * GWEI, maxPriorityFeePerGas: GWEI, type: 2 })
    })

    it("replaces a stuck transaction at the same nonce with higher fees", async () => {
        const { sender, sent } = setup({ mineOn: (s, hash) => s.length >= 2 && hash === "0xhash2" })
        const r = await sender.send("0xto", "0x", 100n)
        expect(r.hash).toBe("0xhash2")
        expect(sent.map(t => t.nonce)).toEqual([7, 7])
        expect(sent[1].maxFeePerGas).toBe((10n * GWEI * 125n) / 100n + 1n)
        expect(sent[1].maxPriorityFeePerGas).toBe((GWEI * 125n) / 100n + 1n)
    })

    it("accepts the original being mined after a replacement was sent", async () => {
        const { sender } = setup({ mineOn: (s, hash) => s.length >= 2 && hash === "0xhash1" })
        expect((await sender.send("0xto", "0x", 100n)).hash).toBe("0xhash1")
    })

    it("never exceeds the fee cap and gives up when it cannot bump", async () => {
        const { sender, sent } = setup({ feeCap: 10n * GWEI })
        await expect(sender.send("0xto", "0x", 100n)).rejects.toBeInstanceOf(TxTimeoutError)
        for (const t of sent) expect(t.maxFeePerGas <= 10n * GWEI).toBe(true)
    })

    it("gives up after the configured number of bumps", async () => {
        const { sender, sent } = setup({})
        await expect(sender.send("0xto", "0x", 100n)).rejects.toBeInstanceOf(TxTimeoutError)
        expect(sent).toHaveLength(4)
    })

    it("bumps again when a replacement is underpriced", async () => {
        const { sender, sent } = setup({
            sendError: n => (n === 0 ? { code: "REPLACEMENT_UNDERPRICED", message: "replacement transaction underpriced" } : null),
            mineOn: () => true,
        })
        await sender.send("0xto", "0x", 100n)
        expect(sent).toHaveLength(2)
        expect(sent[1].maxFeePerGas > sent[0].maxFeePerGas).toBe(true)
    })

    it("reports a mined revert", async () => {
        const { sender } = setup({ mineOn: () => true, status: 0 })
        await expect(sender.send("0xto", "0x", 100n)).rejects.toBeInstanceOf(TxRevertedError)
    })

    it("fails when another transaction took the nonce", async () => {
        const { sender } = setup({ sendError: () => ({ code: "NONCE_EXPIRED", message: "nonce too low" }) })
        await expect(sender.send("0xto", "0x", 100n)).rejects.toThrow(/nonce 7/)
    })
})
