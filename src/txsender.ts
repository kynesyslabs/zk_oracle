export interface ReceiptLike {
    hash: string
    status: number | null
    blockNumber: number
}

export interface FeeDataLike {
    maxFeePerGas: bigint | null
    maxPriorityFeePerGas: bigint | null
}

/** The slice of an ethers provider the sender needs; a fake in tests. */
export interface TxChain {
    getFeeData(): Promise<FeeDataLike>
    getTransactionCount(address: string, blockTag: "latest"): Promise<number>
    getTransactionReceipt(hash: string): Promise<ReceiptLike | null>
}

export interface TxRequest {
    to: string
    data: string
    gasLimit: bigint
    chainId: bigint
    nonce: number
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    type: 2
}

/** The slice of an ethers signer the sender needs; a fake in tests. */
export interface TxSigner {
    readonly address: string
    sendTransaction(tx: TxRequest): Promise<{ hash: string }>
}

export interface TxSenderOptions {
    chainId: bigint
    maxFeePerGasWei: bigint
    maxPriorityFeePerGasWei: bigint
    waitTimeoutMs: number
    feeBumpPercent: number
    maxFeeBumps: number
    receiptPollMs?: number
    log?: (message: string) => void
}

export class TxTimeoutError extends Error {
    constructor(
        message: string,
        readonly hashes: string[],
    ) {
        super(message)
        this.name = "TxTimeoutError"
    }
}

export class TxRevertedError extends Error {
    constructor(readonly receipt: ReceiptLike) {
        super(`transaction ${receipt.hash} reverted in block ${receipt.blockNumber}`)
        this.name = "TxRevertedError"
    }
}

const ONE_GWEI = 1_000_000_000n

function min(a: bigint, b: bigint): bigint {
    return a < b ? a : b
}

function errorText(err: unknown): string {
    if (!err || typeof err !== "object") return String(err)
    const e = err as { code?: unknown; message?: unknown; shortMessage?: unknown }
    return `${String(e.code ?? "")} ${String(e.shortMessage ?? "")} ${String(e.message ?? "")}`.toLowerCase()
}

function isReplacementUnderpriced(err: unknown): boolean {
    const t = errorText(err)
    return t.includes("replacement_underpriced") || t.includes("replacement transaction underpriced") || t.includes("underpriced")
}

function isNonceSpent(err: unknown): boolean {
    const t = errorText(err)
    return t.includes("nonce_expired") || t.includes("nonce too low")
}

/**
 * Sends one transaction and sees it mined, replacing it at the same nonce with
 * higher fees when it is not mined in time. Fees never exceed the configured
 * caps; when the cap leaves no room to bump, the send fails and the pending
 * transaction is left for the next attempt to replace.
 */
export class TxSender {
    private readonly log: (message: string) => void

    constructor(
        private readonly chain: TxChain,
        private readonly signer: TxSigner,
        private readonly opts: TxSenderOptions,
    ) {
        this.log = opts.log ?? (m => console.log(m))
    }

    async send(to: string, data: string, gasLimit: bigint): Promise<ReceiptLike> {
        // "latest", not "pending": a transaction of ours stuck from an earlier
        // attempt or run is replaced instead of queued behind.
        const nonce = await this.chain.getTransactionCount(this.signer.address, "latest")
        let { maxFeePerGas, maxPriorityFeePerGas } = await this.initialFees()
        const sent: string[] = []

        for (let attempt = 0; ; attempt++) {
            let accepted = false
            try {
                const tx = await this.signer.sendTransaction({
                    to,
                    data,
                    gasLimit,
                    chainId: this.opts.chainId,
                    nonce,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    type: 2,
                })
                sent.push(tx.hash)
                accepted = true
                this.log(`[tx] sent ${tx.hash} nonce ${nonce} maxFee ${maxFeePerGas} prio ${maxPriorityFeePerGas}`)
            } catch (err) {
                if (isNonceSpent(err)) {
                    const mined = await this.findReceipt(sent)
                    if (mined) return this.checked(mined)
                    throw new Error(`nonce ${nonce} was used by another transaction: ${errorText(err).trim()}`)
                }
                if (!isReplacementUnderpriced(err)) throw err
                this.log(`[tx] replacement at nonce ${nonce} underpriced, bumping fees`)
            }

            if (accepted) {
                const receipt = await this.waitForAny(sent, this.opts.waitTimeoutMs)
                if (receipt) return this.checked(receipt)
            }

            if (attempt >= this.opts.maxFeeBumps) {
                throw new TxTimeoutError(
                    `not mined after ${attempt + 1} attempt(s) at nonce ${nonce}; left pending for the next attempt`,
                    sent,
                )
            }
            const bumped = this.bump(maxFeePerGas, maxPriorityFeePerGas)
            if (bumped.maxFeePerGas === maxFeePerGas && bumped.maxPriorityFeePerGas === maxPriorityFeePerGas) {
                throw new TxTimeoutError(`fee cap reached at nonce ${nonce}; left pending for the next attempt`, sent)
            }
            ;({ maxFeePerGas, maxPriorityFeePerGas } = bumped)
        }
    }

    private async initialFees(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
        const fee = await this.chain.getFeeData()
        const maxPriorityFeePerGas = min(fee.maxPriorityFeePerGas ?? ONE_GWEI, this.opts.maxPriorityFeePerGasWei)
        let maxFeePerGas = min(fee.maxFeePerGas ?? 2n * ONE_GWEI, this.opts.maxFeePerGasWei)
        if (fee.maxFeePerGas !== null && fee.maxFeePerGas > this.opts.maxFeePerGasWei) {
            this.log(`[tx] network maxFee ${fee.maxFeePerGas} is above the cap ${this.opts.maxFeePerGasWei}; using the cap`)
        }
        if (maxFeePerGas < maxPriorityFeePerGas) maxFeePerGas = maxPriorityFeePerGas
        return { maxFeePerGas, maxPriorityFeePerGas }
    }

    bump(maxFee: bigint, prio: bigint): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
        const pct = BigInt(100 + this.opts.feeBumpPercent)
        const maxPriorityFeePerGas = min((prio * pct) / 100n + 1n, this.opts.maxPriorityFeePerGasWei)
        let maxFeePerGas = min((maxFee * pct) / 100n + 1n, this.opts.maxFeePerGasWei)
        if (maxFeePerGas < maxPriorityFeePerGas) maxFeePerGas = maxPriorityFeePerGas
        return { maxFeePerGas, maxPriorityFeePerGas }
    }

    private checked(receipt: ReceiptLike): ReceiptLike {
        if (receipt.status !== 1) throw new TxRevertedError(receipt)
        return receipt
    }

    private async findReceipt(hashes: string[]): Promise<ReceiptLike | null> {
        for (const hash of hashes) {
            const receipt = await this.chain.getTransactionReceipt(hash)
            if (receipt) return receipt
        }
        return null
    }

    /** Any of the replacements may be the one mined, so watch them all. */
    private async waitForAny(hashes: string[], timeoutMs: number): Promise<ReceiptLike | null> {
        const deadline = Date.now() + timeoutMs
        const pollMs = this.opts.receiptPollMs ?? 2_000
        for (;;) {
            const receipt = await this.findReceipt(hashes)
            if (receipt) return receipt
            const left = deadline - Date.now()
            if (left <= 0) return null
            await new Promise(resolve => setTimeout(resolve, Math.min(pollMs, left)))
        }
    }
}
