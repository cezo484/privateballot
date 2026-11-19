// Witnesses for the ballot contract.
//
// The contract calls one witness, localSk, to get the caller's DApp secret
// key. That key never leaves the local machine. It feeds two things:
// the organizer check in closeBallot, and the one-time voter mark in
// castVote. Each voter keeps a different secret key in their own private
// state, so voter marks cannot be linked across ballots or to a wallet.
import { randomBytes } from 'node:crypto';
export const witnesses = {
    localSk({ privateState }) {
        return [privateState, fromHex(privateState.secretKey)];
    },
};
export function randomSecretKey() {
    return randomBytes(32).toString('hex');
}
export function randomSalt() {
    return randomBytes(32);
}
export function toHex(bytes) {
    return Buffer.from(bytes).toString('hex');
}
export function fromHex(hex) {
    return new Uint8Array(Buffer.from(hex, 'hex'));
}
