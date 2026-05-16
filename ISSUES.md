# Contributor Issues

This file tracks open tasks for contributors. Each issue is self-contained with enough context to start immediately. Copy the title and description into a GitHub Issue when creating it.

Complexity levels map to point values:
- **Trivial** — Small, well-defined change. Good first issue.
- **Medium** — Requires understanding the codebase. Standard feature or fix.
- **High** — Significant feature or architectural change. Requires design judgment.

---

## Trivial

---

### [TRIVIAL-1] Add `.env.example` file for frontend configuration

**Context:**  
The frontend reads `VITE_CONTRACT_ID` from environment variables but there is no example file to guide contributors.

**Task:**  
Create `frontend/.env.example` with:
```
VITE_CONTRACT_ID=YOUR_DEPLOYED_CONTRACT_ID_HERE
```
Add a note in `CONTRIBUTING.md` telling contributors to copy it to `.env`.

**Files:** `frontend/.env.example`, `CONTRIBUTING.md`  
**Acceptance:** `.env.example` exists, `CONTRIBUTING.md` references it.

---

### [TRIVIAL-2] Add `is_registered` query to the frontend

**Context:**  
The contract exposes `is_registered(election_id, voter)` but the frontend never calls it. Voters currently have no way to check if they are eligible before trying to vote.

**Task:**  
In `VoterPanel.tsx`, after loading an election, call `contract.isRegistered(electionId, publicKey)` and display a clear message: "You are registered to vote" or "You are not registered for this election."

**Files:** `frontend/src/components/VoterPanel.tsx`, `frontend/src/hooks/useContract.ts`  
**Acceptance:** The registration status is shown when an election is loaded.

---

### [TRIVIAL-3] Show election time window in VoterPanel

**Context:**  
`Election` has `start_time` and `end_time` (Unix timestamps) but the UI only shows a text status. Contributors should display human-readable dates.

**Task:**  
Format `start_time` and `end_time` using `new Date(ts * 1000).toLocaleString()` and display them below the election title.

**Files:** `frontend/src/components/VoterPanel.tsx`  
**Acceptance:** Both dates are visible in the UI.

---

### [TRIVIAL-4] Add election count display to AdminPanel

**Context:**  
`useContract` exposes `electionCount()` but AdminPanel never calls it. Admins have no quick way to see how many elections exist.

**Task:**  
On mount in `AdminPanel`, call `contract.electionCount()` and display the result as "Total elections: N".

**Files:** `frontend/src/components/AdminPanel.tsx`  
**Acceptance:** Election count is fetched on mount and displayed.

---

### [TRIVIAL-5] Add `cargo clippy` and `cargo fmt` to CI

**Context:**  
There is no CI configuration. Contributors may submit code that fails linting.

**Task:**  
Create `.github/workflows/ci.yml` that runs on every pull request:
1. `cargo fmt --check`
2. `cargo clippy --all-targets -- -D warnings`
3. `cargo test`

**Files:** `.github/workflows/ci.yml`  
**Acceptance:** Workflow runs on PRs and fails if any step fails.

---

## Medium

---

### [MEDIUM-1] Add admin role detection to hide AdminPanel from non-admins

**Context:**  
`AdminPanel` is currently shown to all connected wallets. The contract stores the admin address in instance storage but the frontend never reads it.

**Task:**  
1. Add `getAdmin(): Promise<string>` to `useContract`.
2. In `App.tsx`, fetch the admin address after wallet connection.
3. Only render `<AdminPanel>` if `publicKey === adminAddress`.

**Files:** `frontend/src/hooks/useContract.ts`, `frontend/src/App.tsx`  
**Acceptance:** Non-admin wallets see only `VoterPanel`. Admin wallet sees both panels.

---

### [MEDIUM-2] Add client-side form validation to AdminPanel

**Context:**  
The contract enforces validation (empty title, `end_time > start_time`, min 2 candidates) but the frontend submits the transaction before checking. This wastes fees and gives a poor UX.

**Task:**  
Before calling `contract.createElection`, validate:
- Title is not empty.
- At least 2 comma-separated candidate names.
- End datetime is after start datetime.

Show inline error messages next to each field. Do not submit if validation fails.

**Files:** `frontend/src/components/AdminPanel.tsx`  
**Acceptance:** Invalid forms show field-level errors and do not submit.

---

### [MEDIUM-3] Add election list view to AdminPanel

**Context:**  
Admins must manually type an election ID. There is no way to browse existing elections.

**Task:**  
1. On mount, call `contract.electionCount()` to get the total.
2. Fetch all elections with `contract.getElection(id)` for `id` in `[0, count)`.
3. Render a table showing: ID, title, status (open/closed/upcoming), start/end times.
4. Clicking a row pre-fills the election ID in the Register and Close forms.

**Files:** `frontend/src/components/AdminPanel.tsx`, `frontend/src/hooks/useContract.ts`  
**Acceptance:** Elections table renders on mount and updates after create/close actions.

---

### [MEDIUM-4] Add transaction confirmation polling with timeout

**Context:**  
`useContract.ts` polls for transaction confirmation with a simple `while` loop but has no timeout. A stuck transaction will loop forever.

**Task:**  
Add a maximum of 30 polling attempts (45 seconds at 1.5s intervals). If the transaction is still `PENDING` after that, throw a `TransactionTimeoutError` with a helpful message.

