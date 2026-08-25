import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, History, Settings, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import WalletSetup from '@/components/arb/WalletSetup';
import WalletBalances from '@/components/arb/WalletBalances';
import PairMonitor from '@/components/arb/PairMonitor';
import OpportunityQueue from '@/components/arb/OpportunityQueue';
import TradeHistory from '@/components/arb/TradeHistory';
import BotSettings from '@/components/arb/BotSettings';
import { isBotReady } from '@/lib/botWallet';
import { executeArbitrage } from '@/lib/tradeExecutor';
import { getBotWallet } from '@/lib/botWallet';
import { base44 } from '@/api/base44Client';

const MAX_QUEUE = 10;

export default function Dashboard() {
  const [walletReady, setWalletReady] = useState(false);
  const [config, setConfig] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [tradeResults, setTradeResults] = useState([]);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const autoExecRef = useRef(false);

  useEffect(() => {
    autoExecRef.current = config?.autoExecute ?? false;
  }, [config]);

  function handleOpportunity(opp) {
    setOpportunities(prev => {
      // Deduplicate by pair+direction
      const key = `${opp.label}-${opp.buyOn}-${opp.sellOn}`;
      const exists = prev.find(o => `${o.label}-${o.buyOn}-${o.sellOn}` === key);
      if (exists) {
        // Update with latest data
        return prev.map(o =>
          `${o.label}-${o.buyOn}-${o.sellOn}` === key ? opp : o
        );
      }
      return [opp, ...prev].slice(0, MAX_QUEUE);
    });

    // Auto execute if enabled
    if (autoExecRef.current && walletReady) {
      const wallet = getBotWallet();
      if (wallet) {
        autoExecuteTrade(opp, wallet);
      }
    }
  }

  async function autoExecuteTrade(opp, wallet) {
    let logId = null;
    try {
      const log = await base44.entities.TradeLog.create({
        pair: opp.label,
        buyOn: opp.buyOn,
        sellOn: opp.sellOn,
        amountIn: opp.amountIn,
        profitPct: opp.profitPct,
        status: 'executing',
      });
      logId = log.id;
      const result = await executeArbitrage(opp, wallet);
      await base44.entities.TradeLog.update(logId, {
        status: 'success',
        txHash1: result.hashes[0],
        txHash2: result.hashes[1],
      });
      setTotalProfit(p => p + (opp.profitAbs || 0));
      setBalanceRefresh(n => n + 1);
      setTradeResults(r => [{ ...opp, status: 'success', hashes: result.hashes }, ...r].slice(0, 20));
    } catch (err) {
      if (logId) {
        await base44.entities.TradeLog.update(logId, {
          status: 'failed',
          errorMsg: err.message?.slice(0, 500),
        });
      }
      setTradeResults(r => [{ ...opp, status: 'failed', error: err.message }, ...r].slice(0, 20));
    }
  }

  function handleTradeResult(result) {
    setTradeResults(r => [result, ...r].slice(0, 20));
    if (result.status === 'success') {
      setTotalProfit(p => p + (result.profitAbs || 0));
      setBalanceRefresh(n => n + 1);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">PancakeSwap Arbitrage Bot</h1>
              <p className="text-xs text-slate-500">BSC Mainnet · V2 ↔ V3 Cross-DEX</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {opportunities.length > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 animate-pulse" variant="outline">
                <Zap className="w-3 h-3 mr-1" />
                {opportunities.length} active
              </Badge>
            )}
            <Badge
              className={`text-xs ${walletReady ? 'bg-green-500/20 text-green-300 border-green-500/40' : 'bg-slate-700 text-slate-400 border-slate-600'}`}
              variant="outline"
            >
              {walletReady ? '● Wallet Ready' : '○ Wallet Not Connected'}
            </Badge>
            {config?.autoExecute && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs" variant="outline">
                Auto: ON
              </Badge>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pairs Monitored', value: config?.enabledPairs?.length ?? 8, icon: Activity, color: 'text-blue-400' },
            { label: 'Opportunities', value: opportunities.length, icon: Zap, color: 'text-yellow-400' },
            { label: 'Trades Executed', value: tradeResults.filter(t => t.status === 'success').length, icon: TrendingUp, color: 'text-green-400' },
            { label: 'Failed Trades', value: tradeResults.filter(t => t.status === 'failed').length, icon: AlertTriangle, color: 'text-red-400' },
          ].map(s => (
            <Card key={s.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className="text-slate-500 text-xs">{s.label}</p>
                  <p className="text-slate-100 font-bold text-lg leading-none">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left sidebar */}
          <div className="space-y-4">
            <WalletSetup onReady={() => setWalletReady(true)} />
            <Card className="border-slate-700 bg-slate-900">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-slate-100 text-sm">Wallet Balances</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <WalletBalances refreshTrigger={balanceRefresh} />
              </CardContent>
            </Card>
            <BotSettings onConfigChange={setConfig} />
          </div>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs defaultValue="monitor">
              <TabsList className="bg-slate-800 border border-slate-700 w-full">
                <TabsTrigger value="monitor" className="flex-1 data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-slate-100">
                  <Activity className="w-3 h-3 mr-1" /> Live Monitor
                </TabsTrigger>
                <TabsTrigger value="queue" className="flex-1 data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-slate-100">
                  <Zap className="w-3 h-3 mr-1" />
                  Queue {opportunities.length > 0 && `(${opportunities.length})`}
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-slate-100">
                  <History className="w-3 h-3 mr-1" /> History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="monitor">
                <Card className="border-slate-700 bg-slate-900">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      Real-Time Price Monitoring
                      <span className="text-xs text-slate-500 font-normal ml-1">· PancakeSwap V2 &amp; V3 on-chain</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <PairMonitor config={config} onOpportunity={handleOpportunity} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="queue">
                <Card className="border-slate-700 bg-slate-900">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Arbitrage Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <OpportunityQueue
                      opportunities={opportunities}
                      onClear={() => setOpportunities([])}
                      onTradeResult={handleTradeResult}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card className="border-slate-700 bg-slate-900">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-400" />
                      Trade History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <TradeHistory />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
