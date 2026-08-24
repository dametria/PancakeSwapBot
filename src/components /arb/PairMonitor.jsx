import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Zap, RefreshCw } from 'lucide-react';
import { checkArbitrage } from '@/lib/priceEngine';
import { ARBI_PAIRS, TOKEN_SYMBOLS } from '@/lib/bsc';

const POLL_INTERVAL = 8000; // 8 seconds

export default function PairMonitor({ config, onOpportunity }) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  const enabledPairs = config?.enabledPairs?.length
    ? ARBI_PAIRS.filter(p => config.enabledPairs.includes(p.label))
    : ARBI_PAIRS;

  const amountIn = config?.tradeAmountBNB ?? 0.1;
  const minProfit = config?.minProfitPct ?? 0.3;

  async function fetchPrices() {
    setLoading(true);
    const results = await Promise.allSettled(
      enabledPairs.map(async (pair) => {
        const result = await checkArbitrage(pair.tokenA, pair.tokenB, amountIn);
        return { ...pair, ...result };
      })
    );

    const updated = {};
    results.forEach((r, i) => {
      const label = enabledPairs[i].label;
      if (r.status === 'fulfilled' && r.value) {
        updated[label] = r.value;
        // Emit opportunity if profitable
        if (r.value.profitPct >= minProfit && r.value.buyOn && r.value.sellOn) {
          onOpportunity && onOpportunity({
            ...enabledPairs[i],
            ...r.value,
            labelA: TOKEN_SYMBOLS[enabledPairs[i].tokenA] || 'TOKEN',
            labelB: TOKEN_SYMBOLS[enabledPairs[i].tokenB] || 'TOKEN',
          });
        }
      } else {
        updated[label] = null;
      }
    });

    setPrices(updated);
    setLastUpdate(new Date());
    setLoading(false);
  }

  useEffect(() => {
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [config]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          <span className="text-slate-400 text-xs">
            {loading ? 'Fetching prices...' : `Updated ${lastUpdate ? lastUpdate.toLocaleTimeString() : 'never'}`}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchPrices}
          disabled={loading}
          className="text-slate-400 hover:text-slate-200 h-7 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid gap-2">
        {enabledPairs.map((pair) => {
          const data = prices[pair.label];
          const profitable = data?.profitPct >= minProfit && data?.buyOn && data?.sellOn;

          return (
            <div
              key={pair.label}
              className={`rounded-lg border p-3 transition-all ${
                profitable
                  ? 'border-green-500/60 bg-green-900/20'
                  : 'border-slate-700 bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {profitable && <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />}
                  <span className="text-slate-200 text-sm font-medium">{pair.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {data?.profitPct > 0 && (
                    <Badge
                      className={`text-xs ${
                        profitable
                          ? 'bg-green-500/20 text-green-300 border-green-500/40'
                          : 'bg-slate-700 text-slate-400 border-slate-600'
                      }`}
                      variant="outline"
                    >
                      {data.profitPct.toFixed(3)}%
                    </Badge>
                  )}
                  {profitable && (
                    <Badge className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/40" variant="outline">
                      {data.buyOn} → {data.sellOn}
                    </Badge>
                  )}
                </div>
              </div>

              {data && (
                <div className="mt-2 flex gap-4 text-xs text-slate-400">
                  {data.v2Price && (
                    <span>V2: <span className="text-slate-200 font-mono">{data.v2Price.toFixed(6)}</span></span>
                  )}
                  {data.v3Price && (
                    <span>V3: <span className="text-slate-200 font-mono">{data.v3Price.toFixed(6)}</span></span>
                  )}
                  {data.feeTier && (
                    <span>Fee: <span className="text-slate-300">{data.feeTier / 10000}%</span></span>
                  )}
                </div>
              )}

              {!data && (
                <div className="mt-1 text-xs text-slate-600">No liquidity data</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
