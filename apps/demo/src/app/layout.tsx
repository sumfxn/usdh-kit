import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '../components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'usdh-kit demo',
  description: 'Swap stables into USDH on Hyperliquid, end-to-end demo',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
