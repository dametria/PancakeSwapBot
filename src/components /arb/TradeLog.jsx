import React from "react";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TradeLog({ trades }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <span className="text-sm font-semibold text-white">Trade History</span>
      </div>
      <div className="overflow-y-auto max-h-72">
        {trades.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">No trades executed yet</div>
        )}
        {[...trades].reverse().map((trade, i) => (
          <div key={i} className="px-5 py-4 border-b border-gray-800/50 hover:bg-gray-800/20">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {trade.status === "success" ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : trade.status === "pending" ? (
                  <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-sm font-semibold text-white">{trade.pair}</span>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    trade.status === "success"
                      ? "border-green-500/50 text-green-400"
                      : trade.status === "pending"
                      ? "border-yellow-500/50 text-yellow-400"
                      : "border-red-500/50 text-red-400"
                  }`}
                >
                  {trade.status}
                </Badge>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
              <span>{trade.direction}</span>
              {trade.profitUsd !== undefined && (
                <span className={trade.profitUsd > 0 ? "text-green-400 font-semibold" : "text-red-400"}>
                  {trade.profitUsd > 0 ? "+" : ""}${trade.profitUsd?.toFixed(2)}
                </span>
              )}
            </div>

            {trade.txHash && (
              <a
                href={`https://bscscan.com/tx/${trade.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:underline mt-1"
              >
                {trade.txHash.slice(0, 18)}... <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {trade.error && (
              <p className="text-xs text-red-400 mt-1 font-mono">{trade.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
