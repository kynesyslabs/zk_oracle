# zk-oracle-server

Polls a Demos node for new ZK merkle roots and submits votes to a `ZKOracleRegistry` contract on any EVM network.

```
Demos node  ──(GET /zk/merkle-root)──►  oracle server  ──(submitVote)──►  ZKOracleRegistry
```

## Requirements

- [Bun](https://bun.sh)
- A running Demos node
- A deployed `ZKOracleRegistry` contract — see [zk-oracle-contracts](../contracts)

## Key management

The oracle wallet private key is **never stored in plaintext**. It is kept in an encrypted [ethers.js JSON keystore](https://docs.ethers.org/v6/api/wallet/#Wallet_fromEncryptedJson) (AES-256 / scrypt). Only the keystore password goes in `.env`.

### Create the keystore (one-time)

```bash
# Supply the raw private key via env — it is not written to disk
ORACLE_PRIVATE_KEY=0x... bun run encrypt-key [output-path]
# Default output: oracle.keystore.json (chmod 600)
```

The script prompts for a password twice (input is hidden). It prints the wallet address so you can verify the correct key was used.

After running:
1. Set `KEYSTORE_PATH` and `KEYSTORE_PASSWORD` in `.env` (see below)
2. Delete `ORACLE_PRIVATE_KEY` from your environment and shell history:
   ```bash
   history -d $(history 1 | awk '{print $1}')
   ```
3. The keystore file (`*.keystore.json`) is gitignored — keep it out of source control

## Setup

```bash
bun install
cp .env.example .env
# Edit .env — set KEYSTORE_PATH, KEYSTORE_PASSWORD, CONTRACT_ADDRESS
```

## Run

### Local (Bun)

```bash
bun start
```

### Docker

Use `start.sh` — it validates the `.env` and keystore file before calling Docker:

```bash
./start.sh           # build image and start in background
./start.sh logs      # tail logs
./start.sh stop      # stop and remove container
./start.sh restart   # stop, rebuild, start
```

The keystore file (`oracle.keystore.json`) must exist in the same directory before starting.  
`compose.yml` mounts it read-only into the container at `/run/secrets/oracle.keystore.json`.

On startup the server decrypts the keystore (once), logs the wallet address, then begins polling.

## Environment variables

| Variable            | Required | Default                   | Description                                      |
|---------------------|----------|---------------------------|--------------------------------------------------|
| `KEYSTORE_PATH`     | yes      | —                         | Path to the encrypted JSON keystore file         |
| `KEYSTORE_PASSWORD` | yes      | —                         | Password to decrypt the keystore                 |
| `CONTRACT_ADDRESS`  | yes      | —                         | Deployed `ZKOracleRegistry` address              |
| `DEMOS_RPC_URL`     | no       | `http://localhost:53550`  | Demos node RPC endpoint                          |
| `EVM_RPC_URL`       | no       | `https://rpc.sepolia.org` | EVM network RPC for submitting votes             |
| `POLL_INTERVAL_MS`  | no       | `10000`                   | Poll interval in milliseconds                    |

## How it works

1. Every `POLL_INTERVAL_MS` the server calls `GET {DEMOS_RPC_URL}/zk/merkle-root`
2. If `leafCount` increased, it calls `submitVote(rootHash, blockNumber, leafCount)` on the contract
3. When `threshold` unique oracles submit the same root, the contract finalises it and emits `RootUpdated`
4. Stale or duplicate submissions are rejected by the contract and handled without crashing
5. On `SIGTERM` / `SIGINT` the server exits cleanly (safe for Docker / systemd)
