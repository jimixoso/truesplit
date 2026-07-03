"use client";

import { useState } from "react";
import { addExpense, Settlement } from "@/lib/api";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface Props {
  settlements: Settlement[];
  onSuccess: () => void;
}

export default function SettlementsPanel({ settlements, onSuccess }: Props) {
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
      onSuccess();
    } catch (err) {
      console.error("settle failed", err);
    } finally {
      setSettling(null);
    }
  }

  if (settlements.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Settlements
        </h2>
        <p className="text-sm text-emerald-600 font-medium">Everyone is settled up ✓</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Settlements
      </h2>
      <ul className="space-y-2">
        {settlements.map((s, i) => {
          const key = `${s.from_member_id}-${s.to_member_id}`;
          const loading = settling === key;
          return (
            <li
              key={i}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3"
            >
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-red-500">{s.from_member_name}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="font-semibold text-emerald-600">{s.to_member_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-800">{fmt(s.amount_cents)}</span>
                <button
                  onClick={() => handleSettle(s)}
                  disabled={loading || settling !== null}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 transition-colors"
                >
                  {loading ? "Settling…" : "Settle"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
