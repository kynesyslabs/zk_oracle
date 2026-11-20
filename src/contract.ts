import { ethers } from "ethers"
import { ABI } from "./abi"
import type { OracleConfig } from "./config"
import type { KeystoreWallet } from "./keystore"
import { errorMessage, redactUrls } from "./redact"
import { TxRevertedError, TxSender, type ReceiptLike, type TxChain, type TxSigner } from "./txsender"

/**
 * A failed `submitVote`, decoded to the contract's named custom error when
 * possible. `reason` is the error name ("StaleRoot", "WrongEpoch", ...) or
 * "unknown"; the caller decides which reasons are benign.
 */
export class OracleSubmitError extends Error {
    constructor(
        readonly reason: string,
        message: string,
    ) {
        super(message)
        this.name = "OracleSubmitError"
    }
}

export interface OnChainRoot {
    rootHash: string
    blockNumber: number
    leafCount: number
    updatedAt: number
    epochId: bigint
}

export interface RegistryState {
    epochId: bigint
    genesisHash: string
    latest: OnChainRoot
    paused: boolean
    isOracle: boolean
}

/** What the oracle loop needs from the registry; a fake in tests. */
export interface Registry {
    readonly oracleAddress: string
    readonly contractAddress: string
    readState(): Promise<RegistryState>
    hasVoted(rootHash: string, blockNumber: number, leafCount: number): Promise<boolean>
    submitVote(genesisHash: string, rootHash: string, blockNumber: number, leafCount: number): Promise<string>
}

/** ZKIdentityRegistry through ethers; votes go out through a fee-bumping TxSender. */
export class RegistryClient implements Registry {
    private readonly contract: ethers.Contract
    private readonly sender: TxSender
    readonly oracleAddress: string
    readonly contractAddress: string

    constructor(
        wallet: KeystoreWallet,
        readonly provider: ethers.JsonRpcProvider,
        private readonly cfg: OracleConfig["evm"],
    ) {
        const signer = wallet.connect(provider)
        this.oracleAddress = signer.address
        this.contractAddress = cfg.contractAddress
        this.contract = new ethers.Contract(cfg.contractAddress, ABI, signer)
        const chain: TxChain = {
            getFeeData: () => provider.getFeeData(),
            getTransactionCount: (a, tag) => provider.getTransactionCount(a, tag),
            getTransactionReceipt: async hash => {
                const r = await provider.getTransactionReceipt(hash)
                return r ? { hash: r.hash, status: r.status, blockNumber: r.blockNumber } : null
            },
        }
        const txSigner: TxSigner = {
            address: signer.address,
            sendTransaction: async tx => signer.sendTransaction(tx),
        }
        this.sender = new TxSender(chain, txSigner, {
            chainId: cfg.chainId,
            maxFeePerGasWei: cfg.maxFeePerGasWei,
            maxPriorityFeePerGasWei: cfg.maxPriorityFeePerGasWei,
            waitTimeoutMs: cfg.txWaitTimeoutMs,
            feeBumpPercent: cfg.feeBumpPercent,
            maxFeeBumps: cfg.maxFeeBumps,
            log: m => console.log(`[oracle] ${redactUrls(m)}`),
        })
    }

    /** Refuse to run against a chain other than the configured one. */
    async assertNetwork(): Promise<void> {
        const { chainId } = await this.provider.getNetwork()
        if (chainId !== this.cfg.chainId) {
            throw new Error(`EVM_RPC_URL serves chain ${chainId}, EVM_CHAIN_ID is ${this.cfg.chainId}`)
        }
    }

    async readState(): Promise<RegistryState> {
        const [epoch, latest, paused, isOracle] = await Promise.all([
            this.contract.currentEpoch(),
            this.contract.getLatestRoot(),
            this.contract.paused(),
            this.contract.isOracle(this.oracleAddress),
        ])
        return {
            epochId: epoch[0] as bigint,
            genesisHash: (epoch[1] as string).toLowerCase(),
            latest: {
                rootHash: (latest[0] as string).toLowerCase(),
                blockNumber: Number(latest[1]),
                leafCount: Number(latest[2]),
                updatedAt: Number(latest[3]),
                epochId: latest[4] as bigint,
            },
            paused: paused as boolean,
            isOracle: isOracle as boolean,
        }
    }

    async hasVoted(rootHash: string, blockNumber: number, leafCount: number): Promise<boolean> {
        return (await this.contract.hasVoted(this.oracleAddress, bytes32(rootHash), blockNumber, leafCount)) as boolean
    }

    /**
     * Cast this oracle's vote. Simulated first, so a vote the contract would
     * refuse fails with its decoded reason and costs no gas.
     * @returns the hash of the mined transaction.
     */
    async submitVote(genesisHash: string, rootHash: string, blockNumber: number, leafCount: number): Promise<string> {
        const args = [bytes32(genesisHash), bytes32(rootHash), BigInt(blockNumber), BigInt(leafCount)] as const
        let receipt: ReceiptLike
        try {
            const estimate: bigint = await this.contract.submitVote.estimateGas(...args)
            const data = this.contract.interface.encodeFunctionData("submitVote", args)
            receipt = await this.sender.send(this.cfg.contractAddress, data, (estimate * 12n) / 10n)
        } catch (err) {
            if (err instanceof TxRevertedError) {
                // Mined but reverted (another oracle finalised first, the epoch
                // moved): replay it as a call to learn which error it was.
                throw await this.replayRevert(args, err)
            }
            throw this.decodeError(err)
        }
        return receipt.hash
    }

    private async replayRevert(
        args: readonly [string, string, bigint, bigint],
        reverted: TxRevertedError,
    ): Promise<OracleSubmitError> {
        try {
            await this.contract.submitVote.staticCall(...args)
        } catch (err) {
            const decoded = this.decodeError(err)
            return new OracleSubmitError(decoded.reason, `${reverted.message}: ${decoded.message}`)
        }
        return new OracleSubmitError("unknown", reverted.message)
    }

    decodeError(err: unknown): OracleSubmitError {
        const data = extractRevertData(err)
        if (data) {
            const parsed = this.contract.interface.parseError(data)
            if (parsed) {
                return new OracleSubmitError(parsed.name, `submitVote reverted: ${parsed.name}(${parsed.args.join(", ")})`)
            }
        }
        const message = errorMessage(err)
        return new OracleSubmitError("unknown", `submitVote failed: ${message}`)
    }
}

/** Pull the revert payload out of the various shapes ethers wraps it in. */
export function extractRevertData(err: unknown): string | null {
    if (!err || typeof err !== "object") return null
    const e = err as Record<string, unknown>
    if (typeof e.data === "string" && e.data.startsWith("0x")) return e.data
    const info = e.info as { error?: { data?: unknown } } | undefined
    const nested = info?.error?.data
    if (typeof nested === "string" && nested.startsWith("0x")) return nested
    const revert = (e.revert as { data?: unknown } | undefined)?.data
    if (typeof revert === "string" && revert.startsWith("0x")) return revert
    return null
}

// Values reach here already normalised to 32-byte hex; this is a strict guard,
// never a converter that could pad or truncate a wrong value onto the chain.
function bytes32(value: string): string {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(`expected a 0x-prefixed 32-byte hex value, got ${value}`)
    }
    return value.toLowerCase()
}
