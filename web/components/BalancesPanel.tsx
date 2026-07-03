"use client";

import { Balance } from "@/lib/api";

function fmt(cents: number) {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default function BalancesPanel({ balances }: { balances: Balance[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Balances
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {balances.map((b) => {
          const positive = b.net_cents >= 0;
          return (
            <div
              key={b.member_id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1"
            >
              <span className="text-sm font-medium text-gray-700">{b.display_name}</span>
              <span
                className={`text-xl font-bold ${
                  positive ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {positive ? "+" : "-"}
                {fmt(b.net_cents)}
              </span>
              <span className="text-xs text-gray-400">
                {b.net_cents === 0
                  ? "settled up"
                  : positive
                  ? "is owed"
                  : "owes"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
