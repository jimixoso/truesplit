"use client";

import { useEffect, useRef, useState } from "react";
import { getLedger, LedgerEntry, streamUrl } from "@/lib/api";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function categoryEmoji(description: string): string {
  const d = description.toLowerCase();
  if (/grocery|food|dinner|lunch|breakfast|eat|restaurant|meal|coffee/.test(d)) return "🛒";
  if (/gas|fuel|uber|lyft|transport|taxi|ride|parking/.test(d)) return "⛽";
  if (/hotel|airbnb|house|cabin|rent|hostel/.test(d)) return "🏡";
  if (/settlement/.test(d)) return "💸";
  if (/bar|drink|beer|wine|alcohol|pub/.test(d)) return "🥨";
  return "💵";
}

interface ExpenseRow {
  key: string;
  description: string;
  payer: string;
  splitCount: number;
  amountCents: number;
  createdAt: string;
}

function groupEntries(entries: LedgerEntry[]): ExpenseRow[] {
  const map = new Map<string, ExpenseRow>();
  for (const e of entries) {
    const bucket = Math.round(new Date(e.created_at).getTime() / 1000);
    const key = `${e.description}|${bucket}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        description: e.description,
        payer: "",
        splitCount: 0,
        amountCents: 0,
        createdAt: e.created_at,
      });
    }
    const row = map.get(key)!;
    if (e.entry_type === "CREDIT") {
      row.payer = e.member_name;
      row.amountCents = e.amount_cents;
    } else {
      row.splitCount++;
    }
  }
  // newest first
  return Array.from(map.values()).reverse();
}

const GRID = "1fr 120px 60px 110px 90px";

export default function LedgerFeed({
  initial,
  onMutate,
}: {
  initial: LedgerEntry[];
  onMutate: () => void;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>(initial);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setEntries(initial);
  }, [initial]);

  useEffect(() => {
    const es = new EventSource(streamUrl());
    esRef.current = es;

    es.addEventListener("connected", () => setConnected(true));

    es.onmessage = async () => {
      try {
        const fresh = await getLedger();
        setEntries(fresh);
        onMutate();
      } catch {}
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [onMutate]);

  const rows = groupEntries(entries);

  return (
    <div style={{ flex: 1 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-dark)",
            letterSpacing: ".03em",
            fontFamily: "var(--font-sora)",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Ledger
        </p>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
            background: connected ? "oklch(0.93 0.05 150)" : "#EDEAE4",
            color: connected ? "var(--color-brand)" : "rgba(27,58,48,.4)",
            fontFamily: "var(--font-public-sans)",
          }}
        >
          {connected ? "live" : "connecting…"}
        </span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          gap: 10,
          borderBottom: "1px solid var(--color-divider)",
          paddingBottom: 6,
          marginBottom: 0,
        }}
      >
        {["Expense", "Paid By", "Split", "Amount", "When"].map((h, i) => (
          <span
            key={h}
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "rgba(27,58,48,.45)",
              fontFamily: "var(--font-sora)",
              letterSpacing: ".02em",
              textAlign: i >= 3 ? "right" : "left",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Expense rows */}
      {rows.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: "rgba(27,58,48,.4)",
            textAlign: "center",
            padding: "32px 0",
            fontFamily: "var(--font-public-sans)",
          }}
        >
          No expenses yet — add one above.
        </p>
      ) : (
        rows.map((row) => (
          <div
            key={row.key}
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 10,
              alignItems: "center",
              borderBottom: "1px solid var(--color-ledger-divider)",
              padding: "12px 0",
            }}
          >
            {/* Description + emoji tile */}
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "var(--color-inactive-pill)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {categoryEmoji(row.description)}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-dark)",
                  fontFamily: "var(--font-public-sans)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.description}
              </span>
            </div>

            {/* Paid by */}
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--color-dark)",
                fontFamily: "var(--font-public-sans)",
              }}
            >
              {row.payer}
            </span>

            {/* Split count */}
            <span
              style={{
                fontSize: 12,
                color: "rgba(27,58,48,.5)",
                fontFamily: "var(--font-public-sans)",
              }}
            >
              ×{row.splitCount}
            </span>

            {/* Amount */}
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: "var(--font-dm-mono)",
                color: "var(--color-dark)",
                textAlign: "right",
              }}
            >
              {fmt(row.amountCents)}
            </span>

            {/* When */}
            <span
              style={{
                fontSize: 11.5,
                color: "rgba(27,58,48,.4)",
                fontFamily: "var(--font-public-sans)",
                textAlign: "right",
              }}
            >
              {timeAgo(row.createdAt)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
