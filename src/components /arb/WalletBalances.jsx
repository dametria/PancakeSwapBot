import { useEffect, useState } from 'react';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBNBBalance, getWalletBalances, getBotAddress, isBotReady } from '@/lib/botWallet';
import { WBNB, BUSD, USDT, USDC, CAKE, ETH, BTCB, TOKEN_SYMBOLS } from '@/lib/bsc';

const TRACKED = [WBNB, BUSD, USDT, USDC, CAKE, ETH, BTCB];

export default function WalletBalances({ refreshTrigger }) {
  const [bnb, setBnb] = useState('—');
  const [tokens, setTokens] = useState({});
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isBotReady()) load();
  }, [refreshTrigger]);

  async function load() {
    setLoading(true);
    const [addr, bnbBal, tokenBals] = await Promise.all([
      getBotAddress(),
      getBNBBalance(),
      getWalletBalances(TRACKED),
    ]);
    setAddress(addr || '');
    setBnb(parseFloat(bnbBal).toFixed(4));
    setTokens(tokenBals);
    setLoading(false);
  }

  if (!isBotReady()) {
    return (
      <div className="text-center py-4 text-slate-500 text-xs">
        Connect wallet to view balances
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-mono truncate">{address}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={load}
          disabled={loading}
          className="text-slate-400 hover:text-slate-200 h-6 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex items-center gap-2 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
        <Wallet className="w-4 h-4 text-yellow-400" />
        <span className="text-slate-400 text-xs">BNB</span>
        <span className="text-yellow-300 font-mono text-sm ml-auto">{bnb}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TRACKED.map(addr => {
          const sym = TOKEN_SYMBOLS[addr];
          const bal = tokens[addr];
          if (!bal || parseFloat(bal) === 0) return null;
          return (
            <div key={addr} className="flex items-center justify-between p-2 bg-slate-800 rounded border border-slate-700">
              <span className="text-slate-400 text-xs">{sym}</span>
              <span className="text-slate-200 font-mono text-xs">{parseFloat(bal).toFixed(4)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
