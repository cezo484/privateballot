# PrivateBallot

Private voting for small communities on Midnight. A group creates a ballot, members cast votes that stay hidden, and only the totals come out at the end. A voter can still prove their own vote to an auditor without exposing anyone else.

Built for the Midnight Buildathon Wave 3 on AKINDO.

## How it works

1. The organizer deploys the contract with 2 to 4 options. The ballot opens.
2. Each voter casts one vote. The vote itself never reaches the ledger. The contract stores a commitment, a hash of the choice and a random salt, plus a one-time voter mark that stops the same voter from voting twice. Nobody can read a choice from a commitment.
3. The organizer closes the ballot. Only the organizer can close it.
4. After close, votes are revealed one by one. Each reveal discloses that one choice and adds it to the public tally. The tally shows totals only. Nothing links a revealed choice back to the voter who cast it, because the salt is random per vote. Anyone can reveal any cast vote, so the tally does not depend on the organizer.
5. Selective disclosure: a voter proves their own vote by showing the choice and the salt to an auditor. The auditor recomputes the commitment with the contract's `commitmentOf` circuit, which runs locally with no transaction, and checks it against the public set of cast votes. That check exposes no other vote.

## Project layout

```
contracts/ballot.compact        the contract
contracts/managed/ballot/       compiled output: keys, ZKIR, generated JS/TS
contracts/index.ts              compiled contract binding for midnight-js
src/ballot-model.ts             pure state machine mirroring the contract
src/ballot.ts                   chain client: deploy, cast, close, reveal, audit
src/chain-demo.ts               full flow against a live network
src/cli.ts                      local demo, no chain needed
src/config.ts                   network endpoints (local, preview, preprod)
src/providers.ts                midnight-js providers
src/wallet.ts                   test wallet setup
src/witnesses.ts                the localSk witness and key helpers
scripts/compile.sh              compile with compact, compactc fallback
scripts/wait-for-dust.ts        wait for spendable DUST on the local network
test/                           node:test suites
public/index.html               browser demo, no server needed
compose.yml                     local Midnight network (node, indexer, proof server)
```

## Requirements

- Node.js 22 or 24
- Compact toolchain 0.36.1 (language 0.28.0)
- Docker with Compose v2, only for the local network

## Install the toolchain

```
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.36.1
```

Check it with `compact compile --version`. It should print 0.36.1.

## Quick start

```
npm install
npm run compile     # builds contracts/managed/ballot (already committed)
npm test            # 27 tests: state machine, tally math, compiled artifacts
npm run demo        # scripted local run: create, vote, close, reveal, audit
```

Open `public/index.html` in a browser for the same flow with buttons. It needs no server.

## The contract

`contracts/ballot.compact`, Compact 0.28.0, compiled with toolchain 0.36.1.

| Circuit | What it does |
| --- | --- |
| `castVote(choice, salt)` | Casts one hidden vote while the ballot is open. Rejects a second vote from the same voter and choices outside the options. |
| `closeBallot()` | Closes the ballot. Organizer only. |
| `revealVote(choice, salt)` | Reveals one vote after close and counts it in the tally. Rejects unknown votes and double reveals. |
| `verifyVote(choice, salt)` | Returns whether the pair matches a cast vote. On-chain check for the audit flow. |
| `commitmentOf(choice, salt)` | Pure circuit, no proof. Recomputes a vote commitment locally for the audit flow. |

Ledger state: organizer (sealed), ballot state, option count, four tally counters, voter marks, vote commitments, revealed commitments, vote count, revealed count.

## Run against a local network

```
npm run env:up      # node, indexer, proof server
npm run wait:dust   # wait for the test wallet to hold spendable DUST
npm run chain:demo  # deploy, cast 3 votes, close, reveal, audit
npm run env:down
```

The local flow uses the devnet test seed, which the network funds at startup. No real wallet is involved.

## Run against preprod

This is the live testnet path. It needs a funded test wallet and a proof server.

1. Install the Lace wallet extension and create a wallet for preprod.
2. Get tNIGHT from the faucet page in `src/config.ts` (`PREPROD_CONFIG.faucet`). Fund the wallet, then wait for the balance to show in Lace.
3. Start a proof server on your machine. The compose file in this repo starts one on port 6300: `docker compose up -d proof-server`. Or set `MIDNIGHT_PROOF_SERVER` to a server you run elsewhere.
4. Export your wallet secret to the shell. Use the mnemonic or the seed, not both:
   ```
   export MIDNIGHT_NETWORK=preprod
   export MIDNIGHT_PREPROD_MNEMONIC="word word word ..."
   ```
   Keep testnet secrets in test wallets only. Never reuse a mainnet secret here.
5. Run the flow:
   ```
   npm run chain:demo
   ```
   The script prints the deployed contract address. Save it; the address is how the ballot is found again.

Preview works the same way with `MIDNIGHT_NETWORK=preview` and `MIDNIGHT_PREVIEW_MNEMONIC`.

## Status

- The contract compiles with toolchain 0.36.1 and the compiled output is in the repo.
- The local demo, the browser demo, and the test suite run and pass.
- The live flow (`chain:demo`) is written and typechecks, but it has not run against a live network from this machine. This machine has no Docker and no funded wallet, so the local network and the testnet deploy are still open. They are the next step on a machine with Docker, or on preprod with the steps above.

## Limits

- A ballot has 2 to 4 options. The count is fixed in the contract to keep the circuit small.
- Revealing is one transaction per vote. A ballot with many voters needs many reveal transactions.
- Totals appear progressively as votes are revealed. The final totals are complete only after every vote is revealed.
- The voter mark stops double voting per secret key. If two people share one secret key, the contract sees one voter.

## Troubleshooting

- `language version mismatch`: the compiler is not 0.36.1. Run `compact update 0.36.1`.
- `compact update` fails with a DNS error: some sandboxed networks block the manager's GitHub API calls. `scripts/compile.sh` falls back to the `compactc` binary from the toolchain zip. Download `compactc_v0.36.1_x86_64-unknown-linux-musl.zip` from the compact releases page and place the extracted files in `~/.compact/versions/0.36.1/`.
- `Cannot find module './managed/ballot/contract/index.js'`: the contract is not compiled. Run `npm run compile`.
- `Wallet.InsufficientFunds` on the local network: run `npm run wait:dust` first.
- `Cannot connect to the Docker daemon`: Docker is not running. Start it, then rerun `npm run env:up`.

## License

Apache-2.0. See LICENSE.
