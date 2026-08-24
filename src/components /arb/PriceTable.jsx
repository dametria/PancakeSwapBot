import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Zap, RefreshCw, AlertTriangle } from "lucide-react";

export default function PriceTable({ opportunities, onExecute, isScanning, executingPair }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-white">Live Arbitrage Opportunities</span>
          {isScanning && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin" /> scanning
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">BSC · PancakeSwap V2 vs V3</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Pair</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">V2 Price</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">V3 Price</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Spread</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Est. Profit</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Direction</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  {isScanning ? "Scanning on-chain prices..." : "No opportunities loaded"}
                </td>
              </tr>
            )}
            {opportunities.map((opp) => {
              const profit = opp.profitUsd;
              const isProfitable = profit > 0;
              const isExecuting = executingPair === opp.pair;
              const spread = Math.abs(opp.spreadPct);

              return (
                <tr key={opp.pair} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-semibold text-white">{opp.pair}</span>
                  </td>

                  <td className="px-4 py-4 text-right text-gray-300 font-mono text-xs">
                    {opp.v2Price ? opp.v2Price.price.toFixed(6) : "—"}
                  </td>

                  <td className="px-4 py-4 text-right text-gray-300 font-mono text-xs">
                    {opp.v3Price ? opp.v3Price.price.toFixed(6) : "—"}
                  </td>

                  <td className="px-4 py-4 text-right">
                    <span className={`font-mono text-xs ${spread > 0.3 ? "text-green-400" : "text-gray-400"}`}>
                      {spread.toFixed(4)}%
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <span className={`font-semibold ${isProfitable ? "text-green-400" : "text-red-400"}`}>
                      {isProfitable ? "+" : ""}${profit.toFixed(2)}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        opp.v2First
                          ? "border-blue-500/50 text-blue-400"
                          : "border-purple-500/50 text-purple-400"
                      }`}
                    >
                      {opp.v2First ? "V2→V3" : "V3→V2"}
                    </Badge>
                  </td>

                  <td className="px-5 py-4 text-right">
                    {isProfitable ? (
                      <Button
                        size="sm"
                        disabled={isExecuting || !!executingPair}
                        onClick={() => onExecute(opp)}
                        className="bg-green-600 hover:bg-green-500 text-white text-xs h-7 px-3"
                      >
                        {isExecuting ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <><Zap className="w-3 h-3 mr-1" />Execute</>
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-600 flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3 h-3" /> unprofitable
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
