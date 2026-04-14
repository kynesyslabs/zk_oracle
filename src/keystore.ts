import { ethers } from "ethers"
import fs from "fs"

export type KeystoreWallet = ethers.Wallet | ethers.HDNodeWallet

/**
 * Decrypts an ethers.js JSON keystore file and returns the wallet.
 * Uses scrypt KDF — call once at startup, not per-transaction.
 * Error messages never echo the password or keystore contents.
 */
export async function loadWalletFromKeystore(
    keystorePath: string,
    password: string,
): Promise<KeystoreWallet> {
    let json: string
    try {
        json = fs.readFileSync(keystorePath, "utf8")
    } catch {
        throw new Error(`Cannot read keystore file: ${keystorePath}`)
    }
    try {
        return await ethers.Wallet.fromEncryptedJson(json, password)
    } catch {
        throw new Error("Failed to decrypt keystore — check KEYSTORE_PASSWORD")
    }
}
