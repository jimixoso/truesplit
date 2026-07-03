"use client";

import { useState } from "react";
import { addExpense, Balance, MEMBERS, Settlement } from "@/lib/api";

const AVATAR_COLORS = [
  "oklch(0.58 0.09 150)",
  "oklch(0.58 0.09 250)",
  "oklch(0.60 0.10 60)",
  "oklch(0.58 0.10 25)",
];

function fmt(cents: number) {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

const LABEL_STYLE: React.CSSProperties = {
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
  activeUserId: string;
  onSelectUser: (id: string) => void;
  balances: Balance[];
  settlements: Settlement[];
  onSettle: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  activeUserId,
  onSelectUser,
  balances,
  settlements,
  onSettle,
}: Props) {
  const [settling, setSettling] = useState<string | null>(null);

  async function handleSettle(s: Settlement) {
    const key = `${s.from_member_id}-${s.to_member_id}`;
    setSettling(key);
    try {
      await addExpense({
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

  // Build member index for avatar color lookup
  const memberIndex = Object.fromEntries(MEMBERS.map((m, i) => [m.id, i]));

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
        className="sidebar-close-btn"
      >
        ✕
      </button>

      {/* Trip header */}
      <div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(46,94,78,.6)",
            letterSpacing: ".02em",
            fontFamily: "var(--font-sora)",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Trips / Austin Weekend Trip
        </p>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--color-dark)",
            fontFamily: "var(--font-sora)",
            margin: "6px 0 4px",
          }}
        >
          Austin Trip
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgba(27,58,48,.55)",
            fontFamily: "var(--font-public-sans)",
            margin: 0,
          }}
        >
          Jul 2026 · 4 people
        </p>
      </div>

      {/* Viewing as */}
      <div>
        <p style={LABEL_STYLE}>Viewing As</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {MEMBERS.map((m) => {
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
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Balances */}
      <div>
        <p style={LABEL_STYLE}>Balances</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {balances.map((b) => {
            const idx = memberIndex[b.member_id] ?? 0;
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const isMe = b.member_id === activeUserId;
            const positive = b.net_cents > 0;
            const settled = b.net_cents === 0;

            let statusLine: string;
            if (settled) statusLine = "Settled up";
            else if (isMe) statusLine = positive ? "You get back" : "You owe";
            else statusLine = positive ? "Gets back" : "Owes";

            const initials = b.display_name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

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
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: avatarColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#fff",
                    fontFamily: "var(--font-sora)",
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-dark)",
                      margin: 0,
                      fontFamily: "var(--font-public-sans)",
                    }}
                  >
                    {b.display_name}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(27,58,48,.5)",
                      margin: "1px 0 0",
                      fontFamily: "var(--font-public-sans)",
                    }}
                  >
                    {statusLine}
                  </p>
                </div>
                {!settled && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "var(--font-dm-mono)",
                      color: positive ? "var(--color-brand)" : "var(--color-terracotta)",
                    }}
                  >
                    {fmt(b.net_cents)}
                  </span>
                )}
              </div>
            );
          })}
          {balances.length === 0 && (
            <p
              style={{
                fontSize: 12,
                color: "rgba(27,58,48,.4)",
                fontFamily: "var(--font-public-sans)",
              }}
            >
              No balances yet.
            </p>
          )}
        </div>
      </div>

      {/* Settle up */}
      <div>
        <p style={LABEL_STYLE}>Settle Up</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {settlements.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: "var(--color-brand)",
                fontFamily: "var(--font-public-sans)",
              }}
            >
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    opacity: isSettling ? 0.45 : 1,
                    transition: "opacity .2s",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "var(--font-public-sans)",
                      color: "var(--color-dark)",
                      textDecoration: isSettling ? "line-through" : "none",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {s.from_member_name} → {s.to_member_name}{" "}
                    <span
                      style={{
                        fontFamily: "var(--font-dm-mono)",
                        fontWeight: 500,
                      }}
                    >
                      ${(s.amount_cents / 100).toFixed(2)}
                    </span>
                  </span>
                  <button
                    onClick={() => handleSettle(s)}
                    disabled={settling !== null}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: isSettling ? "none" : "1.5px solid var(--color-brand)",
                      background: isSettling ? "var(--color-brand)" : "transparent",
                      color: isSettling ? "#fff" : "var(--color-brand)",
                      fontSize: 12,
                      cursor: settling !== null ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "background .15s",
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
