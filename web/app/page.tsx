"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Balance,
  getBalances,
  getLedger,
  getSettlements,
  LedgerEntry,
  Settlement,
} from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import AddExpenseForm from "@/components/AddExpenseForm";
import LedgerFeed from "@/components/LedgerFeed";

export default function Home() {
  const [activeUserId, setActiveUserId] = useState("");
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
    // Default activeUserId to first balance member on first load
    setActiveUserId((prev) => prev || (b[0]?.member_id ?? ""));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        background: "var(--color-cream)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          height: "100%",
        }}
      >
        <Sidebar
          activeUserId={activeUserId}
          onSelectUser={setActiveUserId}
          balances={balances}
          settlements={settlements}
          onSettle={refresh}
        />
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            padding: 32,
            overflowY: "auto",
          }}
        >
          <AddExpenseForm activeUserId={activeUserId} onSuccess={refresh} />
          <LedgerFeed initial={ledger} onMutate={refresh} />
        </main>
      </div>
    </div>
  );
}
