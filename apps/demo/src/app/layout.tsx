import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '../components/Providers'
import './globals.css'
import '../../../../packages/widget/src/styles.css'

export const metadata: Metadata = {
  title: 'usdh-kit demo',
  description: 'Swap stables into USDH on Hyperliquid, end-to-end demo',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen overflow-x-hidden font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
