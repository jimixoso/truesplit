"use client";

import { useState } from "react";
import {
  addExpense,
  addMember,
  Balance,
  createGroup,
  Group,
  Member,
  Settlement,
} from "@/lib/api";

const AVATAR_COLORS = [
  "oklch(0.58 0.09 150)",
  "oklch(0.58 0.09 250)",
  "oklch(0.60 0.10 60)",
  "oklch(0.58 0.10 25)",
];

function fmt(cents: number) {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

const LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: ".03em",
  color: "var(--color-dark)",
  fontFamily: "var(--font-sora)",
  textTransform: "uppercase",
  margin: 0,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  activeGroupId: string;
  onSelectGroup: (id: string) => void;
  onGroupCreated: (g: Group) => void;
  members: Member[];
  activeUserId: string;
  onSelectUser: (id: string) => void;
  onMemberAdded: (m: Member) => void;
  balances: Balance[];
  settlements: Settlement[];
  onSettle: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  groups,
  activeGroupId,
  onSelectGroup,
  onGroupCreated,
  members,
  activeUserId,
  onSelectUser,
  onMemberAdded,
  balances,
  settlements,
  onSettle,
}: Props) {
  const [settling, setSettling] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  async function handleSettle(s: Settlement) {
    const key = `${s.from_member_id}-${s.to_member_id}`;
    setSettling(key);
    try {
      await addExpense(activeGroupId, {
        payerMemberId: s.from_member_id,
        amountCents: s.amount_cents,
        description: `Settlement: ${s.from_member_name} → ${s.to_member_name}`,
        splits: [{ member_id: s.to_member_id, amount_cents: s.amount_cents }],
      });
      onSettle();
    } catch (err) {
      console.error("settle failed", err);
    } finally {
      setSettling(null);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const g = await createGroup(newGroupName.trim());
      onGroupCreated(g);
      setNewGroupName("");
      setShowNewGroup(false);
    } catch (err) {
      console.error("create group failed", err);
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberName.trim() || addingMember || !activeGroupId) return;
    setAddingMember(true);
    try {
      const m = await addMember(activeGroupId, newMemberName.trim());
      onMemberAdded(m);
      setNewMemberName("");
    } catch (err) {
      console.error("add member failed", err);
    } finally {
      setAddingMember(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: "#fff",
    border: "1px solid var(--color-divider)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "var(--font-public-sans)",
    color: "var(--color-dark)",
    outline: "none",
    minWidth: 0,
  };

  const addBtnStyle: React.CSSProperties = {
    background: "var(--color-brand)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "var(--font-sora)",
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <aside
      className={`sidebar${isOpen ? " open" : ""}`}
      style={{
        width: 300,
        flexShrink: 0,
        borderRight: "1px solid var(--color-divider)",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        overflowY: "auto",
      }}
    >
      {/* Mobile close button */}
      <button
        onClick={onClose}
        aria-label="Close menu"
        className="sidebar-close-btn"
        style={{
          display: "none",
          alignSelf: "flex-end",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
          color: "var(--color-dark)",
          padding: 0,
          marginBottom: -8,
        }}
      >
        ✕
      </button>

      {/* ---- Groups ---- */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={LABEL}>Trips</p>
          <button
            onClick={() => setShowNewGroup((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--color-brand)",
              lineHeight: 1,
              padding: 0,
            }}
            title="New trip"
          >
            +
          </button>
        </div>

        {showNewGroup && (
          <form
            onSubmit={handleCreateGroup}
            style={{ display: "flex", gap: 6, marginBottom: 8 }}
          >
            <input
              autoFocus
              placeholder="Trip name…"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" disabled={creatingGroup} style={addBtnStyle}>
              {creatingGroup ? "…" : "Add"}
            </button>
          </form>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {groups.map((g) => {
            const active = g.id === activeGroupId;
            return (
              <button
                key={g.id}
                onClick={() => { onSelectGroup(g.id); onClose(); }}
                style={{
                  background: active ? "var(--color-brand)" : "var(--color-inactive-pill)",
                  color: active ? "#fff" : "var(--color-dark)",
                  borderRadius: 12,
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-public-sans)",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background .15s",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {g.name}
              </button>
            );
          })}
          {groups.length === 0 && (
            <p style={{ fontSize: 12, color: "rgba(27,58,48,.4)", fontFamily: "var(--font-public-sans)" }}>
              No trips yet.
            </p>
          )}
        </div>
      </div>

      {/* ---- Viewing As ---- */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={LABEL}>Viewing As</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m) => {
            const active = m.id === activeUserId;
            return (
              <button
                key={m.id}
                onClick={() => onSelectUser(m.id)}
                style={{
                  background: active ? "var(--color-brand)" : "var(--color-inactive-pill)",
                  color: active ? "#fff" : "var(--color-dark)",
                  borderRadius: 12,
                  padding: "9px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-public-sans)",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background .15s",
                }}
              >
                {m.display_name}
              </button>
            );
          })}
          {members.length === 0 && (
            <p style={{ fontSize: 12, color: "rgba(27,58,48,.4)", fontFamily: "var(--font-public-sans)" }}>
              No members yet — add one below.
            </p>
          )}
        </div>

        {/* Add member inline */}
        <form
          onSubmit={handleAddMember}
          style={{ display: "flex", gap: 6, marginTop: 8 }}
        >
          <input
            placeholder="Add person…"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            disabled={!activeGroupId}
            style={{ ...inputStyle, opacity: !activeGroupId ? 0.4 : 1 }}
          />
          <button
            type="submit"
            disabled={addingMember || !newMemberName.trim() || !activeGroupId}
            style={{ ...addBtnStyle, opacity: !newMemberName.trim() || !activeGroupId ? 0.4 : 1 }}
          >
            {addingMember ? "…" : "+"}
          </button>
        </form>
      </div>

      {/* ---- Balances ---- */}
      <div>
        <p style={{ ...LABEL, marginBottom: 8 }}>Balances</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {balances.map((b, i) => {
            const isMe = b.member_id === activeUserId;
            const positive = b.net_cents > 0;
            const settled = b.net_cents === 0;
            const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const initials = b.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

            let statusLine: string;
            if (settled) statusLine = "Settled up";
            else if (isMe) statusLine = positive ? "You get back" : "You owe";
            else statusLine = positive ? "Gets back" : "Owes";

            return (
              <div
                key={b.member_id}
                style={{
                  background: "var(--color-putty)",
                  borderRadius: 14,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: avatarColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12.5, fontWeight: 600, color: "#fff",
                    fontFamily: "var(--font-sora)", flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-dark)", margin: 0, fontFamily: "var(--font-public-sans)" }}>
                    {b.display_name}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(27,58,48,.5)", margin: "1px 0 0", fontFamily: "var(--font-public-sans)" }}>
                    {statusLine}
                  </p>
                </div>
                {!settled && (
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-dm-mono)", color: positive ? "var(--color-brand)" : "var(--color-terracotta)" }}>
                    {fmt(b.net_cents)}
                  </span>
                )}
              </div>
            );
          })}
          {balances.length === 0 && (
            <p style={{ fontSize: 12, color: "rgba(27,58,48,.4)", fontFamily: "var(--font-public-sans)" }}>
              No balances yet.
            </p>
          )}
        </div>
      </div>

      {/* ---- Settle Up ---- */}
      <div>
        <p style={{ ...LABEL, marginBottom: 8 }}>Settle Up</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {settlements.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--color-brand)", fontFamily: "var(--font-public-sans)" }}>
              Everyone is settled up ✓
            </p>
          ) : (
            settlements.map((s, i) => {
              const key = `${s.from_member_id}-${s.to_member_id}`;
              const isSettling = settling === key;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    opacity: isSettling ? 0.45 : 1, transition: "opacity .2s",
                  }}
                >
                  <span style={{ fontSize: 12, fontFamily: "var(--font-public-sans)", color: "var(--color-dark)", textDecoration: isSettling ? "line-through" : "none", flex: 1, minWidth: 0 }}>
                    {s.from_member_name} → {s.to_member_name}{" "}
                    <span style={{ fontFamily: "var(--font-dm-mono)", fontWeight: 500 }}>
                      ${(s.amount_cents / 100).toFixed(2)}
                    </span>
                  </span>
                  <button
                    onClick={() => handleSettle(s)}
                    disabled={settling !== null}
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      border: isSettling ? "none" : "1.5px solid var(--color-brand)",
                      background: isSettling ? "var(--color-brand)" : "transparent",
                      color: isSettling ? "#fff" : "var(--color-brand)",
                      fontSize: 12, cursor: settling !== null ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "background .15s",
                    }}
                  >
                    ✓
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
