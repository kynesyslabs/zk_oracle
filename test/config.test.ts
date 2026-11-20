import { describe, it, expect } from "bun:test"
import { ConfigError, loadConfig, parseUrlList, resolveQuorum } from "../src/config"

const BASE = {
    DEMOS_RPC_URLS: "https://a.example, https://b.example/",
    EVM_RPC_URL: "https://rpc.example",
    EVM_CHAIN_ID: "11155111",
    CONTRACT_ADDRESS: "0x" + "11".repeat(20),
    KEYSTORE_PATH: "/run/secrets/oracle.keystore.json",
}

describe("loadConfig", () => {
    it("has no EVM network default", () => {
        for (const missing of ["EVM_RPC_URL", "EVM_CHAIN_ID"]) {
            const env: Record<string, string | undefined> = { ...BASE }
            delete env[missing]
            expect(() => loadConfig(env)).toThrow(ConfigError)
        }
    })

    it("requires at least one Demos node URL", () => {
        const env: Record<string, string | undefined> = { ...BASE }
        delete env.DEMOS_RPC_URLS
        expect(() => loadConfig(env)).toThrow(/DEMOS_RPC_URL/)
        expect(loadConfig({ ...env, DEMOS_RPC_URL: "http://localhost:53550" }).demos.urls).toEqual(["http://localhost:53550"])
    })

    it("parses the network, fee cap and node list", () => {
        const c = loadConfig({ ...BASE, MAX_FEE_PER_GAS_GWEI: "1.5", EVM_NETWORK_NAME: "Ethereum Sepolia" })
        expect(c.evm.chainId).toBe(11155111n)
        expect(c.evm.networkName).toBe("Ethereum Sepolia")
        expect(c.evm.maxFeePerGasWei).toBe(1_500_000_000n)
        expect(c.demos.urls).toEqual(["https://a.example", "https://b.example"])
        expect(c.demos.quorum).toBe(2)
        expect(c.demos.requireAllReachable).toBe(true)
        expect(c.health.port).toBe(8080)
        expect(c.health.host).toBe("127.0.0.1")
        expect(c.maxLagTicks).toBe(30)
    })

    it("labels the network by chain id when no name is given", () => {
        expect(loadConfig(BASE).evm.networkName).toBe("chain 11155111")
    })

    it("refuses a fee bump below the 10% replacement minimum", () => {
        expect(() => loadConfig({ ...BASE, FEE_BUMP_PERCENT: "5" })).toThrow(ConfigError)
    })

    it("refuses a priority fee cap above the max fee cap", () => {
        expect(() => loadConfig({ ...BASE, MAX_FEE_PER_GAS_GWEI: "1", MAX_PRIORITY_FEE_PER_GAS_GWEI: "2" })).toThrow(ConfigError)
    })
})

describe("resolveQuorum", () => {
    it("is 1 with a single node", () => {
        expect(resolveQuorum(1)).toEqual({ quorum: 1, requireAllReachable: true })
    })
    it("defaults to all reachable nodes agreeing, at least 2", () => {
        expect(resolveQuorum(3)).toEqual({ quorum: 2, requireAllReachable: true })
    })
    it("takes an explicit quorum within the node count", () => {
        expect(resolveQuorum(3, 3)).toEqual({ quorum: 3, requireAllReachable: false })
        expect(() => resolveQuorum(2, 3)).toThrow(ConfigError)
    })
})

describe("parseUrlList", () => {
    it("rejects non-http values and duplicates", () => {
        expect(() => parseUrlList("ftp://x")).toThrow(ConfigError)
        expect(() => parseUrlList("http://a,http://a/")).toThrow(ConfigError)
    })
})
