function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}

export const config = {
    demosRpcUrl: process.env.DEMOS_RPC_URL ?? "http://localhost:53550",
    evm: {
        rpcUrl: process.env.EVM_RPC_URL ?? process.env.BASE_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
        get contractAddress() {
            return requireEnv("CONTRACT_ADDRESS")
        },
    },
    /** Path to the encrypted ethers.js JSON keystore file. */
    get keystorePath() {
        return requireEnv("KEYSTORE_PATH")
    },
    /**
     * Password used to decrypt the keystore.
     * Getter so the value is read from process.env on demand — never cached
     * in the config object where it could be serialised or logged.
     */
    get keystorePassword() {
        return requireEnv("KEYSTORE_PASSWORD")
    },
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? "10000"),
}
