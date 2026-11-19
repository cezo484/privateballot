// Chain client for the ballot contract. Each function maps to one circuit
// in contracts/ballot.compact. The audit check runs fully locally: it
// recomputes a vote commitment with the contract's pure circuit and checks
// membership against the public ledger state, so no transaction is needed.
import { deployContract, submitCallTx, } from '@midnight-ntwrk/midnight-js-contracts';
import { ContractState, } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime';
import { CompiledBallotContract, ledger, pureCircuits, } from '../contracts/index.js';
import {} from './providers.js';
import {} from './witnesses.js';
export async function readLedger(providers, contractAddress) {
    const read = await providers.publicDataProvider.queryContractState(contractAddress);
    if (read === null) {
        throw new Error(`No contract state found at ${contractAddress}`);
    }
    return ledger(read.contractState.deserialize({ v9: ContractState }).data);
}
export async function deployBallot(providers, privateStateId, initialPrivateState, optionCount) {
    const deployed = await deployContract(providers, {
        compiledContract: CompiledBallotContract,
        privateStateId,
        initialPrivateState,
        args: [BigInt(optionCount)],
    });
    return deployed.deployTxData.public.contractAddress;
}
export async function castVoteOnChain(providers, contractAddress, privateStateId, choice, salt) {
    await submitCallTx(providers, {
        compiledContract: CompiledBallotContract,
        contractAddress,
        privateStateId,
        circuitId: 'castVote',
        args: [BigInt(choice), salt],
    });
}
export async function closeBallotOnChain(providers, contractAddress, privateStateId) {
    await submitCallTx(providers, {
        compiledContract: CompiledBallotContract,
        contractAddress,
        privateStateId,
        circuitId: 'closeBallot',
    });
}
export async function revealVoteOnChain(providers, contractAddress, privateStateId, choice, salt) {
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
export async function auditVote(providers, contractAddress, choice, salt) {
    const state = await readLedger(providers, contractAddress);
    const commitment = pureCircuits.commitmentOf(BigInt(choice), salt);
    return state.ballots.member(commitment);
}
export function tallyFromLedger(state) {
    return [
        Number(state.votes0),
        Number(state.votes1),
        Number(state.votes2),
        Number(state.votes3),
    ].slice(0, Number(state.optionCount));
}
