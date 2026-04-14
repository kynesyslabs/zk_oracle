import { ethers } from "ethers"
import { config } from "./config"
import { ABI } from "./abi"
import type { KeystoreWallet } from "./keystore"

/**
 * Thin wrapper around ZKOracleRegistry on Base Sepolia.
 * The wallet is injected from the decrypted keystore — this class never reads
 * the private key directly.
 */
export class OracleContract {
    private contract: ethers.Contract

    constructor(wallet: KeystoreWallet) {
        const provider = new ethers.JsonRpcProvider(config.evm.rpcUrl)
        this.contract = new ethers.Contract(
            config.evm.contractAddress,
            ABI,
            wallet.connect(provider),
        )
    }

    /**
     * Cast this oracle's vote for a new ZK merkle root.
     * When `threshold` unique oracles submit the same (root, block, leafCount),
     * the contract finalises it automatically.
     * Returns the transaction hash.
     */
    async submitVote(rootHash: string, blockNumber: number, leafCount: number): Promise<string> {
        const normalised = normaliseBytes32(rootHash)
        const tx = await this.contract.submitVote(normalised, BigInt(blockNumber), BigInt(leafCount))
        const receipt = await tx.wait()
        return receipt.hash as string
    }
}

function normaliseBytes32(value: string): string {
    const hex = value.startsWith("0x") ? value.slice(2) : value
    return `0x${hex.padStart(64, "0").slice(0, 64)}`
}
