/**
 * AdminPanel — Election management UI.
 *
 * All actions call the contract via useContract hook.
 */

import { useState } from "react";
import { useContract } from "../hooks/useContract";

interface Props {
  publicKey: string;
}

export default function AdminPanel({ publicKey }: Props) {
  const contract = useContract(publicKey);

  // Create election form
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Register voter form
  const [regElectionId, setRegElectionId] = useState(0);
  const [voterAddresses, setVoterAddresses] = useState("");

  // Close election
  const [closeElectionId, setCloseElectionId] = useState(0);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(label: string, fn: () => Promise<void>) {
    setLoading(true);
    setStatus(null);
    setError(null);
    try {
      await fn();
      setStatus(`${label} succeeded.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateElection(e: React.FormEvent) {
    e.preventDefault();
    const names = candidates
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const end = Math.floor(new Date(endTime).getTime() / 1000);
    await run("Create election", () =>
      contract.createElection(title, start, end, names)
    );
  }

  async function handleRegisterVoters(e: React.FormEvent) {
    e.preventDefault();
    const addrs = voterAddresses
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (addrs.length === 1) {
      await run("Register voter", () =>
        contract.registerVoter(regElectionId, addrs[0])
      );
    } else {
      await run("Register voters", () =>
        contract.registerVoters(regElectionId, addrs)
      );
    }
  }

  async function handleCloseElection(e: React.FormEvent) {
    e.preventDefault();
    await run("Close election", () => contract.closeElection(closeElectionId));
  }

  return (
    <section>
      <h2>Admin Panel</h2>
      <small>{publicKey.slice(0, 8)}…</small>

      {status && <p style={{ color: "green" }}>{status}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleCreateElection}>
        <h3>Create Election</h3>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          placeholder="Candidates (comma-separated)"
          value={candidates}
          onChange={(e) => setCandidates(e.target.value)}
          required
        />
        <label>
          Start
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label>
          End
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          Create
        </button>
      </form>

      <form onSubmit={handleRegisterVoters}>
        <h3>Register Voter(s)</h3>
        <input
          type="number"
          placeholder="Election ID"
          value={regElectionId}
          onChange={(e) => setRegElectionId(Number(e.target.value))}
          required
        />
        <textarea
          placeholder="Voter address(es) — one per line or comma-separated"
          value={voterAddresses}
          onChange={(e) => setVoterAddresses(e.target.value)}
          rows={3}
          required
        />
        <button type="submit" disabled={loading}>
          Register
        </button>
      </form>

      <form onSubmit={handleCloseElection}>
        <h3>Close Election</h3>
        <input
          type="number"
          placeholder="Election ID"
          value={closeElectionId}
          onChange={(e) => setCloseElectionId(Number(e.target.value))}
          required
        />
        <button type="submit" disabled={loading}>
          Close
        </button>
      </form>
    </section>
  );
}
