// Live demo against a Midnight network (local docker network, preview, or
// preprod). Runs the full ballot flow on chain: deploy, cast three hidden
// votes, close, reveal, read totals, audit one vote.
//
// Setup:
//   - Local: start the network first (docker compose up, see README.md).
//     The local test seed is pre-funded by the network.
//   - Preview/preprod: set MIDNIGHT_PREVIEW_MNEMONIC (or _SEED) in the
//     shell, fund the wallet from the faucet page in src/config.ts, and
//     run a proof server on http://127.0.0.1:6300 (or set
//     MIDNIGHT_PROOF_SERVER). Run with MIDNIGHT_NETWORK=preview|preprod.
//
// Each voter gets their own private state (own secret key) under one
// wallet. The voter mark comes from the DApp secret, not the wallet, so
// votes stay unlinkable to the paying wallet.

import { WebSocket } from 'ws';
import {
  type EnvironmentConfiguration,
  waitForFunds,
} from '@midnight-ntwrk/testkit-js';
import pino from 'pino';

import { getConfig } from './config.js';
import {
  type MidnightWalletProvider,
  syncWallet,
  type WalletSecret,
  buildWallet,
} from './wallet.js';
import { buildProviders, type BallotProviders } from './providers.js';
import { zkConfigPath } from '../contracts/index.js';
import {
  auditVote,
  castVoteOnChain,
  closeBallotOnChain,
  deployBallot,
  readLedger,
  revealVoteOnChain,
  tallyFromLedger,
  type ContractAddress,
} from './ballot.js';
import { randomSalt, randomSecretKey, toHex } from './witnesses.js';

// Required for GraphQL subscriptions in Node.js
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

const ALICE_LOCAL_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';

function resolveSecret(net: string): WalletSecret {
  if (net === 'local') return { kind: 'seed', value: ALICE_LOCAL_SEED };

  const upper = net.toUpperCase();
  const mnemonicEnv = `MIDNIGHT_${upper}_MNEMONIC`;
  const seedEnv = `MIDNIGHT_${upper}_SEED`;
  const mnemonic = process.env[mnemonicEnv]?.trim().replace(/\s+/g, ' ');
  const seedHex = process.env[seedEnv]?.trim();

  if (mnemonic && seedHex) {
    throw new Error(`Set only one of ${mnemonicEnv} or ${seedEnv} (both are defined).`);
  }
  if (mnemonic) {
    return { kind: 'mnemonic', value: mnemonic };
  }
  if (seedHex) {
    if (!/^[0-9a-fA-F]+$/.test(seedHex) || seedHex.length % 2 !== 0) {
      throw new Error(`${seedEnv} must be a hex string of even length (no 0x prefix).`);
    }
    return { kind: 'seed', value: seedHex };
  }
  throw new Error(
    `Either ${mnemonicEnv} or ${seedEnv} is required for network '${net}'. ` +
      `Set one in .env.${net} or the shell.`,
  );
}

async function main(): Promise<void> {
  const config = getConfig();
  const secret = resolveSecret(network);
  const isRemote = network !== 'local';
  const syncTimeoutMs = Number(
    process.env['MIDNIGHT_SYNC_TIMEOUT_MS'] ?? (isRemote ? 60 * 60_000 : 10 * 60_000),
  );

  const envConfig: EnvironmentConfiguration = {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexer,
    indexerWS: config.indexerWS,
    node: config.node,
    nodeWS: config.nodeWS,
    faucet: config.faucet,
    proofServer: config.proofServer,
  };

  const wallet: MidnightWalletProvider = await buildWallet(logger, envConfig, secret);
  await wallet.start(false);
  await syncWallet(logger, wallet.wallet, syncTimeoutMs);

  if (isRemote) {
    const nightBalance = await waitForFunds(
      wallet.wallet,
      envConfig,
      false,
      wallet.unshieldedKeystore,
    );
    logger.info(`Wallet NIGHT balance on '${network}': ${nightBalance}`);
  }

  const providers: BallotProviders = buildProviders(wallet, zkConfigPath, config);
  logger.info(`Providers initialized on '${network}'.`);

  try {
    // The organizer deploys a 3-option ballot. deployContract stores the
    // organizer's private state under 'organizer'.
    const contractAddress: ContractAddress = await deployBallot(
      providers,
      'organizer',
      { secretKey: randomSecretKey() },
      3,
    );
    logger.info(`Ballot deployed at: ${contractAddress}`);

    // Three voters cast hidden votes. Each keeps the choice and salt
    // to reveal later and to prove the vote to an auditor.
    const votes: { choice: number; salt: Uint8Array }[] = [];
    const plan = [1, 0, 1];
    const states = providers.privateStateProvider.forContract(contractAddress);
    for (let i = 0; i < plan.length; i++) {
      const stateId = `voter-${i + 1}`;
      const salt = randomSalt();
      await states.set(stateId, { secretKey: randomSecretKey() });
      await castVoteOnChain(providers, contractAddress, stateId, plan[i], salt);
      votes.push({ choice: plan[i], salt });
      logger.info(`Voter ${i + 1} cast a hidden vote (salt ${toHex(salt).slice(0, 12)}...)`);
    }

    let state = await readLedger(providers, contractAddress);
    logger.info(`Votes cast: ${state.voteCount}. Tally while open: ${tallyFromLedger(state).join(', ')}`);

    await closeBallotOnChain(providers, contractAddress, 'organizer');
    logger.info('Ballot closed.');

    for (const vote of votes) {
      await revealVoteOnChain(providers, contractAddress, 'organizer', vote.choice, vote.salt);
    }
    state = await readLedger(providers, contractAddress);
    logger.info(`Votes revealed: ${state.revealedCount} of ${state.voteCount}`);
    logger.info(`Totals: ${tallyFromLedger(state).join(', ')}`);

    const valid = await auditVote(providers, contractAddress, votes[0].choice, votes[0].salt);
    logger.info(`Audit of voter 1's vote: ${valid ? 'valid' : 'invalid'}`);
  } finally {
    logger.info('Stopping wallet...');
    await wallet.stop();
  }
}

main().catch((error: unknown) => {
  logger.error(error);
  process.exit(1);
});
