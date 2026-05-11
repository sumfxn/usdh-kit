# builder gallery

Public Next.js app for the `usdh-kit` builder gallery. The first screen is a
reference console for USDH/HIP-4 builders: SDK surfaces, read-only market data,
example paths, and the embeddable swap widget.

## Run locally

```sh
pnpm install
pnpm --filter @usdh-kit-apps/demo dev
```

Then open http://localhost:3000.

## Data policy

The gallery is safe by default:

- live data is read-only and server-side
- no `/exchange` calls are made for gallery data
- no wallet connection is required to render the page
- if Hyperliquid reads fail, the page falls back to sample data

The widget section remains interactive and uses the connected wallet only when a
user explicitly starts the widget flow.

## Validation

```sh
pnpm --filter @usdh-kit-apps/demo typecheck
pnpm --filter @usdh-kit-apps/demo build
```

The root `pnpm build` and `pnpm typecheck` commands also include this app so the
public gallery cannot drift outside CI.
