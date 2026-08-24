import React from "react";
import { TrendingUp, DollarSign, Zap, Activity } from "lucide-react";

export default function StatsBar({ stats }) {
  const cards = [
    {
      label: "Total Profit",
      value: `$${stats.totalProfit?.toFixed(2) ?? "0.00"}`,
      icon: DollarSign,
      color: "text-green-400",
    },
    {
      label: "Trades Executed",
      value: stats.tradesExecuted ?? 0,
      icon: Zap,
      color: "text-blue-400",
    },
    {
      label: "Success Rate",
      value: stats.tradesExecuted
        ? `${Math.round((stats.tradesSuccess / stats.tradesExecuted) * 100)}%`
        : "—",
      icon: TrendingUp,
      color: "text-purple-400",
    },
    {
      label: "Opps Scanned",
      value: stats.scansTotal ?? 0,
      icon: Activity,
      color: "text-yellow-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <card.icon className={`w-4 h-4 ${card.color}`} />
            <span className="text-xs text-gray-400">{card.label}</span>
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
