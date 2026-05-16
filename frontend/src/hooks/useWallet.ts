/**
 * useWallet — Freighter wallet integration hook.
 *
 * Provides connect/disconnect and the current public key.
 *
 * TODO for contributors:
 * - Handle network mismatch (ensure user is on Testnet/Mainnet).
 * - Persist connection state across page reloads.
 * - Add error boundary for when Freighter is not installed.
 */

import { useState, useCallback } from "react";
import {
  isConnected,
  getPublicKey,
  requestAccess,
} from "@stellar/freighter-api";

interface WalletState {
  publicKey: string | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    publicKey: null,
    isConnecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const connected = await isConnected();
      if (!connected) {
        throw new Error("Freighter wallet not found. Please install it.");
      }
      await requestAccess();
      const key = await getPublicKey();
      setState({ publicKey: key, isConnecting: false, error: null });
    } catch (err) {
      setState({
        publicKey: null,
        isConnecting: false,
        error: (err as Error).message,
      });
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ publicKey: null, isConnecting: false, error: null });
  }, []);

  return { ...state, connect, disconnect };
}
