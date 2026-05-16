//! # Voting Contract
//!
//! A decentralized voting system built on Stellar using Soroban smart contracts.
//!
//! ## Architecture
//! - Admin initializes the contract once and manages elections.
//! - Voters are registered per election by the admin (single or batch).
//! - Each registered voter may cast exactly one vote per election.
//! - Voting is only allowed within the election's `[start_time, end_time]` window.
//! - Results are publicly readable at any time.
//!
//! ## Storage layout
//! - Instance:   `Admin`                               → Address
//! - Instance:   `ElectionCount`                       → u32
//! - Persistent: `Election(id)`                        → Election
//! - Persistent: `Candidates(id)`                      → Vec<Candidate>
//! - Persistent: `HasVoted(election_id, voter)`        → bool
//! - Persistent: `RegisteredVoter(election_id, voter)` → bool

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String, Vec,
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ElectionNotFound = 3,
    ElectionNotActive = 4,
    VotingNotOpen = 5,
    VoterNotRegistered = 6,
    AlreadyVoted = 7,
    InvalidCandidate = 8,
    InvalidTimeRange = 9,
    TooFewCandidates = 10,
    EmptyTitle = 11,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Admin,
    ElectionCount,
    Election(u32),
    Candidates(u32),
    HasVoted(u32, Address),
    RegisteredVoter(u32, Address),
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct Election {
    pub id: u32,
    pub title: String,
    pub start_time: u64,
    pub end_time: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Candidate {
    pub id: u32,
    pub name: String,
    pub vote_count: u32,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ElectionCreated {
    pub election_id: u32,
    pub title: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteCast {
    pub election_id: u32,
    pub voter: Address,
    pub candidate_id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ElectionClosed {
    pub election_id: u32,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct VotingContract;

#[contractimpl]
impl VotingContract {
    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Initialize the contract. Can only be called once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ElectionCount, &0u32);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Elections
    // -----------------------------------------------------------------------

    /// Create a new election. Returns the new election id.
    pub fn create_election(
        env: Env,
        title: String,
        start_time: u64,
        end_time: u64,
        candidate_names: Vec<String>,
    ) -> Result<u32, Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        if title.is_empty() {
            return Err(Error::EmptyTitle);
        }
        if end_time <= start_time {
            return Err(Error::InvalidTimeRange);
        }
        if candidate_names.len() < 2 {
            return Err(Error::TooFewCandidates);
        }

        let mut count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ElectionCount)
            .unwrap_or(0);
        let election_id = count;
        count += 1;

        let election = Election {
            id: election_id,
            title: title.clone(),
            start_time,
            end_time,
            is_active: true,
        };

        let mut candidates: Vec<Candidate> = Vec::new(&env);
        for (cid, name) in candidate_names.iter().enumerate() {
            candidates.push_back(Candidate {
                id: cid as u32,
                name,
                vote_count: 0,
            });
        }

        env.storage()
            .persistent()
            .set(&DataKey::Election(election_id), &election);
        env.storage()
            .persistent()
            .set(&DataKey::Candidates(election_id), &candidates);
        env.storage()
            .instance()
            .set(&DataKey::ElectionCount, &count);

        ElectionCreated { election_id, title }.publish(&env);

        Ok(election_id)
    }

    /// Close an election early. Admin only.
    pub fn close_election(env: Env, election_id: u32) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        let mut election: Election = env
            .storage()
            .persistent()
            .get(&DataKey::Election(election_id))
            .ok_or(Error::ElectionNotFound)?;

        election.is_active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Election(election_id), &election);

        ElectionClosed { election_id }.publish(&env);
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Voter registration
    // -----------------------------------------------------------------------

    /// Register a single voter for an election. Admin only.
    pub fn register_voter(env: Env, election_id: u32, voter: Address) -> Result<(), Error> {
        Self::_require_admin(&env)?;
        env.storage()
            .persistent()
            .set(&DataKey::RegisteredVoter(election_id, voter), &true);
        Ok(())
    }

    /// Register multiple voters for an election in one transaction. Admin only.
    pub fn register_voters(env: Env, election_id: u32, voters: Vec<Address>) -> Result<(), Error> {
        Self::_require_admin(&env)?;
        for voter in voters.iter() {
            env.storage()
                .persistent()
                .set(&DataKey::RegisteredVoter(election_id, voter), &true);
        }
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Voting
    // -----------------------------------------------------------------------

    /// Cast a vote. The voter must sign this transaction.
    pub fn cast_vote(
        env: Env,
        voter: Address,
        election_id: u32,
        candidate_id: u32,
    ) -> Result<(), Error> {
        voter.require_auth();

        let election: Election = env
            .storage()
            .persistent()
            .get(&DataKey::Election(election_id))
            .ok_or(Error::ElectionNotFound)?;

        if !election.is_active {
            return Err(Error::ElectionNotActive);
        }

        let now = env.ledger().timestamp();
        if now < election.start_time || now > election.end_time {
            return Err(Error::VotingNotOpen);
        }

        let is_registered: bool = env
            .storage()
            .persistent()
            .get(&DataKey::RegisteredVoter(election_id, voter.clone()))
            .unwrap_or(false);
        if !is_registered {
            return Err(Error::VoterNotRegistered);
        }

        let has_voted: bool = env
            .storage()
            .persistent()
            .get(&DataKey::HasVoted(election_id, voter.clone()))
            .unwrap_or(false);
        if has_voted {
            return Err(Error::AlreadyVoted);
        }

        let mut candidates: Vec<Candidate> = env
            .storage()
            .persistent()
            .get(&DataKey::Candidates(election_id))
            .ok_or(Error::ElectionNotFound)?;

        if candidate_id >= candidates.len() {
            return Err(Error::InvalidCandidate);
        }

        let mut candidate = candidates.get(candidate_id).unwrap();
        candidate.vote_count += 1;
        candidates.set(candidate_id, candidate);

        env.storage()
            .persistent()
            .set(&DataKey::Candidates(election_id), &candidates);
        env.storage()
            .persistent()
            .set(&DataKey::HasVoted(election_id, voter.clone()), &true);

        VoteCast {
            election_id,
            voter,
            candidate_id,
        }
        .publish(&env);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    pub fn get_election(env: Env, election_id: u32) -> Result<Election, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Election(election_id))
            .ok_or(Error::ElectionNotFound)
    }

    pub fn get_candidates(env: Env, election_id: u32) -> Result<Vec<Candidate>, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Candidates(election_id))
            .ok_or(Error::ElectionNotFound)
    }

    pub fn has_voted(env: Env, election_id: u32, voter: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::HasVoted(election_id, voter))
            .unwrap_or(false)
    }

    pub fn is_registered(env: Env, election_id: u32, voter: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::RegisteredVoter(election_id, voter))
            .unwrap_or(false)
    }

    pub fn election_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ElectionCount)
            .unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn _require_admin(env: &Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger as _, Register},
        vec, Env, String,
    };

    const START: u64 = 1_000;
    const END: u64 = 9_000;

    fn setup() -> (Env, Address, VotingContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.timestamp = START);
        let contract_id = VotingContract.register(&env, None, ());
        let client = VotingContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    fn make_election(env: &Env, client: &VotingContractClient) -> u32 {
        let candidates = vec![
            env,
            String::from_str(env, "Alice"),
            String::from_str(env, "Bob"),
        ];
        client.create_election(
            &String::from_str(env, "Test Election"),
            &START,
            &END,
            &candidates,
        )
    }

    #[test]
    #[should_panic]
    fn test_double_init_rejected() {
        let (_, admin, client) = setup();
        client.initialize(&admin); // should panic — AlreadyInitialized
    }

    #[test]
    fn test_create_and_vote() {
        let (env, _, client) = setup();
        let eid = make_election(&env, &client);
        let voter = Address::generate(&env);
        client.register_voter(&eid, &voter);
        client.cast_vote(&voter, &eid, &0u32);
        let results = client.get_candidates(&eid);
        assert_eq!(results.get(0).unwrap().vote_count, 1);
        assert_eq!(results.get(1).unwrap().vote_count, 0);
    }

    #[test]
    #[should_panic]
    fn test_double_vote_rejected() {
        let (env, _, client) = setup();
        let eid = make_election(&env, &client);
        let voter = Address::generate(&env);
        client.register_voter(&eid, &voter);
        client.cast_vote(&voter, &eid, &0u32);
        client.cast_vote(&voter, &eid, &1u32); // should panic — AlreadyVoted
    }

    #[test]
    #[should_panic]
    fn test_unregistered_voter_rejected() {
        let (env, _, client) = setup();
        let eid = make_election(&env, &client);
        let voter = Address::generate(&env);
        client.cast_vote(&voter, &eid, &0u32); // should panic — VoterNotRegistered
    }

    #[test]
    #[should_panic]
    fn test_vote_before_start_rejected() {
        let (env, _, client) = setup();
        env.ledger().with_mut(|l| l.timestamp = START - 1);
        let eid = make_election(&env, &client);
        let voter = Address::generate(&env);
        client.register_voter(&eid, &voter);
        client.cast_vote(&voter, &eid, &0u32); // should panic — VotingNotOpen
    }

    #[test]
    #[should_panic]
    fn test_vote_after_end_rejected() {
        let (env, _, client) = setup();
        let eid = make_election(&env, &client);
        let voter = Address::generate(&env);
        client.register_voter(&eid, &voter);
        env.ledger().with_mut(|l| l.timestamp = END + 1);
        client.cast_vote(&voter, &eid, &0u32); // should panic — VotingNotOpen
    }

    #[test]
    #[should_panic]
    fn test_vote_on_closed_election_rejected() {
        let (env, _, client) = setup();
        let eid = make_election(&env, &client);
        let voter = Address::generate(&env);
        client.register_voter(&eid, &voter);
        client.close_election(&eid);
        client.cast_vote(&voter, &eid, &0u32); // should panic — ElectionNotActive
    }

    #[test]
    #[should_panic]
    fn test_invalid_candidate_rejected() {
        let (env, _, client) = setup();
        let eid = make_election(&env, &client);
        let voter = Address::generate(&env);
        client.register_voter(&eid, &voter);
        client.cast_vote(&voter, &eid, &99u32); // should panic — InvalidCandidate
    }

    #[test]
    fn test_batch_registration() {
        let (env, _, client) = setup();
        let eid = make_election(&env, &client);
        let v1 = Address::generate(&env);
        let v2 = Address::generate(&env);
        let voters = vec![&env, v1.clone(), v2.clone()];
        client.register_voters(&eid, &voters);
        assert!(client.is_registered(&eid, &v1));
        assert!(client.is_registered(&eid, &v2));
    }

    #[test]
    #[should_panic]
    fn test_invalid_time_range_rejected() {
        let (env, _, client) = setup();
        let candidates = vec![
            &env,
            String::from_str(&env, "Alice"),
            String::from_str(&env, "Bob"),
        ];
        // end < start — should panic
        client.create_election(&String::from_str(&env, "Bad"), &END, &START, &candidates);
    }

    #[test]
    #[should_panic]
    fn test_too_few_candidates_rejected() {
        let (env, _, client) = setup();
        let candidates = vec![&env, String::from_str(&env, "Alice")];
        // only 1 candidate — should panic
        client.create_election(&String::from_str(&env, "Bad"), &START, &END, &candidates);
    }
}
