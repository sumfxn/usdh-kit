# demo

Public Next.js dApp showcasing usdh-kit. Wallet connection (wagmi + ConnectKit) and swap UI land in follow-up PRs; this is the scaffold.

## Run locally

```sh
pnpm install
pnpm --filter @usdh-kit-apps/demo dev
```

Then open http://localhost:3000.

## Stack

- Next.js 15 App Router + Turbopack
- Tailwind CSS
- React 19

## Roadmap

- PR2: wagmi + ConnectKit wiring, kit-context hook
- PR3: swap UI (amount input, quote display, bridge + swap flow)
- PR4: design polish (typography, motion, error states)
