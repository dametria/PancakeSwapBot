import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, Eye, EyeOff } from 'lucide-react';
import { ARB_PAIRS } from '../../lib/constants.js';

export default function BotSettings({ settings, onSave }) {
  const [local, setLocal] = useState({ ...settings });
  const [showKey, setShowKey] = useState(false);

  function togglePair(label) {
    const current = local.enabledPairs || ARB_PAIRS.map(p => p.label);
    setLocal(s => ({
      ...s,
      enabledPairs: current.includes(label)
        ? current.filter(p => p !== label)
        : [...current, label],
    }));
  }

  const enabledPairs = local.enabledPairs || ARB_PAIRS.map(p => p.label);

  return (
    <Card className="border-gray-700 bg-gray-900 text-gray-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-gray-100 text-base">
          <Settings className="w-4 h-4 text-gray-400" />
          Bot Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Private key */}
        <div className="space-y-1">
          <Label className="text-gray-400 text-xs">Bot Wallet Private Key</Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={local.botPrivateKey || ""}
              onChange={e => setLocal(s => ({ ...s, botPrivateKey: e.target.value.trim() }))}
              placeholder="0x... your bot wallet key"
              className="bg-gray-800 border-gray-700 text-gray-100 h-8 text-sm font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-yellow-500/70 text-xs">
            ⚠️ Stored only in this browser session. For production, use a Builder+ backend function.
          </p>
        </div>

        {/* Arb contract (optional) */}
        <div className="space-y-1">
          <Label className="text-gray-400 text-xs">Arb Contract Address (optional)</Label>
          <Input
            value={local.arbContractAddress || ""}
            onChange={e => setLocal(s => ({ ...s, arbContractAddress: e.target.value.trim() }))}
            placeholder="0x... leave blank for two-leg"
            className="bg-gray-800 border-gray-700 text-gray-100 h-8 text-sm font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">Trade Size (USD)</Label>
            <Input
              type="number"
              step="10"
              value={local.tradeAmountUsd}
              onChange={e => setLocal(s => ({ ...s, tradeAmountUsd: parseFloat(e.target.value) }))}
              className="bg-gray-800 border-gray-700 text-gray-100 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">Min Profit (USD)</Label>
            <Input
              type="number"
              step="0.5"
              value={local.minProfitUsd}
              onChange={e => setLocal(s => ({ ...s, minProfitUsd: parseFloat(e.target.value) }))}
              className="bg-gray-800 border-gray-700 text-gray-100 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">Slippage %</Label>
            <Input
              type="number"
              step="0.1"
              value={local.slippagePct}
              onChange={e => setLocal(s => ({ ...s, slippagePct: parseFloat(e.target.value) }))}
              className="bg-gray-800 border-gray-700 text-gray-100 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-400 text-xs">Scan Interval (sec)</Label>
            <Input
              type="number"
              step="5"
              value={local.scanIntervalSec}
              onChange={e => setLocal(s => ({ ...s, scanIntervalSec: parseInt(e.target.value) }))}
              className="bg-gray-800 border-gray-700 text-gray-100 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
          <div>
            <p className="text-gray-200 text-sm font-medium">Auto Execute</p>
            <p className="text-gray-500 text-xs">Automatically fire trades when profit threshold met</p>
          </div>
          <Switch
            checked={!!local.autoExecute}
            onCheckedChange={v => setLocal(s => ({ ...s, autoExecute: v }))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-400 text-xs">Enabled Pairs</Label>
          <div className="grid grid-cols-2 gap-1">
            {ARB_PAIRS.map(pair => (
              <button
                key={pair.label}
                onClick={() => togglePair(pair.label)}
                className={`text-xs px-2 py-1 rounded border text-left transition-colors ${
                  enabledPairs.includes(pair.label)
                    ? 'border-blue-500/60 bg-blue-900/20 text-blue-300'
                    : 'border-gray-700 bg-gray-800 text-gray-500'
                }`}
              >
                {pair.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => onSave(local)}
          className="w-full bg-green-700 hover:bg-green-600 text-white h-8 text-sm"
        >
          <Save className="w-3 h-3 mr-2" />
          Save & Apply
        </Button>
      </CardContent>
    </Card>
  );
}
