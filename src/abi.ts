// ABI of ZKIdentityRegistry (zk_oracle_contracts, contracts/ZKIdentityRegistry.sol),
// copied from `forge build` output: out/ZKIdentityRegistry.sol/ZKIdentityRegistry.json.
// Kept whole so every custom error decodes by name.
export const ABI = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "initialOracles",
                "type": "address[]",
                "internalType": "address[]"
            },
            {
                "name": "threshold_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "verifier_",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "genesisHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "acceptOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addOracle",
        "inputs": [
            {
                "name": "oracle",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "adminSetLatestRoot",
        "inputs": [
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "checkIdentity",
        "inputs": [
            {
                "name": "a",
                "type": "uint256[2]",
                "internalType": "uint256[2]"
            },
            {
                "name": "b",
                "type": "uint256[2][2]",
                "internalType": "uint256[2][2]"
            },
            {
                "name": "c",
                "type": "uint256[2]",
                "internalType": "uint256[2]"
            },
            {
                "name": "pubSignals",
                "type": "uint256[3]",
                "internalType": "uint256[3]"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "currentEpoch",
        "inputs": [],
        "outputs": [
            {
                "name": "id",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "genesisHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "currentVoteKey",
        "inputs": [
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "epochGenesisHash",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "epochId",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "genesisHashOfEpoch",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getLatestRoot",
        "inputs": [],
        "outputs": [
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "updatedAt",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "epoch",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getVoteCount",
        "inputs": [
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "hasVoted",
        "inputs": [
            {
                "name": "oracle",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "isFinalisedRoot",
        "inputs": [
            {
                "name": "root",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "isOracle",
        "inputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "latestRoot",
        "inputs": [],
        "outputs": [
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "updatedAt",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "epochId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "nullifierUsed",
        "inputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "oracleCount",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "oracleList",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "oracleSetVersion",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "pause",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "paused",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "pendingOwner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "removeOracle",
        "inputs": [
            {
                "name": "oracle",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "revokeRoot",
        "inputs": [
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "revokedRoot",
        "inputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "rootByBlock",
        "inputs": [
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct ZKIdentityRegistry.RootEntry",
                "components": [
                    {
                        "name": "rootHash",
                        "type": "bytes32",
                        "internalType": "bytes32"
                    },
                    {
                        "name": "demosBlockNumber",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "leafCount",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "updatedAt",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "epochId",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "rootByEpochBlock",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "updatedAt",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "epochId",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "rootEpoch",
        "inputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "setThreshold",
        "inputs": [
            {
                "name": "_threshold",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "startEpoch",
        "inputs": [
            {
                "name": "genesisHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "submitVote",
        "inputs": [
            {
                "name": "genesisHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "rootHash",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "threshold",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
            {
                "name": "newOwner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "unpause",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "verifier",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "contract IZKVerifier"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "verifyIdentity",
        "inputs": [
            {
                "name": "a",
                "type": "uint256[2]",
                "internalType": "uint256[2]"
            },
            {
                "name": "b",
                "type": "uint256[2][2]",
                "internalType": "uint256[2][2]"
            },
            {
                "name": "c",
                "type": "uint256[2]",
                "internalType": "uint256[2]"
            },
            {
                "name": "pubSignals",
                "type": "uint256[3]",
                "internalType": "uint256[3]"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "voteCount",
        "inputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "EpochStarted",
        "inputs": [
            {
                "name": "epochId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "genesisHash",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "previousGenesisHash",
                "type": "bytes32",
                "indexed": false,
                "internalType": "bytes32"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "IdentityVerified",
        "inputs": [
            {
                "name": "nullifier",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "merkleRoot",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "context",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "caller",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OracleAdded",
        "inputs": [
            {
                "name": "oracle",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OracleRemoved",
        "inputs": [
            {
                "name": "oracle",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "oracleSetVersion",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferStarted",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "Paused",
        "inputs": [
            {
                "name": "by",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RootCorrected",
        "inputs": [
            {
                "name": "epochId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "rootHash",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "timestamp",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RootRevoked",
        "inputs": [
            {
                "name": "epochId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "rootHash",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "RootUpdated",
        "inputs": [
            {
                "name": "epochId",
                "type": "uint256",
                "indexed": true,
                "internalType": "uint256"
            },
            {
                "name": "rootHash",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "demosBlockNumber",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "leafCount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "timestamp",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "ThresholdChanged",
        "inputs": [
            {
                "name": "previousThreshold",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "newThreshold",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "Unpaused",
        "inputs": [
            {
                "name": "by",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "VoteCast",
        "inputs": [
            {
                "name": "oracle",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "voteKey",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "currentCount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "threshold",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AlreadyVoted",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidProof",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidThreshold",
        "inputs": []
    },
    {
        "type": "error",
        "name": "IsPaused",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotOracle",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotOwner",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotPaused",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotPendingOwner",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NullifierAlreadyUsed",
        "inputs": [
            {
                "name": "nullifier",
                "type": "uint256",
                "internalType": "uint256"
            }
        ]
    },
    {
        "type": "error",
        "name": "OracleAlreadyExists",
        "inputs": []
    },
    {
        "type": "error",
        "name": "OracleNotFound",
        "inputs": []
    },
    {
        "type": "error",
        "name": "RootIsRevoked",
        "inputs": [
            {
                "name": "root",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "RootNotFinalised",
        "inputs": [
            {
                "name": "root",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "SameEpoch",
        "inputs": [
            {
                "name": "genesisHash",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "StaleRoot",
        "inputs": [
            {
                "name": "submitted",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "latest",
                "type": "uint256",
                "internalType": "uint256"
            }
        ]
    },
    {
        "type": "error",
        "name": "WrongEpoch",
        "inputs": [
            {
                "name": "submitted",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "current",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ]
    },
    {
        "type": "error",
        "name": "ZeroAddress",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ZeroValue",
        "inputs": []
    }
] as const
