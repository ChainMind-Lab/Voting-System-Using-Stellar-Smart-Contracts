import { useEffect, useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { useContract } from "./hooks/useContract";
import AdminPanel from "./components/AdminPanel";
import VoterPanel from "./components/VoterPanel";

export default function App() {
  const { publicKey, isConnecting, error, connect, disconnect } = useWallet();
  const contract = useContract(publicKey);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setIsAdmin(false);
      return;
    }
    contract
      .getAdmin()
      .then((admin) => setIsAdmin(admin === publicKey))
      .catch(() => setIsAdmin(false));
  }, [publicKey]);

  if (!publicKey) {
    return (
      <main>
        <h1>Stellar Voting System</h1>
        <p>Connect your Freighter wallet to continue.</p>
        <button onClick={connect} disabled={isConnecting}>
          {isConnecting ? "Connecting…" : "Connect Wallet"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>Stellar Voting System</h1>
        <span>
          {publicKey.slice(0, 8)}… {isAdmin && <strong>(Admin)</strong>}
        </span>
        <button onClick={disconnect}>Disconnect</button>
      </header>

      {isAdmin && <AdminPanel publicKey={publicKey} />}
      <VoterPanel publicKey={publicKey} />
    </main>
  );
}
