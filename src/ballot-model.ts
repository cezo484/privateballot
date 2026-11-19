// Pure model of the PrivateBallot state machine.
//
// This mirrors the rules of contracts/ballot.compact in plain TypeScript so
// the flow can be tried without a chain. The demo CLI and the unit tests run
// against this model. The on-chain contract is the real ballot; this file
// only shows how the states connect.
//
// One deliberate difference: the contract hides a vote with a zero-knowledge
// commitment (persistentCommit inside the circuit). This model uses SHA-256
// as a stand-in, because the circuit hash only runs inside the compiled
// contract. The hiding property is the same shape: the ledger sees a hash,
// never the choice.

import { createHash, randomBytes } from 'node:crypto';

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

export type BallotState = 'OPEN' | 'CLOSED';

export type Ballot = {
  question: string;
  options: string[];
  state: BallotState;
  // One-time mark per voter. In the contract this is a commitment built
  // from the voter's secret key; here it is a hash of the voter id.
  voters: Set<string>;
  // Commitments of cast votes. The choice is not recoverable from these.
  ballots: Set<string>;
  revealed: Set<string>;
  tally: number[];
  voteCount: number;
  revealedCount: number;
};

export type CastVote = {
  voterId: string;
  choice: number;
  salt: string;
  commitment: string;
};

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export function voterMark(voterId: string): string {
  return sha256Hex(`privateballot:voter:${voterId}`);
}

export function voteCommitment(choice: number, salt: string): string {
  return sha256Hex(`privateballot:vote:${choice}:${salt}`);
}

export function randomSalt(): string {
  return randomBytes(32).toString('hex');
}

export function createBallot(question: string, options: string[]): Ballot {
  if (options.length < MIN_OPTIONS) {
    throw new Error(`A ballot needs at least ${MIN_OPTIONS} options`);
  }
  if (options.length > MAX_OPTIONS) {
    throw new Error(`A ballot has at most ${MAX_OPTIONS} options`);
  }
  return {
    question,
    options,
    state: 'OPEN',
    voters: new Set(),
    ballots: new Set(),
    revealed: new Set(),
    tally: options.map(() => 0),
    voteCount: 0,
    revealedCount: 0,
  };
}

// Cast a hidden vote. Returns the receipt the voter keeps: the choice and
// the salt are needed later to reveal the vote and to prove it to an
// auditor. The ballot itself only records the commitment.
export function castVote(
  ballot: Ballot,
  voterId: string,
  choice: number,
  salt: string = randomSalt(),
): CastVote {
  if (ballot.state !== 'OPEN') {
    throw new Error('The ballot is closed');
  }
  if (!Number.isInteger(choice) || choice < 0 || choice >= ballot.options.length) {
    throw new Error('Choice is not one of the options');
  }
  const mark = voterMark(voterId);
  if (ballot.voters.has(mark)) {
    throw new Error('This voter already cast a vote');
  }
  const commitment = voteCommitment(choice, salt);
  ballot.voters.add(mark);
  ballot.ballots.add(commitment);
  ballot.voteCount += 1;
  return { voterId, choice, salt, commitment };
}

export function closeBallot(ballot: Ballot): void {
  if (ballot.state !== 'OPEN') {
    throw new Error('The ballot is already closed');
  }
  ballot.state = 'CLOSED';
}

// Reveal one vote after close. The choice counts toward the tally from
// this point on. Nothing in the reveal links the choice to the voter,
// because the salt is random per vote.
export function revealVote(ballot: Ballot, choice: number, salt: string): void {
  if (ballot.state !== 'CLOSED') {
    throw new Error('The ballot is still open');
  }
  if (!Number.isInteger(choice) || choice < 0 || choice >= ballot.options.length) {
    throw new Error('Choice is not one of the options');
  }
  const commitment = voteCommitment(choice, salt);
  if (!ballot.ballots.has(commitment)) {
    throw new Error('No such vote was cast');
  }
  if (ballot.revealed.has(commitment)) {
    throw new Error('This vote was already revealed');
  }
  ballot.revealed.add(commitment);
  ballot.revealedCount += 1;
  ballot.tally[choice] += 1;
}

// Totals only. Individual votes stay hidden behind their commitments.
export function totals(ballot: Ballot): { option: string; votes: number }[] {
  return ballot.options.map((option, i) => ({ option, votes: ballot.tally[i] }));
}

export function winner(ballot: Ballot): string | null {
  if (ballot.revealedCount === 0) {
    return null;
  }
  let best = 0;
  for (let i = 1; i < ballot.tally.length; i++) {
    if (ballot.tally[i] > ballot.tally[best]) {
      best = i;
    }
  }
  return ballot.options[best];
}

// Selective disclosure: recompute the commitment from the choice and salt
// a voter shows, and check it against the public set of cast votes.
export function verifyVote(ballot: Ballot, choice: number, salt: string): boolean {
  return ballot.ballots.has(voteCommitment(choice, salt));
}
