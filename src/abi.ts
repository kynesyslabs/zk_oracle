export const ABI = [
    // ─── State ───────────────────────────────────────────────────────────────
    {
        type: "function",
        name: "owner",
        inputs: [],
        outputs: [{ type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "threshold",
        inputs: [],
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "isOracle",
        inputs: [{ name: "oracle", type: "address" }],
        outputs: [{ type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "oracleCount",
        inputs: [],
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "latestRoot",
        inputs: [],
        outputs: [
            { name: "rootHash", type: "bytes32" },
            { name: "demosBlockNumber", type: "uint256" },
            { name: "leafCount", type: "uint256" },
            { name: "updatedAt", type: "uint256" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getLatestRoot",
        inputs: [],
        outputs: [
            { name: "rootHash", type: "bytes32" },
            { name: "demosBlockNumber", type: "uint256" },
            { name: "leafCount", type: "uint256" },
            { name: "updatedAt", type: "uint256" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "rootByBlock",
        inputs: [{ name: "demosBlockNumber", type: "uint256" }],
        outputs: [
            { name: "rootHash", type: "bytes32" },
            { name: "demosBlockNumber", type: "uint256" },
            { name: "leafCount", type: "uint256" },
            { name: "updatedAt", type: "uint256" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "voteCount",
        inputs: [{ name: "voteKey", type: "bytes32" }],
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getVoteCount",
        inputs: [
            { name: "rootHash", type: "bytes32" },
            { name: "demosBlockNumber", type: "uint256" },
            { name: "leafCount", type: "uint256" },
        ],
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "hasVoted",
        inputs: [
            { name: "oracle", type: "address" },
            { name: "rootHash", type: "bytes32" },
            { name: "demosBlockNumber", type: "uint256" },
            { name: "leafCount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
        stateMutability: "view",
    },
    // ─── Oracle: vote submission ──────────────────────────────────────────────
    {
        type: "function",
        name: "submitVote",
        inputs: [
            { name: "rootHash", type: "bytes32" },
            { name: "demosBlockNumber", type: "uint256" },
            { name: "leafCount", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    // ─── Owner: oracle management ─────────────────────────────────────────────
    {
        type: "function",
        name: "addOracle",
        inputs: [{ name: "oracle", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "removeOracle",
        inputs: [{ name: "oracle", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setThreshold",
        inputs: [{ name: "_threshold", type: "uint256" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "transferOwnership",
        inputs: [{ name: "newOwner", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    // ─── Events ───────────────────────────────────────────────────────────────
    {
        type: "event",
        name: "RootUpdated",
        inputs: [
            { name: "rootHash", type: "bytes32", indexed: true },
            { name: "demosBlockNumber", type: "uint256", indexed: false },
            { name: "leafCount", type: "uint256", indexed: false },
            { name: "timestamp", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "VoteCast",
        inputs: [
            { name: "oracle", type: "address", indexed: true },
            { name: "voteKey", type: "bytes32", indexed: true },
            { name: "currentCount", type: "uint256", indexed: false },
            { name: "threshold", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "OracleAdded",
        inputs: [{ name: "oracle", type: "address", indexed: true }],
    },
    {
        type: "event",
        name: "OracleRemoved",
        inputs: [{ name: "oracle", type: "address", indexed: true }],
    },
    {
        type: "event",
        name: "ThresholdChanged",
        inputs: [
            { name: "previousThreshold", type: "uint256", indexed: false },
            { name: "newThreshold", type: "uint256", indexed: false },
        ],
    },
    // ─── Errors ───────────────────────────────────────────────────────────────
    { type: "error", name: "NotOwner", inputs: [] },
    { type: "error", name: "NotOracle", inputs: [] },
    { type: "error", name: "AlreadyVoted", inputs: [] },
    {
        type: "error",
        name: "StaleRoot",
        inputs: [
            { name: "submitted", type: "uint256" },
            { name: "latest", type: "uint256" },
        ],
    },
    { type: "error", name: "InvalidThreshold", inputs: [] },
    { type: "error", name: "OracleAlreadyExists", inputs: [] },
    { type: "error", name: "OracleNotFound", inputs: [] },
    { type: "error", name: "IsPaused", inputs: [] },
    { type: "error", name: "NotPaused", inputs: [] },
    {
        type: "error",
        name: "BlockJumpTooLarge",
        inputs: [
            { name: "submitted", type: "uint256" },
            { name: "latest", type: "uint256" },
            { name: "maxAdvance", type: "uint256" },
        ],
    },
] as const
