/**
 * useContract — Centralizes all voting contract interactions.
 *
 * Uses @stellar/stellar-sdk v13+ API:
 * - `rpc` namespace (replaces deprecated `SorobanRpc`)
 * - `rpc.Server.pollTransaction` for confirmation (replaces manual polling)
 */

import { useCallback } from "react";
import { signTransaction } from "@stellar/freighter-api";
import {
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? "";

const server = new rpc.Server(RPC_URL);

export interface Election {
  id: number;
  title: string;
  start_time: number;
  end_time: number;
  is_active: boolean;
}

export interface Candidate {
  id: number;
  name: string;
  vote_count: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function invoke(
  publicKey: string,
  method: string,
  args: xdr.ScVal[]
): Promise<void> {
  const account = await server.getAccount(publicKey);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();
  const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (sent.status === "ERROR") {
    throw new Error(JSON.stringify(sent.errorResult));
  }

  // Poll until confirmed (30 attempts × 1.5 s ≈ 45 s timeout)
  const result = await server.pollTransaction(sent.hash, {
    attempts: 30,
    sleepTime: 1500,
  });

  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${result.status}`);
  }
}

async function query(method: string, args: xdr.ScVal[]): Promise<unknown> {
  const contract = new Contract(CONTRACT_ID);
  const dummyAccount = {
    accountId: () => "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    sequenceNumber: () => "0",
    incrementSequenceNumber: () => {},
  };

  const tx = new TransactionBuilder(dummyAccount as never, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  const success = sim as rpc.Api.SimulateTransactionSuccessResponse;
  return success.result ? scValToNative(success.result.retval) : null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContract(publicKey: string | null) {
  const createElection = useCallback(
    async (
      title: string,
      startTime: number,
      endTime: number,
      candidateNames: string[]
    ): Promise<void> => {
      if (!publicKey) throw new Error("Wallet not connected");
      await invoke(publicKey, "create_election", [
        nativeToScVal(title, { type: "string" }),
        nativeToScVal(startTime, { type: "u64" }),
        nativeToScVal(endTime, { type: "u64" }),
        nativeToScVal(candidateNames, { type: "vec" }),
      ]);
    },
    [publicKey]
  );

  const registerVoter = useCallback(
    async (electionId: number, voter: string): Promise<void> => {
      if (!publicKey) throw new Error("Wallet not connected");
      await invoke(publicKey, "register_voter", [
        nativeToScVal(electionId, { type: "u32" }),
        new Address(voter).toScVal(),
      ]);
    },
    [publicKey]
  );

  const registerVoters = useCallback(
    async (electionId: number, voters: string[]): Promise<void> => {
      if (!publicKey) throw new Error("Wallet not connected");
      await invoke(publicKey, "register_voters", [
        nativeToScVal(electionId, { type: "u32" }),
        nativeToScVal(
          voters.map((v) => new Address(v).toScVal()),
          { type: "vec" }
        ),
      ]);
    },
    [publicKey]
  );

  const closeElection = useCallback(
    async (electionId: number): Promise<void> => {
      if (!publicKey) throw new Error("Wallet not connected");
      await invoke(publicKey, "close_election", [
        nativeToScVal(electionId, { type: "u32" }),
      ]);
    },
    [publicKey]
  );

  const castVote = useCallback(
    async (electionId: number, candidateId: number): Promise<void> => {
      if (!publicKey) throw new Error("Wallet not connected");
      await invoke(publicKey, "cast_vote", [
        new Address(publicKey).toScVal(),
        nativeToScVal(electionId, { type: "u32" }),
        nativeToScVal(candidateId, { type: "u32" }),
      ]);
    },
    [publicKey]
  );

  const getElection = useCallback(async (electionId: number): Promise<Election> => {
    return (await query("get_election", [
      nativeToScVal(electionId, { type: "u32" }),
    ])) as Election;
  }, []);

  const getCandidates = useCallback(
    async (electionId: number): Promise<Candidate[]> => {
      return (await query("get_candidates", [
        nativeToScVal(electionId, { type: "u32" }),
      ])) as Candidate[];
    },
    []
  );

  const hasVoted = useCallback(
    async (electionId: number, voter: string): Promise<boolean> => {
      return (await query("has_voted", [
        nativeToScVal(electionId, { type: "u32" }),
        new Address(voter).toScVal(),
      ])) as boolean;
    },
    []
  );

  const isRegistered = useCallback(
    async (electionId: number, voter: string): Promise<boolean> => {
      return (await query("is_registered", [
        nativeToScVal(electionId, { type: "u32" }),
        new Address(voter).toScVal(),
      ])) as boolean;
    },
    []
  );

  const electionCount = useCallback(async (): Promise<number> => {
    return (await query("election_count", [])) as number;
  }, []);

  const getAdmin = useCallback(async (): Promise<string> => {
    return (await query("get_admin", [])) as string;
  }, []);

  return {
    createElection,
    registerVoter,
    registerVoters,
    closeElection,
    castVote,
    getElection,
    getCandidates,
    hasVoted,
    isRegistered,
    electionCount,
    getAdmin,
  };
}
