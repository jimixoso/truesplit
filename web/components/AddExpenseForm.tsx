"use client";

import { useState } from "react";
import { addExpense, MEMBERS } from "@/lib/api";

interface Props {
  activeUserId: string;
  onSuccess: () => void;
}

export default function AddExpenseForm({ activeUserId, onSuccess }: Props) {
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [payerId, setPayerId] = useState(activeUserId);
  const [splitIds, setSplitIds] = useState<string[]>(MEMBERS.map((m) => m.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMember(id: string) {
    setSplitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = Math.round(parseFloat(amountStr) * 100);
    if (!description.trim() || isNaN(amountCents) || amountCents <= 0) {
      setError("Description and a positive amount are required.");
      return;
    }
    if (splitIds.length === 0) {
      setError("Select at least one member to split with.");
      return;
    }

    // Equal split — remainder goes to the first member.
    const share = Math.floor(amountCents / splitIds.length);
    const remainder = amountCents - share * splitIds.length;
    const splits = splitIds.map((id, i) => ({
      member_id: id,
      amount_cents: i === 0 ? share + remainder : share,
    }));

    setLoading(true);
    try {
      await addExpense({ payerMemberId: payerId, amountCents, description, splits });
      setDescription("");
      setAmountStr("");
      setSplitIds(MEMBERS.map((m) => m.id));
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Add Expense
      </h2>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        <div className="flex gap-2">
          <span className="flex items-center px-3 border border-gray-200 rounded-lg text-gray-500 text-sm bg-gray-50">
            $
          </span>
          <input
            type="number"
            placeholder="0.00"
            min="0.01"
            step="0.01"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Paid by</label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {MEMBERS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-2 block">Split between</label>
          <div className="flex flex-wrap gap-2">
            {MEMBERS.map((m) => {
              const selected = splitIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-indigo-400"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors"
      >
        {loading ? "Adding…" : "Add expense"}
      </button>
    </form>
  );
}
