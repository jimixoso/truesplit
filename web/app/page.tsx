"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Balance,
  getBalances,
  getLedger,
  getSettlements,
  Group,
  LedgerEntry,
  listGroups,
  listMembers,
  Member,
  Settlement,
} from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import AddExpenseForm from "@/components/AddExpenseForm";
import LedgerFeed from "@/components/LedgerFeed";

export default function Home() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [activeUserId, setActiveUserId] = useState("");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch group-specific data whenever the active group changes.
  const refreshGroup = useCallback(async (groupId: string) => {
    if (!groupId) return;
    const [b, s, l, m] = await Promise.all([
      getBalances(groupId),
      getSettlements(groupId),
      getLedger(groupId),
      listMembers(groupId),
    ]);
    setBalances(b);
    setSettlements(s);
    setLedger(l);
    setMembers(m);
    setActiveUserId((prev) => {
      const stillValid = m.some((mem) => mem.id === prev);
      return stillValid ? prev : (m[0]?.id ?? "");
    });
  }, []);

  // Called after any mutation (add expense, settle, add member).
  const refresh = useCallback(() => {
    if (activeGroupId) refreshGroup(activeGroupId);
  }, [activeGroupId, refreshGroup]);

  // On mount: load all groups and activate the first one.
  useEffect(() => {
    listGroups().then((gs) => {
      setGroups(gs);
      if (gs.length > 0) {
        setActiveGroupId(gs[0].id);
        refreshGroup(gs[0].id);
      }
    });
  }, [refreshGroup]);

  // Re-fetch group data when active group changes.
  useEffect(() => {
    if (activeGroupId) refreshGroup(activeGroupId);
  }, [activeGroupId, refreshGroup]);

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  function handleGroupCreated(g: Group) {
    setGroups((prev) => [...prev, g]);
    setActiveGroupId(g.id);
  }

  function handleMemberAdded(m: Member) {
    setMembers((prev) => [...prev, m]);
  }

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
              {activeGroup?.name ?? "TrueSplit"}
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
            groups={groups}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
            onGroupCreated={handleGroupCreated}
            members={members}
            activeUserId={activeUserId}
            onSelectUser={setActiveUserId}
            onMemberAdded={handleMemberAdded}
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
            <AddExpenseForm
              groupId={activeGroupId}
              members={members}
              activeUserId={activeUserId}
              onSuccess={refresh}
            />
            <LedgerFeed
              groupId={activeGroupId}
              initial={ledger}
              onMutate={refresh}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
