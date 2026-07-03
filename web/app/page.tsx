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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [b, s, l] = await Promise.all([
      getBalances(),
      getSettlements(),
      getLedger(),
    ]);
    setBalances(b);
    setSettlements(s);
    setLedger(l);
    setActiveUserId((prev) => prev || (b[0]?.member_id ?? ""));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div
      className="app-layout"
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
          flexDirection: "column",
        }}
      >
        {/* Mobile header */}
        <header className="mobile-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "var(--color-dark)",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect y="3" width="20" height="2" rx="1" fill="currentColor" />
                <rect y="9" width="20" height="2" rx="1" fill="currentColor" />
                <rect y="15" width="20" height="2" rx="1" fill="currentColor" />
              </svg>
            </button>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--color-dark)",
                fontFamily: "var(--font-sora)",
              }}
            >
              Austin Trip
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(46,94,78,.6)",
              fontFamily: "var(--font-sora)",
            }}
          >
            TrueSplit
          </span>
        </header>

        {/* Backdrop for mobile drawer */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main two-column area */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            activeUserId={activeUserId}
            onSelectUser={setActiveUserId}
            balances={balances}
            settlements={settlements}
            onSettle={refresh}
          />
          <main
            className="main-content"
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
    </div>
  );
}
