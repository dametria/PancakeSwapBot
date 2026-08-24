import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Play, X, ChevronDown, ChevronUp } from 'lucide-react';
import { executeArbitrage } from '@/lib/tradeExecutor';
import { getBotWallet } from '@/lib/botWallet';
import { base44 } from '@/api/base44Client';

export default function OpportunityQueue({ opportunities, onClear, onTradeResult }) {
  const [executing, setExecuting] = useState({});
  const [expanded, setExpanded] = useState(true);

  async function handleExecute(opp) {
    const wallet = getBotWallet();
    if (!wallet) {
      alert('Bot wallet not connected. Please enter your private key first.');
      return;
    }

    const key = `${opp.label}-${opp.buyOn}`;
    setExecuting(e => ({ ...e, [key]: true }));

    // Save pending log
    let logId = null;
    try {
      const log = await base44.entities.TradeLog.create({
        pair: opp.label,
        buyOn: opp.buyOn,
        sellOn: opp.sellOn,
        amountIn: opp.amountIn,
        profitPct: opp.profitPct,
        profitAbs: opp.profitAbs,
        v2Price: opp.v2Price,
        v3Price: opp.v3Price,
        feeTier: opp.feeTier,
        status: 'executing',
      });
      logId = log.id;
    } catch {}

    try {
      const result = await executeArbitrage(opp, wallet);

      if (logId) {
        await base44.entities.TradeLog.update(logId, {
          status: 'success',
          txHash1: result.hashes[0],
          txHash2: result.hashes[1],
        });
      }

      onTradeResult && onTradeResult({ ...opp, status: 'success', hashes: result.hashes });
    } catch (err) {
      if (logId) {
        await base44.entities.TradeLog.update(logId, {
          status: 'failed',
          errorMsg: err.message?.slice(0, 500),
        });
      }
      onTradeResult && onTradeResult({ ...opp, status: 'failed', error: err.message });
    } finally {
      setExecuting(e => ({ ...e, [key]: false }));
    }
  }

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
        No arbitrage opportunities detected yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-slate-300 text-sm font-medium"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {opportunities.length} opportunity{opportunities.length !== 1 ? 'ies' : 'y'}
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="text-slate-500 hover:text-red-400 h-7 px-2 text-xs"
        >
          <X className="w-3 h-3 mr-1" /> Clear
        </Button>
      </div>

      {expanded && opportunities.map((opp, i) => {
        const key = `${opp.label}-${opp.buyOn}`;
        const isExec = executing[key];
        return (
          <div key={i} className="rounded-lg border border-yellow-500/40 bg-yellow-900/10 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-slate-200 font-medium text-sm">{opp.label}</span>
                <Badge className="bg-green-500/20 text-green-300 border-green-500/40 text-xs" variant="outline">
                  +{opp.profitPct?.toFixed(3)}%
                </Badge>
              </div>
              <Button
                size="sm"
                onClick={() => handleExecute(opp)}
                disabled={isExec}
                className="bg-green-600 hover:bg-green-500 text-white h-7 px-3 text-xs"
              >
                {isExec ? (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Executing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1"><Play className="w-3 h-3" /> Execute</span>
                )}
              </Button>
            </div>
            <div className="mt-2 text-xs text-slate-400 flex gap-4">
              <span>Buy on <span className="text-blue-300">{opp.buyOn}</span></span>
              <span>Sell on <span className="text-purple-300">{opp.sellOn}</span></span>
              <span>Amount: <span className="text-slate-200">{opp.amountIn} {opp.labelA}</span></span>
              {opp.feeTier && <span>Fee tier: {opp.feeTier / 10000}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
