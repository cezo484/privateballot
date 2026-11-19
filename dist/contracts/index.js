import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-js';
import path from 'node:path';
export { Contract, ledger, pureCircuits, BallotState, } from './managed/ballot/contract/index.js';
import { Contract } from './managed/ballot/contract/index.js';
import { witnesses } from '../src/witnesses.js';
const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'ballot');
export const CompiledBallotContract = CompiledContract.make('BallotContract', Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(zkConfigPath));
