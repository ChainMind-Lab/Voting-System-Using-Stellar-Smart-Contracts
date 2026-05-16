#!/usr/bin/env bash
# scripts/invoke.sh — Helper to call contract functions from the CLI.
#
# Usage examples:
#   ./scripts/invoke.sh create_election "My Election" 1700000000 1799999999 "Alice,Bob,Carol"
#   ./scripts/invoke.sh register_voter 0 GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
#   ./scripts/invoke.sh cast_vote GVOTER... 0 1
#   ./scripts/invoke.sh get_candidates 0
#
# TODO for contributors:
#   - Load CONTRACT_ID from a .env file instead of hardcoding.

set -euo pipefail

NETWORK="testnet"
IDENTITY="deployer"
CONTRACT_ID="${CONTRACT_ID:-REPLACE_WITH_DEPLOYED_CONTRACT_ID}"

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  create_election)
    TITLE="$1"; START="$2"; END="$3"; NAMES="$4"
    # Build candidate list as JSON array for the CLI
    CANDIDATES=$(echo "$NAMES" | tr ',' '\n' | jq -R . | jq -sc .)
    stellar contract invoke \
      --id "$CONTRACT_ID" --source "$IDENTITY" --network "$NETWORK" \
      -- create_election \
      --title "$TITLE" \
      --start_time "$START" \
      --end_time "$END" \
      --candidate_names "$CANDIDATES"
    ;;
  register_voter)
    stellar contract invoke \
      --id "$CONTRACT_ID" --source "$IDENTITY" --network "$NETWORK" \
      -- register_voter \
      --election_id "$1" \
      --voter "$2"
    ;;
  cast_vote)
    stellar contract invoke \
      --id "$CONTRACT_ID" --source "$1" --network "$NETWORK" \
      -- cast_vote \
      --voter "$1" \
      --election_id "$2" \
      --candidate_id "$3"
    ;;
  get_candidates)
    stellar contract invoke \
      --id "$CONTRACT_ID" --source "$IDENTITY" --network "$NETWORK" \
      -- get_candidates \
      --election_id "$1"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Available: create_election, register_voter, cast_vote, get_candidates"
    exit 1
    ;;
esac
