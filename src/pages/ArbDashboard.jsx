import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Play, Square, Settings, RefreshCw, FileCode } from "lucide-react";
import { Link } from "react-router-dom";

import StatsBar from "@/components/arb/StatsBar";
import PriceTable from "@/components/arb/PriceTable";
import TradeLog from "@/components/arb/TradeLog";
import WalletPanel from "@/components/arb/WalletPanel";
import BotSettings from "@/components/arb/BotSettings";
import ExecutionModal from "@/components/arb/ExecutionModal";
import ContractStatus from "@/components/arb/ContractStatus";

import { getArbOpportunity } from "../lib/priceEngine";
import { executeArbitrage, getBotBalances } from "../lib/tradeExecutor";
import { ARB_PAIRS, MIN_PROFIT_USD, TRADE_AMOUNT_USD } from "../lib/constants";
import { ARB_CONTRACT_ADDRESS } from "../lib/env";

const DEFAULT_SETTINGS = {
  arbContractAddress: ARB_CONTRACT_ADDRESS,
  botPrivateKey: "",
  tradeAmountUsd: TRADE_AMOUNT_USD,
  minProfitUsd: MIN_PROFIT_USD,
  slippagePct: 0.5,
  scanIntervalSec: 15,
  autoExecute: false,
};

export default function ArbDashboard() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = sessionStorage.getItem("arb_settings");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [opportunities, setOpportunities] = useState([]);
  const [trades, setTrades] = useState([]);
  const [balances, setBalances] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [executingPair, setExecutingPair] = useState(null);
  const [execModal, setExecModal] = useState({ open: false, loading: false, result: null });
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [stats, setStats] = useState({ totalProfit: 0, tradesExecuted: 0, tradesSuccess: 0, scansTotal: 0 });

  const scanInterval = useRef(null);
  const autoExecRef = useRef(settings.autoExecute);
  autoExecRef.current = settings.autoExecute;

  // ── Scan all pairs for opportunities ──────────────────────────────────────
  const scanOpportunities = useCallback(async () => {
    setIsScanning(true);
    try {
      const results = await Promise.allSettled(
        ARB_PAIRS.map(pair => getArbOpportunity(pair.token0, pair.token1, settings.tradeAmountUsd))
      );

      const opps = results
        .filter(r => r.status === "fulfilled" && r.value !== null)
        .map(r => r.value);

      setOpportunities(opps);
      setStats(s => ({ ...s, scansTotal: s.scansTotal + opps.length }));

      // Auto-execute if enabled
      if (autoExecRef.current && settings.arbContractAddress) {
        for (const opp of opps) {
          if (opp.profitUsd >= settings.minProfitUsd) {
            await triggerExecution(opp, true);
            break; // one at a time
          }
        }
      }
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setIsScanning(false);
    }
  }, [settings.tradeAmountUsd, settings.minProfitUsd, settings.arbContractAddress]);

  // ── Start/stop bot ─────────────────────────────────────────────────────────
  const startBot = () => {
    if (!settings.arbContractAddress || !/^0x[0-9a-fA-F]{40}$/.test(settings.arbContractAddress)) {
      toast.error("Configure a valid arb contract address (0x + 40 hex chars) in Settings first");
      setShowSettings(true);
      return;
    }
    setBotRunning(true);
    scanOpportunities();
    scanInterval.current = setInterval(scanOpportunities, settings.scanIntervalSec * 1000);
    toast.success("Bot started — scanning for arbitrage opportunities");
  };

  const stopBot = () => {
    clearInterval(scanInterval.current);
    setBotRunning(false);
    toast.info("Bot stopped");
  };

  useEffect(() => () => clearInterval(scanInterval.current), []);

  // ── Execute a trade ────────────────────────────────────────────────────────
  const triggerExecution = async (opp, silent = false) => {
    if (!settings.arbContractAddress) {
      toast.error("No arb contract address configured");
      return;
    }
    if (executingPair) return;

    setExecutingPair(opp.pair);
    if (!silent) setExecModal({ open: true, loading: true, result: null });

    const tradeRecord = {
      pair: opp.pair,
      direction: `${opp.buyDex} → ${opp.sellDex}`,
      profitUsd: opp.profitUsd,
      status: "pending",
      timestamp: Date.now(),
    };
    setTrades(t => [...t, tradeRecord]);

    try {
      const result = await executeArbitrage(opp, settings.arbContractAddress, settings.botPrivateKey);
      const txHash = result.txHash || result.leg1TxHash;

      setTrades(t => t.map((tr, i) =>
        i === t.length - 1 ? { ...tr, status: "success", txHash } : tr
      ));
      setStats(s => ({
        ...s,
        totalProfit: s.totalProfit + opp.profitUsd,
        tradesExecuted: s.tradesExecuted + 1,
        tradesSuccess: s.tradesSuccess + 1,
      }));

      if (!silent) setExecModal({ open: true, loading: false, result });
      else toast.success(`Auto-executed ${opp.pair} — ~$${opp.profitUsd.toFixed(2)} profit`);
    } catch (err) {
      const errMsg = err.reason || err.message || String(err);
      setTrades(t => t.map((tr, i) =>
        i === t.length - 1 ? { ...tr, status: "failed", error: errMsg } : tr
      ));
      setStats(s => ({ ...s, tradesExecuted: s.tradesExecuted + 1 }));

      if (!silent) setExecModal({ open: true, loading: false, result: { success: false, error: errMsg, logs: [] } });
      else toast.error(`Trade failed: ${errMsg.slice(0, 80)}`);
    } finally {
      setExecutingPair(null);
    }
  };

  // ── Load wallet balances ───────────────────────────────────────────────────
  const loadBalances = async (privateKey) => {
    setLoadingBalances(true);
    try {
      const bal = await getBotBalances(privateKey ?? settings.botPrivateKey);
      setBalances(bal);
    } catch (err) {
      toast.error("Failed to load balances: " + err.message);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  // ── Save settings ──────────────────────────────────────────────────────────
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    sessionStorage.setItem("arb_settings", JSON.stringify(newSettings));
    setShowSettings(false);
    toast.success("Settings saved");
    loadBalances(newSettings.botPrivateKey);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              🥞 PancakeSwap Arbitrage Bot
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">BSC · V2 vs V3 · Real-time on-chain pricing</p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/contract">
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white text-xs">
                <FileCode className="w-3 h-3 mr-1" /> Flash Loan Contract
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(s => !s)}
              className="border-gray-700 text-gray-300 hover:text-white text-xs"
            >
              <Settings className="w-3 h-3 mr-1" /> Settings
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={scanOpportunities}
              disabled={isScanning}
              className="border-gray-700 text-gray-300 hover:text-white text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isScanning ? "animate-spin" : ""}`} /> Scan Now
            </Button>

            {!botRunning ? (
              <Button size="sm" onClick={startBot} className="bg-green-600 hover:bg-green-500 text-white text-xs">
                <Play className="w-3 h-3 mr-1" /> Start Bot
              </Button>
            ) : (
              <Button size="sm" onClick={stopBot} className="bg-red-600 hover:bg-red-500 text-white text-xs">
                <Square className="w-3 h-3 mr-1" /> Stop Bot
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Settings panel (inline toggle) */}
        {showSettings && (
          <BotSettings settings={settings} onSave={handleSaveSettings} />
        )}

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Price table — 3/4 width */}
          <div className="lg:col-span-3 space-y-6">
            <PriceTable
              opportunities={opportunities}
              onExecute={(opp) => triggerExecution(opp, false)}
              isScanning={isScanning}
              executingPair={executingPair}
            />
            <TradeLog trades={trades} />
          </div>

          {/* Side panel — 1/4 width */}
          <div className="space-y-4">
            <ContractStatus contractAddress={settings.arbContractAddress} />

            <WalletPanel
              balances={balances}
              onRefresh={loadBalances}
              loading={loadingBalances}
            />

            {/* Bot status */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
              <span className="text-xs font-semibold text-gray-400">Bot Status</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isScanning ? "bg-yellow-400 animate-ping" :
                  botRunning ? "bg-green-400 animate-pulse" : "bg-gray-600"
                }`} />
                <span className={`text-sm font-semibold ${
                  isScanning ? "text-yellow-400" :
                  botRunning ? "text-green-400" : "text-gray-500"
                }`}>
                  {isScanning ? "Scanning…" : botRunning ? "Running" : "Stopped"}
                </span>
              </div>
              {isScanning && (
                <p className="text-xs text-yellow-600 animate-pulse">⚡ Fetching on-chain prices…</p>
              )}
              {botRunning && !isScanning && (
                <p className="text-xs text-gray-600">
                  Scanning every {settings.scanIntervalSec}s
                  {settings.autoExecute ? " · Auto-executing" : ""}
                </p>
              )}
              <div className="pt-1 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Trade size</span>
                  <span className="text-gray-400">${settings.tradeAmountUsd}</span>
                </div>
                <div className="flex justify-between">
                  <span>Min profit</span>
                  <span className="text-gray-400">${settings.minProfitUsd}</span>
                </div>
                <div className="flex justify-between">
                  <span>Slippage</span>
                  <span className="text-gray-400">{settings.slippagePct}%</span>
                </div>
              </div>
            </div>

            {/* Network info */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Network</span>
                <span className="text-gray-300">BSC Mainnet</span>
              </div>
              <div className="flex justify-between">
                <span>V2 Router</span>
                <a
                  href="https://bscscan.com/address/0x10ED43C718714eb63d5aA57B78B54704E256024E"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  0x10ED...4E
                </a>
              </div>
              <div className="flex justify-between">
                <span>V3 Router</span>
                <a
                  href="https://bscscan.com/address/0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  0x13f4...Dd4
                </a>
              </div>
              <div className="flex justify-between">
                <span>Price data</span>
                <span className="text-green-400">On-chain only</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Execution modal */}
      <ExecutionModal
        open={execModal.open}
        loading={execModal.loading}
        result={execModal.result}
        onClose={() => setExecModal({ open: false, loading: false, result: null })}
      />
    </div>
  );
}