**Files:** `frontend/src/hooks/useContract.ts`  
**Acceptance:** A transaction that never confirms throws after ~45 seconds with a clear error message.

---

### [MEDIUM-5] Add Freighter network mismatch detection

**Context:**  
If a user's Freighter wallet is set to Mainnet but the app targets Testnet, transactions will fail with a confusing error.

**Task:**  
Use `@stellar/freighter-api`'s `getNetworkDetails()` to check the active network on wallet connect. If it does not match `NETWORK_PASSPHRASE`, show a clear warning: "Please switch Freighter to Testnet" and disable all transaction buttons.

**Files:** `frontend/src/hooks/useWallet.ts`, `frontend/src/App.tsx`  
**Acceptance:** Network mismatch shows a warning and blocks transactions.

---

### [MEDIUM-6] Write integration test for the full vote lifecycle

**Context:**  
The contract has unit tests but no test covers the full flow: initialize → create election → register voter → cast vote → verify result → close election.

**Task:**  
Add a `#[test] fn test_full_lifecycle()` in `contracts/voting/src/lib.rs` that:
1. Initializes the contract.
2. Creates an election with 3 candidates.
3. Registers 3 voters.
4. Has each voter vote for a different candidate.
5. Asserts each candidate has exactly 1 vote.
6. Closes the election.
7. Asserts a subsequent vote attempt returns `Error::ElectionNotActive`.

**Files:** `contracts/voting/src/lib.rs`  
**Acceptance:** `cargo test test_full_lifecycle` passes.

---

## High

---

### [HIGH-1] Add React Router and dedicated pages for each election

**Context:**  
The app is a single page. As elections grow, the UX becomes unusable. A proper routing structure is needed.

**Task:**  
1. Install `react-router-dom`.
2. Create routes:
   - `/` — Election list (public, shows all elections and their status).
   - `/election/:id` — Election detail page (vote form + live results).
   - `/admin` — Admin panel (protected, admin wallet only).
3. Update `App.tsx` to use `<BrowserRouter>` and `<Routes>`.
4. The election list page should fetch all elections on mount.

**Files:** `frontend/src/App.tsx`, new page components under `frontend/src/pages/`  
**Acceptance:** All three routes work. Direct URL navigation works. Non-admin wallets are redirected from `/admin`.

---

### [HIGH-2] Add state archival TTL extension for persistent storage

**Context:**  
Soroban persistent storage entries expire after a ledger TTL. If an election's storage entry expires, votes are lost. The contract must extend TTLs on every read/write.

**Task:**  
In every function that reads or writes a persistent entry, call `env.storage().persistent().extend_ttl(key, threshold, extend_to)` with appropriate values (e.g., `threshold = 100_000`, `extend_to = 500_000` ledgers).

Reference: https://developers.stellar.org/docs/build/guides/archival

**Files:** `contracts/voting/src/lib.rs`  
**Acceptance:** All persistent storage reads/writes extend TTL. A new test verifies TTL is extended after `cast_vote`.

---

### [HIGH-3] Add on-chain event indexing with a lightweight backend

**Context:**  
The contract emits `EL_CREATE` and `VOTE_CAST` events but the frontend has no way to query historical events. A lightweight indexer would enable an activity feed and audit log.

**Task:**  
Create `indexer/` directory with a Node.js script that:
1. Polls the Soroban RPC `getEvents` endpoint for the contract's events.
2. Stores them in a local SQLite database (using `better-sqlite3`).
3. Exposes a simple HTTP API: `GET /events?election_id=0` returning the event list.

Provide a `README.md` in `indexer/` explaining how to run it.

**Files:** `indexer/` (new directory)  
**Acceptance:** Running the indexer against Testnet captures events. The API returns correct results.

---

### [HIGH-4] Add transfer of admin role

**Context:**  
The admin address is set at initialization and can never change. If the admin loses access to their key, the contract is permanently locked.

**Task:**  
1. Add `transfer_admin(env, new_admin: Address) -> Result<(), Error>` to the contract. Requires current admin auth.
2. Add `get_admin(env) -> Address` query.
3. Add a unit test: transfer admin, verify old admin can no longer create elections, verify new admin can.
4. Expose `transferAdmin` in `useContract.ts` and add a UI control in `AdminPanel`.

**Files:** `contracts/voting/src/lib.rs`, `frontend/src/hooks/useContract.ts`, `frontend/src/components/AdminPanel.tsx`  
**Acceptance:** Admin transfer works on-chain and in the UI. Old admin is rejected after transfer.

---

### [HIGH-5] Add candidate metadata (description + image URL)

**Context:**  
Candidates currently only have a name. Real elections need a short bio and optionally a photo.

**Task:**  
1. Extend the `Candidate` struct with `description: String` and `image_url: String` (both optional — use empty string as "not set").
2. Update `create_election` to accept `Vec<(String, String, String)>` (name, description, image_url) or a new `CandidateInput` struct.
3. Update `AdminPanel` form to include description and image URL fields per candidate (dynamic form rows).
4. Update `VoterPanel` to display description and image.

**Files:** `contracts/voting/src/lib.rs`, `frontend/src/components/AdminPanel.tsx`, `frontend/src/components/VoterPanel.tsx`, `frontend/src/hooks/useContract.ts`  
**Acceptance:** Candidates with description and image URL are stored and displayed. Existing tests still pass.
