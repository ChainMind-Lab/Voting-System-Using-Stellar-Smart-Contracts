/**
 * VoterPanel — Cast votes and view results.
 *
 * All reads and writes go through useContract.
 */

import { useState } from "react";
import { useContract, type Candidate, type Election } from "../hooks/useContract";

interface Props {
  publicKey: string;
}

export default function VoterPanel({ publicKey }: Props) {
  const contract = useContract(publicKey);

  const [electionId, setElectionId] = useState(0);
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const [el, cands, voted] = await Promise.all([
        contract.getElection(electionId),
        contract.getCandidates(electionId),
        contract.hasVoted(electionId, publicKey),
      ]);
      setElection(el);
      setCandidates(cands);
      setAlreadyVoted(voted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    setLoading(true);
    setError(null);
    try {
      await contract.castVote(electionId, selected);
      setAlreadyVoted(true);
      setStatus("Your vote has been recorded on-chain. ✅");
      // Refresh results
      const cands = await contract.getCandidates(electionId);
      setCandidates(cands);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const isOpen =
    election?.is_active &&
    election.start_time <= now &&
    now <= election.end_time;

  return (
    <section>
      <h2>Vote</h2>

      <div>
        <input
          type="number"
          placeholder="Election ID"
          value={electionId}
          min={0}
          onChange={(e) => setElectionId(Number(e.target.value))}
        />
        <button onClick={handleLoad} disabled={loading}>
          Load
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {status && <p style={{ color: "green" }}>{status}</p>}

      {election && (
        <div>
          <h3>{election.title}</h3>
          <p>
            Status:{" "}
            {!election.is_active
              ? "Closed"
              : isOpen
              ? "Open"
              : now < election.start_time
              ? "Not started"
              : "Ended"}
          </p>
        </div>
      )}

      {candidates.length > 0 && isOpen && !alreadyVoted && (
        <form onSubmit={handleVote}>
          <h3>Cast your vote</h3>
          {candidates.map((c) => (
            <label key={c.id} style={{ display: "block" }}>
              <input
                type="radio"
                name="candidate"
                value={c.id}
                onChange={() => setSelected(c.id)}
              />
              {c.name}
            </label>
          ))}
          <button type="submit" disabled={selected === null || loading}>
            Submit Vote
          </button>
        </form>
      )}

      {alreadyVoted && <p>You have already voted in this election.</p>}

      {candidates.length > 0 && (
        <div>
          <h3>Results</h3>
          {candidates.map((c) => (
            <p key={c.id}>
              {c.name}: {c.vote_count}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
