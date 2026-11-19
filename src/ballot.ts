// Chain client for the ballot contract. Each function maps to one circuit
// in contracts/ballot.compact. The audit check runs fully locally: it
// recomputes a vote commitment with the contract's pure circuit and checks
// membership against the public ledger state, so no transaction is needed.

import {
  deployContract,
  submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';
import {
  ContractState,
  type ContractAddress,
} from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime';
import {
  CompiledBallotContract,
  ledger,
  pureCircuits,
  type Ledger,
} from '../contracts/index.js';
import { type BallotProviders } from './providers.js';
import { type BallotPrivateState } from './witnesses.js';

export type { ContractAddress, Ledger };

export async function readLedger(
  providers: BallotProviders,
  contractAddress: ContractAddress,
): Promise<Ledger> {
  const read = await providers.publicDataProvider.queryContractState(contractAddress);
  if (read === null) {
    throw new Error(`No contract state found at ${contractAddress}`);
  }
  return ledger(read.contractState.deserialize({ v9: ContractState }).data);
}

export async function deployBallot(
  providers: BallotProviders,
  privateStateId: string,
  initialPrivateState: BallotPrivateState,
  optionCount: number,
): Promise<ContractAddress> {
  const deployed = await deployContract(providers, {
    compiledContract: CompiledBallotContract,
    privateStateId,
    initialPrivateState,
    args: [BigInt(optionCount)],
  });
  return deployed.deployTxData.public.contractAddress;
}

export async function castVoteOnChain(
  providers: BallotProviders,
  contractAddress: ContractAddress,
  privateStateId: string,
  choice: number,
  salt: Uint8Array,
): Promise<void> {
  await submitCallTx(providers, {
    compiledContract: CompiledBallotContract,
    contractAddress,
    privateStateId,
    circuitId: 'castVote',
    args: [BigInt(choice), salt],
  });
}

export async function closeBallotOnChain(
  providers: BallotProviders,
  contractAddress: ContractAddress,
  privateStateId: string,
): Promise<void> {
  await submitCallTx(providers, {
    compiledContract: CompiledBallotContract,
    contractAddress,
    privateStateId,
    circuitId: 'closeBallot',
  });
}

export async function revealVoteOnChain(
  providers: BallotProviders,
  contractAddress: ContractAddress,
  privateStateId: string,
  choice: number,
  salt: Uint8Array,
): Promise<void> {
  await submitCallTx(providers, {
    compiledContract: CompiledBallotContract,
    contractAddress,
    privateStateId,
    circuitId: 'revealVote',
    args: [BigInt(choice), salt],
  });
}

// Selective disclosure, checked locally. The voter shows a choice and a
// salt; the auditor recomputes the commitment with the contract's own
// pure circuit and checks it against the public ballots set.
export async function auditVote(
  providers: BallotProviders,
  contractAddress: ContractAddress,
  choice: number,
  salt: Uint8Array,
): Promise<boolean> {
  const state = await readLedger(providers, contractAddress);
  const commitment = pureCircuits.commitmentOf(BigInt(choice), salt);
  return state.ballots.member(commitment);
}

export function tallyFromLedger(state: Ledger): number[] {
  return [
    Number(state.votes0),
    Number(state.votes1),
    Number(state.votes2),
    Number(state.votes3),
  ].slice(0, Number(state.optionCount));
}
