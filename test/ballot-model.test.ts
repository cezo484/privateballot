import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  castVote,
  closeBallot,
  createBallot,
  revealVote,
  totals,
  verifyVote,
  voteCommitment,
  voterMark,
  winner,
} from '../src/ballot-model.js';

const QUESTION = 'Which day for the next community meetup?';
const OPTIONS = ['Friday', 'Saturday', 'Sunday'];

describe('createBallot', () => {
  it('creates an open ballot with zeroed tallies', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    assert.equal(ballot.state, 'OPEN');
    assert.deepEqual(ballot.tally, [0, 0, 0]);
    assert.equal(ballot.voteCount, 0);
    assert.equal(ballot.revealedCount, 0);
  });

  it('rejects fewer than two options', () => {
    assert.throws(() => createBallot(QUESTION, ['Only']), /at least 2 options/);
  });

  it('rejects more than four options', () => {
    assert.throws(
      () => createBallot(QUESTION, ['A', 'B', 'C', 'D', 'E']),
      /at most 4 options/,
    );
  });

  it('accepts two and four options', () => {
    assert.equal(createBallot(QUESTION, ['A', 'B']).options.length, 2);
    assert.equal(createBallot(QUESTION, ['A', 'B', 'C', 'D']).options.length, 4);
  });
});

describe('castVote', () => {
  it('records a commitment, not the choice', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    const receipt = castVote(ballot, 'voter-1', 1, 'salt-1');
    assert.equal(ballot.voteCount, 1);
    assert.equal(ballot.ballots.size, 1);
    assert.equal(receipt.commitment, voteCommitment(1, 'salt-1'));
    // The stored value reveals nothing on its own.
    assert.equal(ballot.ballots.has('1'), false);
    assert.equal(ballot.ballots.has('Saturday'), false);
  });

  it('rejects a second vote from the same voter', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    castVote(ballot, 'voter-1', 1, 'salt-1');
    assert.throws(() => castVote(ballot, 'voter-1', 0, 'salt-2'), /already cast a vote/);
    assert.equal(ballot.voteCount, 1);
  });

  it('accepts different voters with the same choice', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    castVote(ballot, 'voter-1', 1, 'salt-1');
    castVote(ballot, 'voter-2', 1, 'salt-2');
    assert.equal(ballot.voteCount, 2);
    assert.equal(ballot.ballots.size, 2);
  });

  it('rejects out of range choices', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    assert.throws(() => castVote(ballot, 'voter-1', 3, 'salt-1'), /not one of the options/);
    assert.throws(() => castVote(ballot, 'voter-1', -1, 'salt-1'), /not one of the options/);
  });

  it('rejects votes after close', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    closeBallot(ballot);
    assert.throws(() => castVote(ballot, 'voter-1', 1, 'salt-1'), /closed/);
  });
});

describe('voterMark and voteCommitment', () => {
  it('marks are stable per voter and distinct across voters', () => {
    assert.equal(voterMark('voter-1'), voterMark('voter-1'));
    assert.notEqual(voterMark('voter-1'), voterMark('voter-2'));
  });

  it('commitments are deterministic for a choice and salt', () => {
    assert.equal(voteCommitment(1, 'salt-1'), voteCommitment(1, 'salt-1'));
    assert.notEqual(voteCommitment(1, 'salt-1'), voteCommitment(1, 'salt-2'));
    assert.notEqual(voteCommitment(1, 'salt-1'), voteCommitment(0, 'salt-1'));
  });
});

describe('closeBallot and revealVote', () => {
  it('rejects a second close', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    closeBallot(ballot);
    assert.throws(() => closeBallot(ballot), /already closed/);
  });

  it('rejects reveals while open', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    const receipt = castVote(ballot, 'voter-1', 1, 'salt-1');
    assert.throws(() => revealVote(ballot, receipt.choice, receipt.salt), /still open/);
  });

  it('rejects reveals of votes that were never cast', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    castVote(ballot, 'voter-1', 1, 'salt-1');
    closeBallot(ballot);
    assert.throws(() => revealVote(ballot, 0, 'salt-1'), /No such vote/);
    assert.throws(() => revealVote(ballot, 1, 'wrong-salt'), /No such vote/);
  });

  it('rejects revealing the same vote twice', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    const receipt = castVote(ballot, 'voter-1', 1, 'salt-1');
    closeBallot(ballot);
    revealVote(ballot, receipt.choice, receipt.salt);
    assert.throws(() => revealVote(ballot, receipt.choice, receipt.salt), /already revealed/);
    assert.equal(ballot.tally[1], 1);
  });

  it('tallies revealed votes and reports totals only', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    const receipts = [
      castVote(ballot, 'voter-1', 1, 'salt-1'),
      castVote(ballot, 'voter-2', 0, 'salt-2'),
      castVote(ballot, 'voter-3', 1, 'salt-3'),
      castVote(ballot, 'voter-4', 2, 'salt-4'),
      castVote(ballot, 'voter-5', 1, 'salt-5'),
    ];
    // Nothing counts before reveal.
    assert.deepEqual(ballot.tally, [0, 0, 0]);
    closeBallot(ballot);
    for (const receipt of receipts) {
      revealVote(ballot, receipt.choice, receipt.salt);
    }
    assert.deepEqual(ballot.tally, [1, 3, 1]);
    assert.equal(ballot.revealedCount, 5);
    assert.deepEqual(totals(ballot), [
      { option: 'Friday', votes: 1 },
      { option: 'Saturday', votes: 3 },
      { option: 'Sunday', votes: 1 },
    ]);
    assert.equal(winner(ballot), 'Saturday');
  });

  it('winner is null before any reveal', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    assert.equal(winner(ballot), null);
  });
});

describe('verifyVote (selective disclosure)', () => {
  it('accepts the true choice and salt, rejects anything else', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    const receipt = castVote(ballot, 'voter-1', 2, 'salt-1');
    assert.equal(verifyVote(ballot, receipt.choice, receipt.salt), true);
    assert.equal(verifyVote(ballot, 0, receipt.salt), false);
    assert.equal(verifyVote(ballot, receipt.choice, 'other-salt'), false);
  });

  it('works after close, without exposing other votes', () => {
    const ballot = createBallot(QUESTION, OPTIONS);
    castVote(ballot, 'voter-1', 2, 'salt-1');
    castVote(ballot, 'voter-2', 0, 'salt-2');
    closeBallot(ballot);
    assert.equal(verifyVote(ballot, 2, 'salt-1'), true);
    // The check only answers for the pair it is given.
    assert.equal(verifyVote(ballot, 0, 'salt-1'), false);
  });
});
