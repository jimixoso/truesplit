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
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LedgerFeed({
  initial,
}: {
  initial: LedgerEntry[];
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>(initial);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(streamUrl());
    esRef.current = es;

    es.addEventListener("connected", () => setConnected(true));

    es.onmessage = async () => {
      // Re-fetch the full ledger on any LEDGER_MUTATED event.
      try {
        const fresh = await getLedger();
        setEntries(fresh);
      } catch {}
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Ledger Feed
        </h2>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            connected
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {connected ? "live" : "connecting…"}
        </span>
      </div>

      <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
        {entries.map((e) => (
          <li
            key={e.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-800">{e.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {e.member_name} ·{" "}
                  <span
                    className={
                      e.entry_type === "CREDIT"
                        ? "text-emerald-600"
                        : "text-red-400"
                    }
                  >
                    {e.entry_type}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-bold ${
                    e.entry_type === "CREDIT"
                      ? "text-emerald-600"
                      : "text-red-500"
                  }`}
                >
                  {e.entry_type === "CREDIT" ? "+" : "-"}
                  {fmt(e.amount_cents)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(e.created_at)}</p>
              </div>
            </div>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-sm text-gray-400 text-center py-8">
            No transactions yet.
          </li>
        )}
      </ul>
    </div>
  );
}
