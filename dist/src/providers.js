import {} from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import {} from './wallet.js';
import {} from './config.js';
export function buildProviders(wallet, zkConfigPath, config) {
    const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
    return {
        privateStateProvider: levelPrivateStateProvider({
            privateStateStoreName: `privateballot-${Date.now()}`,
            privateStoragePasswordProvider: () => 'PrivateBallot-Local-Password',
            accountId: wallet.getCoinPublicKey(),
        }),
        publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
        zkConfigProvider,
        proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
        walletProvider: wallet,
        config: { networkId: config.networkId, ttlSeconds: 3600 },
        midnightProvider: wallet,
    };
}
