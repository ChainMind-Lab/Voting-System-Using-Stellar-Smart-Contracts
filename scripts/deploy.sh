#!/usr/bin/env bash
# scripts/deploy.sh — Build and deploy the voting contract to Stellar Testnet.
#
# Prerequisites:
#   - Rust + cargo installed
#   - stellar CLI installed (https://developers.stellar.org/docs/tools/cli)
#   - A funded Testnet account (run: stellar keys generate --global deployer --network testnet)
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# TODO for contributors:
#   - Add a --network flag to support mainnet deployment.
#   - Store the deployed contract ID in a .env file for the frontend.

set -euo pipefail

NETWORK="testnet"
IDENTITY="deployer"
CONTRACT_DIR="contracts/voting"
WASM_PATH="target/wasm32-unknown-unknown/release/voting.wasm"

echo "==> Building contract..."
stellar contract build

echo "==> Optimizing WASM..."
stellar contract optimize --wasm "$WASM_PATH"

OPTIMIZED_WASM="${WASM_PATH%.wasm}.optimized.wasm"

echo "==> Deploying to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$OPTIMIZED_WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK")

echo "==> Contract deployed: $CONTRACT_ID"

echo "==> Initializing contract..."
ADMIN_ADDRESS=$(stellar keys address "$IDENTITY")
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$ADMIN_ADDRESS"

echo "==> Done. Update CONTRACT_ID in frontend/src/lib/contract.ts:"
echo "    $CONTRACT_ID"
