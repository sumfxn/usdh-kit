import { getDefaultConfig } from 'connectkit'
import { http } from 'viem'
import { createConfig } from 'wagmi'

import { hyperEvmMainnet, hyperEvmTestnet } from './chains'

const WALLETCONNECT_PROJECT_ID = process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] ?? ''

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [hyperEvmTestnet, hyperEvmMainnet],
    transports: {
      [hyperEvmMainnet.id]: http(),
      [hyperEvmTestnet.id]: http(),
    },
    walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
    appName: 'usdh-kit demo',
    appDescription: 'Migrate remaining USDH back to USDC on Hyperliquid',
    appUrl: 'https://github.com/sumfxn/usdh-kit',
  }),
)
