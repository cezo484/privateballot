// Local demo of the PrivateBallot flow. Runs the pure model in
// ballot-model.ts, no chain needed. The on-chain contract follows the
// same steps; see README.md for the live deploy.

import {
  castVote,
  closeBallot,
  createBallot,
  revealVote,
  totals,
  verifyVote,
  winner,
  type CastVote,
} from './ballot-model.js';

function short(hash: string): string {
  return `${hash.slice(0, 12)}...`;
}

function main(): void {
  console.log('PrivateBallot local demo');
  console.log('=======================');
  console.log('');

  const ballot = createBallot('Which day for the next community meetup?', [
    'Friday',
    'Saturday',
    'Sunday',
  ]);
  console.log(`Ballot created: "${ballot.question}"`);
  console.log(`Options: ${ballot.options.join(', ')}`);
  console.log(`State: ${ballot.state}`);
  console.log('');

  const plan: { voter: string; choice: number }[] = [
    { voter: 'voter-1', choice: 1 },
    { voter: 'voter-2', choice: 0 },
    { voter: 'voter-3', choice: 1 },
    { voter: 'voter-4', choice: 2 },
    { voter: 'voter-5', choice: 1 },
  ];

  const receipts: CastVote[] = [];
  console.log('Casting votes (choices stay hidden, only commitments land on the ledger):');
  for (const { voter, choice } of plan) {
    const receipt = castVote(ballot, voter, choice);
    receipts.push(receipt);
    console.log(`  ${voter}: commitment ${short(receipt.commitment)}`);
  }
  console.log(`Votes cast: ${ballot.voteCount}`);
  console.log(`Tally while open: ${ballot.tally.join(', ')} (nothing revealed yet)`);
  console.log('');

  console.log('Double vote attempt by voter-1:');
  try {
    castVote(ballot, 'voter-1', 0);
    console.log('  ERROR: double vote was accepted');
  } catch (error) {
    console.log(`  rejected: ${(error as Error).message}`);
  }
  console.log('');

  closeBallot(ballot);
  console.log(`Ballot closed. State: ${ballot.state}`);
  console.log('');

  console.log('Revealing votes:');
  for (const receipt of receipts) {
    revealVote(ballot, receipt.choice, receipt.salt);
    console.log(`  commitment ${short(receipt.commitment)} -> ${ballot.options[receipt.choice]}`);
  }
  console.log(`Votes revealed: ${ballot.revealedCount} of ${ballot.voteCount}`);
  console.log('');

  console.log('Totals (individual votes are not linked to voters):');
  for (const row of totals(ballot)) {
    console.log(`  ${row.option}: ${row.votes}`);
  }
  console.log(`Winner: ${winner(ballot)}`);
  console.log('');

  console.log('Selective disclosure: voter-3 proves their vote to an auditor.');
  const proof = receipts[2];
  console.log(`  voter-3 shows choice "${ballot.options[proof.choice]}" and the salt.`);
  console.log(`  auditor check: ${verifyVote(ballot, proof.choice, proof.salt) ? 'valid' : 'invalid'}`);
  console.log(`  wrong choice check: ${verifyVote(ballot, 0, proof.salt) ? 'valid' : 'invalid'}`);
  console.log('');
  console.log('Demo done. The compiled contract lives in contracts/managed/ballot.');
}

main();
