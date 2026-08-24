import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExecutionModal({ open, onClose, result, loading }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {loading ? "Executing Trade..." : result?.success ? "Trade Successful" : "Trade Failed"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-gray-400 text-sm">Submitting transactions to BSC...</p>
              <p className="text-gray-600 text-xs">Do not close this window</p>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={result.success ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                  {result.success ? "Arbitrage completed!" : "Execution failed"}
                </span>
              </div>

              {result.txHash && (
                <a
                  href={`https://bscscan.com/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline text-sm"
                >
                  View on BscScan <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {result.leg1TxHash && (
                <div className="space-y-1">
                  <a
                    href={`https://bscscan.com/tx/${result.leg1TxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:underline text-sm"
                  >
                    Leg 1 Tx <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://bscscan.com/tx/${result.leg2TxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:underline text-sm"
                  >
                    Leg 2 Tx <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {result.error && (
                <div className="bg-red-900/30 rounded-lg p-3">
                  <p className="text-red-400 text-xs font-mono break-all">{result.error}</p>
                </div>
              )}

              {result.logs && result.logs.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {result.logs.map((log, i) => (
                    <p key={i} className="text-xs text-gray-400 font-mono">{log}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={onClose}
            disabled={loading}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
