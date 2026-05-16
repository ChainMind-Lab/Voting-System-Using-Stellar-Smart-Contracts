# Contributing

Thank you for your interest in contributing to the Stellar Voting System.

## Project structure

```
.
├── contracts/voting/       # Soroban smart contract (Rust)
│   ├── src/lib.rs          # Contract logic — start here
│   └── Cargo.toml
├── frontend/               # React + TypeScript dApp
│   └── src/
│       ├── App.tsx                      # Root component + admin detection
│       ├── components/
│       │   ├── AdminPanel.tsx           # Election management (admin only)
│       │   └── VoterPanel.tsx           # Vote + view results
│       └── hooks/
│           ├── useWallet.ts             # Freighter connect/disconnect
│           └── useContract.ts          # All contract calls
├── scripts/
│   ├── deploy.sh           # Build + deploy contract to Testnet
│   └── invoke.sh           # CLI shortcuts for contract calls
├── .github/workflows/ci.yml
└── ISSUES.md               # Open tasks for contributors
```

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | latest | https://developers.stellar.org/docs/tools/cli |
| Node.js | ≥ 18 | https://nodejs.org |

## Getting started

```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/Voting-System-Using-Stellar-Smart-Contracts.git
cd Voting-System-Using-Stellar-Smart-Contracts

# 2. Run contract tests
cargo test

# 3. Build the contract
stellar contract build

# 4. Deploy to Testnet
./scripts/deploy.sh
# Copy the printed CONTRACT_ID into frontend/.env

# 5. Set up frontend environment
cd frontend
cp .env.example .env
# Edit .env and paste your CONTRACT_ID

# 6. Install dependencies and start dev server
npm install && npm run dev
```

## CI

Every pull request runs:
- `cargo fmt --check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`
- `tsc --noEmit` (TypeScript type check)

Make sure all four pass before opening a PR.

## Open tasks

See [ISSUES.md](./ISSUES.md) for a full list of contributor tasks with context, files, and acceptance criteria. Each entry maps directly to a GitHub Issue.

## Workflow

1. Pick a task from [ISSUES.md](./ISSUES.md) or the GitHub Issues tab.
2. Create a branch: `git checkout -b feat/your-feature`.
3. Make your changes. Run `cargo test` for contract changes.
4. Open a pull request with a clear description of what changed and why.

## Code style

- Rust: `cargo fmt` and `cargo clippy --all-targets` must pass with no warnings.
- TypeScript: one responsibility per file, no `any` types.
- No new dependencies without discussion in an issue first.
