import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '../components/Providers'
import './globals.css'
import '../../../../packages/widget/src/styles.css'

export const metadata: Metadata = {
  title: 'usdh-kit builder gallery',
  description: 'SDK and widget reference gallery for USDH builders on Hyperliquid',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
