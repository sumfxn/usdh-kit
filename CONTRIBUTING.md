# Contributing

## Setup

```sh
nvm use
corepack enable
pnpm install
```

Requires Node 20.18+ and pnpm 10+.

## Workflow

1. Branch off `main` as `type/short-description` (e.g. `feat/usdc-pair-resolver`).
2. Use Conventional Commits (`feat(sdk): add x`). Husky enforces this locally.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` before pushing.
4. Add a changeset (`pnpm changeset`) if your PR touches a published package.
5. Open a PR. CI must be green. PRs are squash-merged.

## Commit format

```
<type>(<scope>): <subject>
```

* `type`: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `revert`.
* `scope` (required): `sdk`, `widget`, `cli`, `docs`, `examples`, `ci`, `repo`, `deps`, `release`.
* `subject`: imperative, lowercase, no trailing period, 72 chars max.
* AI co-author footers are blocked.

## Style

Biome enforces formatting and lint rules. Run `pnpm lint:fix`.
