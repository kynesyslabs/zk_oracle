type Env = Record<string, string | undefined>

export class ConfigError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ConfigError"
    }
}

export interface OracleConfig {
    demos: {
        urls: string[]
        /** Identical answers needed before voting; see resolveQuorum. */
        quorum: number
        /** True when the quorum was left to its default (all reachable nodes must agree). */
        requireAllReachable: boolean
        fetchTimeoutMs: number
    }
    evm: {
        rpcUrl: string
        chainId: bigint
        /** Label for logs only. */
        networkName: string
        contractAddress: string
        maxFeePerGasWei: bigint
        maxPriorityFeePerGasWei: bigint
        txWaitTimeoutMs: number
        feeBumpPercent: number
        maxFeeBumps: number
    }
    pollIntervalMs: number
    maxBlockNumber?: number
    health: { port: number; host: string }
    /** Polls the registry may stay behind the nodes before /health turns unhealthy. */
    maxLagTicks: number
    keystorePath: string
}

function required(env: Env, name: string): string {
    const value = env[name]?.trim()
    if (!value) throw new ConfigError(`Missing required environment variable: ${name}`)
    return value
}

function int(env: Env, name: string, fallback: number, min = 0): number {
    const raw = env[name]?.trim()
    if (raw === undefined || raw === "") return fallback
    if (!/^\d+$/.test(raw)) throw new ConfigError(`${name} must be a non-negative integer, got ${raw}`)
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < min) throw new ConfigError(`${name} must be >= ${min}, got ${raw}`)
    return value
}

const GWEI = 1_000_000_000n

function gwei(env: Env, name: string, fallback: string): bigint {
    const raw = (env[name]?.trim() || fallback)
    const m = /^(\d+)(?:\.(\d{1,9}))?$/.exec(raw)
    if (!m) throw new ConfigError(`${name} must be a decimal amount of gwei, got ${raw}`)
    return BigInt(m[1]) * GWEI + BigInt((m[2] ?? "").padEnd(9, "0"))
}

export function parseUrlList(raw: string): string[] {
    const urls = raw
        .split(",")
        .map(u => u.trim().replace(/\/+$/, ""))
        .filter(u => u.length > 0)
    for (const u of urls) {
        if (!/^https?:\/\/[^\s]+$/.test(u)) throw new ConfigError(`Not an http(s) URL: ${u}`)
    }
    if (new Set(urls).size !== urls.length) throw new ConfigError("Duplicate Demos node URL")
    return urls
}

/**
 * One node can be wrong or compromised, so with several configured the default
 * is the strictest useful rule: every node that answers must agree, and at least
 * two must answer. An explicit DEMOS_QUORUM=k instead votes once k nodes return
 * the same answer.
 */
export function resolveQuorum(urlCount: number, explicit?: number): { quorum: number; requireAllReachable: boolean } {
    if (explicit === undefined) {
        return { quorum: urlCount === 1 ? 1 : 2, requireAllReachable: true }
    }
    if (explicit < 1 || explicit > urlCount) {
        throw new ConfigError(`DEMOS_QUORUM must be between 1 and the ${urlCount} configured node URL(s)`)
    }
    return { quorum: explicit, requireAllReachable: false }
}

export function loadConfig(env: Env = process.env): OracleConfig {
    const urls = parseUrlList(env.DEMOS_RPC_URLS?.trim() || required(env, "DEMOS_RPC_URL"))
    if (urls.length === 0) throw new ConfigError("DEMOS_RPC_URLS lists no URL")
    const explicitQuorum = env.DEMOS_QUORUM?.trim() ? int(env, "DEMOS_QUORUM", 0, 1) : undefined

    // No network default: a wrong default once sent logs and votes to a chain
    // other than the one the operator meant.
    const chainIdRaw = required(env, "EVM_CHAIN_ID")
    if (!/^\d+$/.test(chainIdRaw)) throw new ConfigError(`EVM_CHAIN_ID must be a decimal chain id, got ${chainIdRaw}`)
    const chainId = BigInt(chainIdRaw)

    const contractAddress = required(env, "CONTRACT_ADDRESS")
    if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
        throw new ConfigError(`CONTRACT_ADDRESS is not an address: ${contractAddress}`)
    }

    const maxFeePerGasWei = gwei(env, "MAX_FEE_PER_GAS_GWEI", "100")
    const explicitPriorityCap = Boolean(env.MAX_PRIORITY_FEE_PER_GAS_GWEI?.trim())
    let maxPriorityFeePerGasWei = gwei(env, "MAX_PRIORITY_FEE_PER_GAS_GWEI", "2")
    if (!explicitPriorityCap && maxPriorityFeePerGasWei > maxFeePerGasWei) maxPriorityFeePerGasWei = maxFeePerGasWei
    if (maxPriorityFeePerGasWei > maxFeePerGasWei) {
        throw new ConfigError("MAX_PRIORITY_FEE_PER_GAS_GWEI exceeds MAX_FEE_PER_GAS_GWEI")
    }

    return {
        demos: {
            urls,
            ...resolveQuorum(urls.length, explicitQuorum),
            fetchTimeoutMs: int(env, "DEMOS_FETCH_TIMEOUT_MS", 5_000, 1),
        },
        evm: {
            rpcUrl: required(env, "EVM_RPC_URL"),
            chainId,
            networkName: env.EVM_NETWORK_NAME?.trim() || `chain ${chainId}`,
            contractAddress,
            maxFeePerGasWei,
            maxPriorityFeePerGasWei,
            txWaitTimeoutMs: int(env, "TX_WAIT_TIMEOUT_MS", 120_000, 1),
            // EIP-1559 replacement needs at least +10% on both fees.
            feeBumpPercent: int(env, "FEE_BUMP_PERCENT", 25, 10),
            maxFeeBumps: int(env, "MAX_FEE_BUMPS", 3),
        },
        pollIntervalMs: int(env, "POLL_INTERVAL_MS", 10_000, 1),
        maxBlockNumber: env.MAX_DEMOS_BLOCK?.trim() ? int(env, "MAX_DEMOS_BLOCK", 0, 1) : undefined,
        health: {
            /** 0 disables the health server. */
            port: int(env, "HEALTH_PORT", 8080),
            // Loopback unless asked: /health describes the deployment, and a
            // container that publishes the port sets HEALTH_HOST=0.0.0.0 itself.
            host: env.HEALTH_HOST?.trim() || "127.0.0.1",
        },
        maxLagTicks: int(env, "MAX_LAG_POLLS", 30, 1),
        keystorePath: required(env, "KEYSTORE_PATH"),
    }
}
