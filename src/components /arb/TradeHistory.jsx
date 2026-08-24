import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const BSC_SCAN = 'https://bscscan.com/tx/';

const STATUS_STYLES = {
  success:   'bg-green-500/20 text-green-300 border-green-500/40',
  failed:    'bg-red-500/20 text-red-300 border-red-500/40',
  executing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  pending:   'bg-slate-600/40 text-slate-300 border-slate-500/40',
};

const STATUS_ICONS = {
  success:   <CheckCircle2 className="w-3 h-3" />,
  failed:    <XCircle className="w-3 h-3" />,
  executing: <Clock className="w-3 h-3 animate-spin" />,
  pending:   <Clock className="w-3 h-3" />,
};

export default function TradeHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadLogs() {
    const data = await base44.entities.TradeLog.list('-created_date', 50);
    setLogs(data);
    setLoading(false);
  }

  if (loading) return <div className="text-slate-500 text-sm text-center py-4">Loading trade history...</div>;
  if (logs.length === 0) return <div className="text-slate-500 text-sm text-center py-8">No trades executed yet</div>;

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {logs.map(log => (
        <div key={log.id} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-200 text-sm font-medium">{log.pair}</span>
              <Badge className={`text-xs flex items-center gap-1 ${STATUS_STYLES[log.status] || STATUS_STYLES.pending}`} variant="outline">
                {STATUS_ICONS[log.status]}
                {log.status}
              </Badge>
            </div>
            <span className="text-slate-500 text-xs">
              {new Date(log.created_date).toLocaleString()}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>{log.buyOn} → {log.sellOn}</span>
            {log.profitPct > 0 && (
              <span className="text-green-400">+{log.profitPct?.toFixed(3)}%</span>
            )}
            {log.amountIn && <span>In: {log.amountIn}</span>}
          </div>

          {log.errorMsg && (
            <p className="mt-2 text-xs text-red-400 font-mono break-all bg-red-900/20 rounded p-2">
              {log.errorMsg}
            </p>
          )}

          <div className="mt-2 flex gap-2 flex-wrap">
            {log.txHash1 && (
              <a
                href={`${BSC_SCAN}${log.txHash1}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
                Tx1: {log.txHash1.slice(0, 10)}...
              </a>
            )}
            {log.txHash2 && (
              <a
                href={`${BSC_SCAN}${log.txHash2}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
                Tx2: {log.txHash2.slice(0, 10)}...
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
