import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  HelpCircle,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import {
  ALL_CATEGORIES,
  type Category,
  type CategoryRule,
  type Transaction,
} from "../types/finance";
import { formatINR, normalizeMerchant } from "../utils/financeEngine";

interface TransactionsRulesViewProps {
  selectedMonth: string;
  transactions: Transaction[];
  rules: CategoryRule[];
  onChangeCategorySingle: (txId: string, category: Category) => void;
  onCreateRuleAndApply: (
    merchantPattern: string,
    category: Category,
    applyToMatching: boolean
  ) => void;
  onDeleteRule: (ruleId: string) => void;
  onDeleteTransaction: (txId: string) => void;
}

interface PendingCorrectionPrompt {
  txId: string;
  merchant: string;
  oldCategory: Category;
  newCategory: Category;
}

interface AiExplanationState {
  txId: string;
  loading: boolean;
  error?: string;
  normalizedMerchant?: string;
  suggestedCategory?: string;
  plainExplanation?: string;
  confidence?: string;
}

export const TransactionsRulesView: React.FC<TransactionsRulesViewProps> = ({
  selectedMonth,
  transactions,
  rules,
  onChangeCategorySingle,
  onCreateRuleAndApply,
  onDeleteRule,
  onDeleteTransaction,
}) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "expense" | "income" | "transfer" | "review"
  >("all");
  const [pendingRulePrompt, setPendingRulePrompt] =
    useState<PendingCorrectionPrompt | null>(null);
  const [aiState, setAiState] = useState<AiExplanationState | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => tx.date.startsWith(selectedMonth))
      .filter((tx) => {
        if (typeFilter === "review") return Boolean(tx.needsReview);
        if (typeFilter !== "all") return tx.type === typeFilter;
        return true;
      })
      .filter((tx) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          tx.merchant.toLowerCase().includes(q) ||
          tx.rawDescription.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          (tx.notes || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedMonth, typeFilter, search]);

  const handleCategorySelect = (tx: Transaction, newCategory: Category) => {
    if (tx.category === newCategory) return;
    onChangeCategorySingle(tx.id, newCategory);
    setPendingRulePrompt({
      txId: tx.id,
      merchant: normalizeMerchant(tx.merchant) || tx.merchant,
      oldCategory: tx.category,
      newCategory,
    });
  };

  const handleExplainWithAi = async (tx: Transaction) => {
    setAiState({ txId: tx.id, loading: true });
    try {
      const resp = await fetch("/api/ai/explain-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawDescription: tx.rawDescription || tx.merchant,
          amount: tx.amount,
          type: tx.type,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAiState({
          txId: tx.id,
          loading: false,
          error: data.error || "Unable to analyze entry.",
        });
        return;
      }
      setAiState({
        txId: tx.id,
        loading: false,
        normalizedMerchant: data.normalizedMerchant,
        suggestedCategory: data.suggestedCategory,
        plainExplanation: data.plainExplanation,
        confidence: data.confidence,
      });
    } catch {
      setAiState({
        txId: tx.id,
        loading: false,
        error: "Network error reaching the explanation service.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Correction Loop Prompt */}
      {pendingRulePrompt && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50/70 px-5 py-4">
          <div className="space-y-0.5">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Remember this correction for future transactions?
            </h3>
            <p className="text-xs text-slate-600">
              You updated <strong>{pendingRulePrompt.merchant}</strong> from{" "}
              {pendingRulePrompt.oldCategory} to{" "}
              <strong>{pendingRulePrompt.newCategory}</strong>. Rule priority:
              Explicit User Rule → Auto-Matcher → Needs Review.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPendingRulePrompt(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              This Transaction Only
            </button>
            <button
              type="button"
              onClick={() => {
                onCreateRuleAndApply(
                  pendingRulePrompt.merchant,
                  pendingRulePrompt.newCategory,
                  true
                );
                setPendingRulePrompt(null);
              }}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
            >
              Remember Rule for {pendingRulePrompt.merchant}
            </button>
          </div>
        </div>
      )}

      {/* AI Explanation Result Panel */}
      {aiState && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-teal-700">
                Transaction Description Assistant (Redacted Input)
              </div>
              {aiState.loading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
                  Explaining cryptic merchant description...
                </div>
              ) : aiState.error ? (
                <p className="text-xs text-amber-800">{aiState.error}</p>
              ) : (
                <div className="space-y-2 pt-1">
                  <p className="text-sm text-slate-800">
                    <strong>{aiState.normalizedMerchant}</strong> —{" "}
                    {aiState.plainExplanation}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                      Suggested Category:{" "}
                      <strong className="text-slate-900">
                        {aiState.suggestedCategory}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>Confidence: {aiState.confidence}</span>
                    {aiState.suggestedCategory &&
                      ALL_CATEGORIES.includes(
                        aiState.suggestedCategory as Category
                      ) && (
                        <button
                          type="button"
                          onClick={() => {
                            const targetTx = transactions.find(
                              (t) => t.id === aiState.txId
                            );
                            if (targetTx) {
                              handleCategorySelect(
                                targetTx,
                                aiState.suggestedCategory as Category
                              );
                            }
                            setAiState(null);
                          }}
                          className="rounded bg-teal-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-800"
                        >
                          Apply Category
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAiState(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant, bank narration, category, or notes..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "expense", label: "Expenses" },
              { id: "income", label: "Income" },
              { id: "transfer", label: "Transfers" },
              { id: "review", label: "Needs Review" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                typeFilter === f.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Transactions Ledger Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Transactions Ledger ({selectedMonth})
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {filteredTransactions.length} entries shown
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No transactions match this filter for {selectedMonth}.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Log daily entries from Overview or import a CSV/SMS batch.
            </p>
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-medium">Date</th>
                  <th className="py-2.5 pr-3 font-medium">Merchant & Narration</th>
                  <th className="py-2.5 pr-3 font-medium">Category (Editable)</th>
                  <th className="py-2.5 pr-3 font-medium">Mode / Rule</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <span>{tx.merchant}</span>
                        {tx.needsReview && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> Needs Review
                          </span>
                        )}
                      </div>
                      <div className="max-w-md truncate text-[11px] text-slate-400">
                        {tx.rawDescription}
                        {tx.notes ? ` · ${tx.notes}` : ""}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={tx.category}
                        onChange={(e) =>
                          handleCategorySelect(tx, e.target.value as Category)
                        }
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                      >
                        {ALL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-slate-500">
                      <div>{tx.paymentMode}</div>
                      {tx.ruleApplied && (
                        <div className="text-[11px] text-teal-700">
                          {tx.ruleApplied}
                        </div>
                      )}
                    </td>
                    <td
                      className={`py-3 pr-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        tx.type === "income"
                          ? "text-emerald-700"
                          : tx.type === "transfer"
                          ? "text-slate-500"
                          : "text-slate-900"
                      }`}
                    >
                      {tx.type === "income"
                        ? formatINR(tx.amount, true)
                        : tx.type === "transfer"
                        ? `${formatINR(tx.amount)} (Xfer)`
                        : `-${formatINR(tx.amount)}`}
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExplainWithAi(tx)}
                          title="Explain description with AI"
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <HelpCircle className="h-3 w-3 text-teal-700" />
                          Explain
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Delete transaction"
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Saved User Rules Manager */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <BookMarked className="h-4 w-4 text-teal-700" />
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Saved Merchant Rules ({rules.length})
          </h3>
        </div>

        {rules.length === 0 ? (
          <p className="py-4 text-xs text-slate-500">
            No custom rules saved yet. Change any transaction category above and choose &ldquo;Remember Rule&rdquo;.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-semibold text-slate-900">
                    {r.merchantPattern}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    → {r.targetCategory} · {r.matchCount} match(es)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteRule(r.id)}
                  title="Delete rule"
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
