import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const BSC_RPC = "https://bsc-dataseed1.binance.org";
const BSC_NETWORK = { chainId: 56, name: "bnb" };

// Minimal ABI to verify it's our contract
const VERIFY_ABI = [
  "function owner() external view returns (address)",
  "function gasRefundUsdt() external view returns (uint256)",
];

export default function ContractStatus({ contractAddress }) {
  const [status, setStatus] = useState("idle"); // idle | checking | verified | invalid | error
  const [owner, setOwner] = useState(null);
  const [gasRefund, setGasRefund] = useState(null);
  const [error, setError] = useState(null);

  const checkContract = async () => {
    if (!ethers.isAddress(contractAddress)) {
      setStatus("idle");
      return;
    }

    setStatus("checking");
    setError(null);

    try {
      const provider = new ethers.JsonRpcProvider(BSC_RPC, BSC_NETWORK, { staticNetwork: true });

      // Check bytecode exists on chain
      const code = await provider.getCode(contractAddress);
      if (!code || code === "0x") {
        setStatus("invalid");
        setError("No contract found at this address on BSC Mainnet.");
        return;
      }

      // Try to call owner() to confirm it's our arb contract
      const contract = new ethers.Contract(contractAddress, VERIFY_ABI, provider);
      const ownerAddr = await contract.owner();
      const refund = await contract.gasRefundUsdt();

      setOwner(ownerAddr);
      setGasRefund(ethers.formatUnits(refund, 18));
      setStatus("verified");
    } catch (err) {
      setStatus("error");
      setError(err.message?.slice(0, 100) || "Verification failed");
    }
  };

  useEffect(() => {
    checkContract();
  }, [contractAddress]);

  if (!contractAddress) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-xs text-gray-500">
        <p className="font-semibold text-gray-400 mb-1">Arb Contract</p>
        <p>No contract address configured. Deploy via Remix and paste the address in Settings.</p>
      </div>
    );
  }

  const short = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">Arb Contract</span>
        <button onClick={checkContract} className="text-gray-600 hover:text-gray-400 transition-colors">
          <RefreshCw className={`w-3 h-3 ${status === "checking" ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Address */}
      <a
        href={`https://bscscan.com/address/${contractAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-400 hover:underline text-xs font-mono"
      >
        {short}
        <ExternalLink className="w-3 h-3" />
      </a>

      {/* Status badge */}
      {status === "checking" && (
        <div className="flex items-center gap-1.5 text-xs text-yellow-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Verifying on BSC...
        </div>
      )}

      {status === "verified" && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified on BSC Mainnet
          </div>
          {owner && (
            <div className="text-xs text-gray-500">
              Owner: <span className="text-gray-300 font-mono">{owner.slice(0, 8)}...{owner.slice(-4)}</span>
            </div>
          )}
          {gasRefund && (
            <div className="text-xs text-gray-500">
              Gas refund: <span className="text-gray-300">{parseFloat(gasRefund).toFixed(2)} USDT/trade</span>
            </div>
          )}
        </div>
      )}

      {(status === "invalid" || status === "error") && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
            <XCircle className="w-3.5 h-3.5" />
            {status === "invalid" ? "Not deployed" : "Verification failed"}
          </div>
          {error && <p className="text-xs text-gray-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
