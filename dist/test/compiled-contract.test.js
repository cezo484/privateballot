import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// The compiled contract is the hard requirement for the submission, so
// the suite checks the artifacts are present and match the expected build.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const managed = path.join(root, 'contracts', 'managed', 'ballot');
function contractInfo() {
    const file = path.join(managed, 'compiler', 'contract-info.json');
    return JSON.parse(readFileSync(file, 'utf8'));
}
describe('compiled contract', () => {
    it('was built with toolchain 0.36.1 and language 0.28.0', () => {
        const info = contractInfo();
        assert.equal(info['compiler-version'], '0.36.1');
        assert.equal(info['language-version'], '0.28.0');
    });
    it('exposes the five expected circuits', () => {
        const info = contractInfo();
        const names = info.circuits.map((c) => c.name).sort();
        assert.deepEqual(names, [
            'castVote',
            'closeBallot',
            'commitmentOf',
            'revealVote',
            'verifyVote',
        ]);
    });
    it('marks commitmentOf pure (no proof needed, runs locally)', () => {
        const info = contractInfo();
        const commitmentOf = info.circuits.find((c) => c.name === 'commitmentOf');
        assert.equal(commitmentOf?.pure, true);
        assert.equal(commitmentOf?.proof, false);
    });
    it('ships prover and verifier keys for every provable circuit', () => {
        for (const name of ['castVote', 'closeBallot', 'revealVote', 'verifyVote']) {
            assert.equal(existsSync(path.join(managed, 'keys', `${name}.prover`)), true, `missing ${name}.prover`);
            assert.equal(existsSync(path.join(managed, 'keys', `${name}.verifier`)), true, `missing ${name}.verifier`);
        }
    });
    it('ships ZKIR for every provable circuit', () => {
        for (const name of ['castVote', 'closeBallot', 'revealVote', 'verifyVote']) {
            assert.equal(existsSync(path.join(managed, 'zkir', `${name}.zkir`)), true);
            assert.equal(existsSync(path.join(managed, 'zkir', `${name}.bzkir`)), true);
        }
    });
    it('ships the generated contract module', () => {
        assert.equal(existsSync(path.join(managed, 'contract', 'index.js')), true);
        assert.equal(existsSync(path.join(managed, 'contract', 'index.d.ts')), true);
    });
    it('ships the contract manifest', () => {
        assert.equal(existsSync(path.join(managed, 'compiler', 'contract-manifest.json')), true);
    });
    it('runs the pure commitment circuit locally', async () => {
        const moduleUrl = pathToFileURL(path.join(managed, 'contract', 'index.js')).href;
        const mod = (await import(moduleUrl));
        const salt = new Uint8Array(32).fill(7);
        const first = mod.pureCircuits.commitmentOf(1n, salt);
        const again = mod.pureCircuits.commitmentOf(1n, salt);
        const other = mod.pureCircuits.commitmentOf(0n, salt);
        assert.equal(first.length, 32);
        assert.deepEqual(first, again);
        assert.notDeepEqual(first, other);
    });
});
