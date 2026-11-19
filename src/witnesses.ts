// Witnesses for the ballot contract.
//
// The contract calls one witness, localSk, to get the caller's DApp secret
// key. That key never leaves the local machine. It feeds two things:
// the organizer check in closeBallot, and the one-time voter mark in
// castVote. Each voter keeps a different secret key in their own private
// state, so voter marks cannot be linked across ballots or to a wallet.

import { randomBytes } from 'node:crypto';
import type { Witnesses } from '../contracts/managed/ballot/contract/index.js';

export type BallotPrivateState = {
  // Hex-encoded 32-byte secret. Stored as a string because private state
  // providers only persist plain data; the witness decodes it.
  secretKey: string;
};

export const witnesses: Witnesses<BallotPrivateState> = {
  localSk({ privateState }) {
    return [privateState, fromHex(privateState.secretKey)];
  },
};

export function randomSecretKey(): string {
  return randomBytes(32).toString('hex');
}

export function randomSalt(): Uint8Array {
  return randomBytes(32);
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function fromHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}
