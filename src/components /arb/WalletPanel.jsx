import React from "react";
import { Wallet, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WalletPanel({ balances, onRefresh, loading }) {
  if (!balances) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-center">
        <span className="text-gray-500 text-sm">Configure bot wallet in settings</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Bot Wallet</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="text-gray-400 hover:text-white h-7 w-7 p-0"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <a
        href={`https://bscscan.com/address/${balances.address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-blue-400 hover:underline font-mono mb-4"
      >
        {balances.address?.slice(0, 10)}...{balances.address?.slice(-8)}
        <ExternalLink className="w-3 h-3" />
      </a>

      <div className="space-y-2">
        <div className="flex justify-between items-center py-2 border-b border-gray-800">
          <span className="text-xs text-gray-400">BNB</span>
          <span className="text-sm font-semibold text-white">{balances.bnb?.toFixed(4)}</span>
        </div>
        {balances.tokens?.map(t => (
          <div key={t.symbol} className="flex justify-between items-center py-1">
            <span className="text-xs text-gray-400">{t.symbol}</span>
            <span className="text-sm font-mono text-white">{t.balance?.toFixed(4)}</span>
          </div>
        ))}
        {(!balances.tokens || balances.tokens.length === 0) && (
          <p className="text-xs text-gray-600 text-center py-2">No token balances</p>
        )}
      </div>
    </div>
  );
}
