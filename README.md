# Voting System Using Stellar Smart Contracts

A decentralized voting system built on Stellar using Soroban smart contracts. Secure, transparent, tamper-proof elections — no central authority required.

## How it works

1. An **admin** deploys the contract and creates elections with a list of candidates and a voting window.
2. The admin registers eligible voter addresses for each election.
3. **Voters** connect their Freighter wallet and cast one vote per election.
4. Votes are recorded on-chain. Results are publicly readable at any time.

All authorization is handled by Stellar account signatures — no passwords, no JWT tokens.

## Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Rust + Soroban SDK (compiled to WASM) |
| Frontend | React + TypeScript + Vite |
| Wallet | Freighter browser extension |
| Network | Stellar Testnet / Mainnet |

## Quick start

```bash
# Run contract tests
cargo test

# Build the contract
stellar contract build

# Deploy to Testnet (requires stellar CLI + funded account)
./scripts/deploy.sh

# Start the frontend
cd frontend && npm install && npm run dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full setup guide and open tasks.

## Project structure

```
contracts/voting/   — Soroban smart contract
frontend/           — React dApp
scripts/            — Deploy and invoke helpers
```

## License

MIT
