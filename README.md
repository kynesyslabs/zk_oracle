# zk-oracle-server

Polls several Demos nodes for the ZK identity merkle root and votes it into a
`ZKIdentityRegistry` contract on an EVM network.

```
Demos nodes ──(GET /zk/merkle-root + nodeCall getChainIdentity)──► oracle ──(submitVote)──► ZKIdentityRegistry
```

## Requirements

- [Bun](https://bun.sh)
- Demos nodes to read (ideally several, run by different operators)
- A deployed `ZKIdentityRegistry`, see [zk-oracle-contracts](https://github.com/kynesyslabs/zk_oracle_contracts)

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

### Docker: mount the keystore

`compose.yml` mounts `./oracle.keystore.json` read-only at
`/run/secrets/oracle.keystore.json`; on other platforms mount the file (a secret
file, not an environment variable) at `KEYSTORE_PATH`. The container refuses to
start without it.

Development fallback only: with `ALLOW_ENV_PRIVATE_KEY=1` and `ORACLE_PRIVATE_KEY`
set, and no file at `KEYSTORE_PATH`, the entrypoint mints the keystore from the raw
key at startup. The raw key then lives in the deployment's environment; never use
this for an oracle that votes on a production registry.

## Setup

```bash
bun install
cp .env.example .env
# Edit .env: the Demos node URLs, the EVM network (EVM_RPC_URL, EVM_CHAIN_ID),
# CONTRACT_ADDRESS, KEYSTORE_PATH and KEYSTORE_PASSWORD
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

See `.env.example` for every variable with comments.

| Variable | Required | Default | Description |
|---|---|---|---|
| `KEYSTORE_PATH` | yes | | Encrypted JSON keystore file |
| `KEYSTORE_PASSWORD` | yes | | Keystore password |
| `CONTRACT_ADDRESS` | yes | | `ZKIdentityRegistry` address |
| `EVM_RPC_URL` | yes | | RPC of the registry's network |
| `EVM_CHAIN_ID` | yes | | Chain id the RPC must serve (checked at startup) |
| `EVM_NETWORK_NAME` | no | `chain <id>` | Label for logs and `/health` |
| `DEMOS_RPC_URLS` | yes (or `DEMOS_RPC_URL`) | | Comma-separated Demos node URLs |
| `DEMOS_QUORUM` | no | all reachable agree, ≥ 2 (1 with one URL) | Identical answers needed to vote |
| `DEMOS_FETCH_TIMEOUT_MS` | no | `5000` | Timeout of every node request |
| `MAX_FEE_PER_GAS_GWEI` | no | `100` | Cap on `maxFeePerGas` |
| `MAX_PRIORITY_FEE_PER_GAS_GWEI` | no | `2` | Cap on `maxPriorityFeePerGas` |
| `TX_WAIT_TIMEOUT_MS` | no | `120000` | Wait before replacing an unmined vote |
| `FEE_BUMP_PERCENT` | no | `25` | Fee raise per replacement (≥ 10) |
| `MAX_FEE_BUMPS` | no | `3` | Replacements before giving up until the next tick |
| `POLL_INTERVAL_MS` | no | `10000` | Pause between ticks |
| `HEALTH_PORT` | no | `8080` | Port of `GET /health` (`0` disables) |
| `HEALTH_HOST` | no | `127.0.0.1` | Bind address of the health server (compose sets `0.0.0.0` in the container) |
| `MAX_LAG_POLLS` | no | `30` | Polls the registry may stay behind the nodes before `/health` is unhealthy |
| `MAX_DEMOS_BLOCK` | no | | Sanity ceiling on a reported block number |

## How it works

Every tick (`POLL_INTERVAL_MS` after the previous one finished):

1. Each Demos node is asked for `GET /zk/merkle-root` and `nodeCall getChainIdentity`
   (bounded by `DEMOS_FETCH_TIMEOUT_MS`). The oracle continues only when the nodes
   reach quorum on the same `(root, blockNumber, leafCount, genesisHash)`.
2. It reads the registry's current epoch, latest root, pause flag and its own oracle
   status. If the nodes' genesis hash is not the registry's current epoch, it does not
   vote: it logs an error and `/health` reports `epochMatch: false` until the owner
   calls `startEpoch` for the nodes' chain.
3. When the nodes are ahead of the registry and this oracle has not voted for the
   root yet, it calls `submitVote(genesisHash, root, blockNumber, leafCount)`: simulated
   first, then sent with capped fees and replaced at the same nonce with higher fees
   if not mined in time.
4. `StaleRoot` is skipped only when the registry, in the same epoch, already holds
   that block (the other oracles finalised it first). After an epoch mismatch, or when
   the registry moved to another epoch, it is an error.
5. When the registry's epoch changes, the oracle drops its cursor and votes the new
   chain from its first root.

## Health

`GET /health` returns JSON with `healthy`, `lastSuccessfulVoteAt`, `lastVoteTx`,
`lastSeenNodeRoot` (with the number of agreeing nodes), per-node status, `onChain`
(epoch, genesis hash, latest root, paused, isOracle), `epochMatch`, `lagBlocks`
(node block minus the registry's latest block) and `lastError`. The status is
`200` when the last tick succeeded, the epochs match and the registry has not
stayed behind the nodes for more than `MAX_LAG_POLLS` polls (`lagTicks`), `503`
otherwise. URLs in errors and node entries are cut to scheme and host, since RPC
URLs often carry API keys. The
Docker image uses it as its `HEALTHCHECK`.

## License

MIT, see [LICENSE](LICENSE).

<!-- ci: coolify deploy-notification test 2026-08-26 -->
