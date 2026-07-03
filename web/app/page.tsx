"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Balance,
  getBalances,
  getLedger,
  getSettlements,
  LedgerEntry,
  MEMBERS,
  Settlement,
} from "@/lib/api";
import BalancesPanel from "@/components/BalancesPanel";
import SettlementsPanel from "@/components/SettlementsPanel";
import LedgerFeed from "@/components/LedgerFeed";
import AddExpenseForm from "@/components/AddExpenseForm";

export default function Home() {
  const [activeUserId, setActiveUserId] = useState(MEMBERS[0].id);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const refresh = useCallback(async () => {
    const [b, s, l] = await Promise.all([
      getBalances(),
      getSettlements(),
      getLedger(),
    ]);
    setBalances(b);
    setSettlements(s);
    setLedger(l);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-indigo-600">TrueSplit</h1>
          <p className="text-xs text-gray-400">Austin Weekend Trip</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Viewing as</span>
          <select
            value={activeUserId}
            onChange={(e) => setActiveUserId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {MEMBERS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <BalancesPanel balances={balances} />
          <SettlementsPanel settlements={settlements} onSuccess={refresh} />
          <AddExpenseForm activeUserId={activeUserId} onSuccess={refresh} />
        </div>

        {/* Right column — live ledger */}
        <div className="lg:col-span-1 h-[calc(100vh-120px)] sticky top-6">
          <LedgerFeed initial={ledger} />
        </div>
      </div>
    </div>
  );
}
