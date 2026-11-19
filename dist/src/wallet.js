import { FluentWalletBuilder, MidnightWalletProvider, syncWallet as testkitSyncWallet, } from '@midnight-ntwrk/testkit-js';
import { LedgerParameters } from '@midnight-ntwrk/midnight-js-protocol/v9';
export { MidnightWalletProvider };
// Builds testkit's era-aware wallet provider (it declares `supportedEras`
// and balances/submits for ledger 9) from a seed or mnemonic, without
// starting it.
export async function buildWallet(logger, env, secret) {
    const dustOptions = {
        ledgerParams: LedgerParameters.initialParameters(),
        additionalFeeOverhead: 1000n,
        feeBlocksMargin: 5,
    };
    const fluent = FluentWalletBuilder.forEnvironment(env);
    // Fresh starts on a chain past the v9 fork skip the ledger-8 dust history
    // (the chain re-emitted its dust as v9 events when it crossed), so DUST
    // syncs from the boundary instead of replaying every older event. Dust
    // only; the wallet's ledger-8 dust transaction history is not recorded.
    // Disable with MIDNIGHT_FULL_DUST_HISTORY=1.
    if (process.env['MIDNIGHT_FULL_DUST_HISTORY'] !== '1') {
        fluent.config['skipLedgerV8DustHistory'] = true;
    }
    const base = fluent.withDustOptions(dustOptions);
    const builder = secret.kind === 'mnemonic' ? base.withMnemonic(secret.value) : base.withSeed(secret.value);
    const { wallet, seeds, keystore } = (await builder.buildWithoutStarting());
    logger.info(`Wallet built from ${secret.kind}`);
    return MidnightWalletProvider.withWallet(logger, env, wallet, seeds, keystore);
}
// Waits for all three wallet variants to finish syncing (testkit's
// progress-aware implementation).
export async function syncWallet(logger, wallet, timeout = 300_000) {
    logger.info('Syncing wallet...');
    return testkitSyncWallet(wallet, 1_000, timeout);
}
