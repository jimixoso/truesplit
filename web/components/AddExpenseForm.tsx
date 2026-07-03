"use client";

import { useEffect, useState } from "react";
import { addExpense, Member } from "@/lib/api";

interface Props {
  groupId: string;
  members: Member[];
  activeUserId: string;
  onSuccess: () => void;
}

export default function AddExpenseForm({ groupId, members, activeUserId, onSuccess }: Props) {
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [payerId, setPayerId] = useState(activeUserId);
  const [splitIds, setSplitIds] = useState<string[]>(members.map((m) => m.id));
  const [loading, setLoading] = useState(false);

  // Sync payer when active user or members change.
  useEffect(() => {
    if (activeUserId) setPayerId(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    setSplitIds(members.map((m) => m.id));
    setPayerId((prev) => {
      const stillValid = members.some((m) => m.id === prev);
      return stillValid ? prev : (members[0]?.id ?? "");
    });
  }, [members]);

  function toggleSplit(id: string) {
    setSplitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const amountCents = Math.round(parseFloat(amountStr) * 100);
  const canSubmit =
    !!groupId &&
    members.length > 0 &&
    description.trim().length > 0 &&
    !isNaN(amountCents) &&
    amountCents > 0 &&
    splitIds.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    const share = Math.floor(amountCents / splitIds.length);
    const remainder = amountCents - share * splitIds.length;
    const splits = splitIds.map((id, i) => ({
      member_id: id,
      amount_cents: i === 0 ? share + remainder : share,
    }));

    setLoading(true);
    try {
      await addExpense(groupId, { payerMemberId: payerId, amountCents, description, splits });
      setDescription("");
      setAmountStr("");
      setSplitIds(members.map((m) => m.id));
      setPayerId(activeUserId);
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const pillBase: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 600,
    fontFamily: "var(--font-public-sans)",
    borderRadius: 999,
    padding: "5px 11px",
    border: "none",
    cursor: "pointer",
    transition: "background .15s",
  };

  if (members.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-putty)",
          borderRadius: 18,
          padding: "16px 18px",
          flexShrink: 0,
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-dark)", letterSpacing: ".03em", fontFamily: "var(--font-sora)", textTransform: "uppercase", margin: "0 0 6px" }}>
          Add Expense
        </p>
        <p style={{ fontSize: 13, color: "rgba(27,58,48,.4)", fontFamily: "var(--font-public-sans)", margin: 0 }}>
          Add at least one person to the trip to record expenses.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: "var(--color-putty)", borderRadius: 18, padding: "16px 18px", flexShrink: 0 }}
    >
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-dark)", letterSpacing: ".03em", fontFamily: "var(--font-sora)", textTransform: "uppercase", margin: "0 0 10px" }}>
        Add Expense
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          placeholder="What was it for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 1, minWidth: 0, background: "#fff", border: "1px solid var(--color-divider)", borderRadius: 12, padding: "11px 14px", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-public-sans)", color: "var(--color-dark)", outline: "none" }}
        />
        <input
          type="number"
          placeholder="0.00"
          min="0.01"
          step="0.01"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          style={{ width: 110, background: "#fff", border: "1px solid var(--color-divider)", borderRadius: 12, padding: "11px 14px", fontSize: 15, fontWeight: 500, fontFamily: "var(--font-dm-mono)", color: "var(--color-dark)", outline: "none" }}
        />
        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{ background: "var(--color-brand)", color: "var(--color-cream)", borderRadius: 12, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, fontFamily: "var(--font-sora)", border: "none", cursor: canSubmit && !loading ? "pointer" : "default", opacity: !canSubmit || loading ? 0.4 : 1, transition: "opacity .15s", whiteSpace: "nowrap" }}
        >
          {loading ? "Adding…" : "Add"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "rgba(27,58,48,.5)", fontFamily: "var(--font-public-sans)", whiteSpace: "nowrap" }}>PAID BY</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {members.map((m) => (
              <button key={m.id} type="button" onClick={() => setPayerId(m.id)}
                style={{ ...pillBase, background: m.id === payerId ? "var(--color-brand)" : "var(--color-inactive-pill)", color: m.id === payerId ? "#fff" : "var(--color-dark)" }}>
                {m.display_name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "rgba(27,58,48,.5)", fontFamily: "var(--font-public-sans)", whiteSpace: "nowrap" }}>SPLIT</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {members.map((m) => (
              <button key={m.id} type="button" onClick={() => toggleSplit(m.id)}
                style={{ ...pillBase, background: splitIds.includes(m.id) ? "var(--color-brand)" : "var(--color-inactive-pill)", color: splitIds.includes(m.id) ? "#fff" : "var(--color-dark)" }}>
                {m.display_name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
