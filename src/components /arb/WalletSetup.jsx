import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';
import { initBotWallet, getBotAddress } from '@/lib/botWallet';
import { BSC_RPC_URLS } from '@/lib/bsc';

export default function WalletSetup({ onReady }) {
  const [pk, setPk] = useState('');
  const [rpc, setRpc] = useState(BSC_RPC_URLS[0]);
  const [showPk, setShowPk] = useState(false);
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  async function handleConnect() {
    setError('');
    setStatus(null);
    try {
      const cleanPk = pk.startsWith('0x') ? pk : `0x${pk}`;
      const wallet = initBotWallet(cleanPk, rpc);
      const addr = await getBotAddress();
      setAddress(addr);
      setStatus('ok');
      onReady && onReady(wallet);
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Invalid private key');
    }
  }

  return (
    <Card className="border-slate-700 bg-slate-900 text-slate-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <Wallet className="w-5 h-5 text-yellow-400" />
          Bot Wallet Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-slate-400 text-xs">Private Key (stored locally only)</Label>
          <div className="relative">
            <Input
              type={showPk ? 'text' : 'password'}
              placeholder="0x..."
              value={pk}
              onChange={e => setPk(e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-100 pr-10 font-mono text-sm"
            />
            <button
              onClick={() => setShowPk(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPk ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-400 text-xs">BSC RPC URL</Label>
          <Input
            value={rpc}
            onChange={e => setRpc(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-sm"
          />
        </div>
        <Button
          onClick={handleConnect}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          disabled={!pk}
        >
          Connect Wallet
        </Button>

        {status === 'ok' && (
          <div className="flex items-center gap-2 p-3 bg-green-900/40 border border-green-700 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <div>
              <p className="text-green-400 text-xs font-medium">Wallet connected</p>
              <p className="text-slate-400 text-xs font-mono truncate">{address}</p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-red-900/40 border border-red-700 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
        <p className="text-slate-600 text-xs">
          ⚠️ Your private key never leaves your browser. Never share it.
        </p>
      </CardContent>
    </Card>
  );
}
