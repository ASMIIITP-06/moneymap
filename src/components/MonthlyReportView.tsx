import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Download,
  FileText,
  Loader2,
  Repeat,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  FinancialGoal,
  FinancialProfile,
  MonthlySummary,
  RecurringCommitment,
  Transaction,
} from "../types/finance";
import {
  buildMonthlyProfitLossCSV,
  detectRecurringCandidates,
  formatINR,
} from "../utils/financeEngine";

interface MonthlyReportViewProps {
  selectedMonth: string;
  profile: FinancialProfile;
  summary: MonthlySummary;
  transactions: Transaction[];
  recurring: RecurringCommitment[];
  goals: FinancialGoal[];
  onUpdateRecurringStatus: (
    id: string,
    userStillUsing: RecurringCommitment["userStillUsing"]
  ) => void;
  onAddRecurringFromCandidate: (candidate: {
    merchant: string;
    latestAmount: number;
    previousAmount?: number;
    category: RecurringCommitment["category"];
  }) => void;
}

interface CoachBrief {
  headline: string;
  whatChanged: string;
  driftInsight: string;
  nextSteps: string[];
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  selectedMonth,
  profile,
  summary,
  transactions,
  recurring,
  goals,
  onUpdateRecurringStatus,
  onAddRecurringFromCandidate,
}) => {
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [coachBrief, setCoachBrief] = useState<CoachBrief | null>(null);

  const recurringCandidates = useMemo(
    () => detectRecurringCandidates(transactions, recurring),
    [transactions, recurring]
  );

  const csvContent = useMemo(
    () =>
      buildMonthlyProfitLossCSV(
        selectedMonth,
        summary,
        transactions,
        goals,
        profile
      ),
    [selectedMonth, summary, transactions, goals, profile]
  );

  const handleDownloadCsv = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `MoneyMap_Monthly_PL_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateBrief = async () => {
    setBriefLoading(true);
    setBriefError(null);
    try {
      const validatedPayload = {
        month: selectedMonth,
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        netProfitLoss: summary.netProfitLoss,
        savingsRatePct: summary.savingsRatePct,
        fixedCostsTotal: summary.fixedCostsTotal,
        discretionaryTotal: summary.discretionaryTotal,
        zeroSpendDays: summary.zeroSpendDays,
        highestSpendDay: summary.highestSpendDay,
        unexplainedTransactions: summary.unexplainedCount,
        categoryDrift: summary.categoryVariance.map((c) => ({
          category: c.category,
          budget: c.budget,
          actual: c.actual,
          status: c.status,
        })),
        recurringPriceIncreases: recurring
          .filter((r) => r.previousAmount && r.amount > r.previousAmount)
          .map((r) => ({
            name: r.name,
            previous: r.previousAmount,
            current: r.amount,
          })),
      };

      const resp = await fetch("/api/ai/monthly-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: validatedPayload }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setBriefError(data.error || "Unable to generate monthly brief.");
      } else {
        setCoachBrief(data);
      }
    } catch {
      setBriefError("Network error while drafting the monthly coach brief.");
    } finally {
      setBriefLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top End-of-Month CSV Export Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            End-of-Month Profit & Loss Statement ({selectedMonth})
          </h2>
          <p className="text-xs text-slate-600">
            Includes Executive P&L, Category Variance, Day-by-Day Daily Ledger, Itemized Transactions, Work-Hour Cost, and Goals Snapshot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowCsvPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5" />
            {showCsvPreview ? "Hide CSV Preview" : "Preview CSV Data"}
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            Download Monthly P&L CSV
          </button>
        </div>
      </div>

      {showCsvPreview && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-slate-700">
              CSV Export Preview (`MoneyMap_Monthly_PL_{selectedMonth}.csv`)
            </span>
            <span className="text-xs text-slate-500">
              {csvContent.split("\n").length} rows
            </span>
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
            {csvContent.replace(/^\uFEFF/, "")}
          </pre>
        </div>
      )}

      {/* Executive P&L KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Total Confirmed Income
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {formatINR(summary.totalIncome)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Transfers excluded: {formatINR(summary.totalTransfers)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Total Monthly Expenses
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(summary.totalExpenses)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Fixed {formatINR(summary.fixedCostsTotal)} · Discretionary{" "}
            {formatINR(summary.discretionaryTotal)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Net Profit / Loss
            </span>
            {summary.netProfitLoss >= 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" /> Profit
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                <TrendingDown className="h-3.5 w-3.5" /> Loss
              </span>
            )}
          </div>
          <div
            className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
              summary.netProfitLoss >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatINR(summary.netProfitLoss, true)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Savings Rate: {summary.savingsRatePct}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Peak Spend & End Balance
          </div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {formatINR(summary.projectedEndBalance)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {summary.highestSpendDay
              ? `Peak: ${formatINR(summary.highestSpendDay.amount)} on ${
                  summary.highestSpendDay.date
                }`
              : "No expenses recorded"}
          </div>
        </div>
      </div>

      {/* Daily Income vs Expense Bar Chart + AI Coach Brief */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Day-by-Day Income vs Expenses ({selectedMonth})
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Every daily entry saved rolls into this monthly P&L timeline and your downloadable CSV.
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.dailyLedger}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="dayNumber"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatINR(Number(value)),
                    String(name),
                  ]}
                  labelFormatter={(day) => `${selectedMonth}-${String(day).padStart(2, "0")}`}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="income" name="Income" fill="#16A34A" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#0F766E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Monthly Coach Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-700" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Monthly Coach Brief
                </h3>
              </div>
              <button
                type="button"
                disabled={briefLoading}
                onClick={handleGenerateBrief}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
              >
                {briefLoading ? "Drafting..." : "Draft Brief with AI"}
              </button>
            </div>

            {briefLoading ? (
              <div className="flex items-center gap-2 py-8 text-xs text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
                Drafting plain-language brief from validated P&L figures...
              </div>
            ) : briefError ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {briefError}
              </div>
            ) : coachBrief ? (
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700">
                <p className="font-semibold text-slate-900">
                  {coachBrief.headline}
                </p>
                <p>{coachBrief.whatChanged}</p>
                <p className="text-slate-600">{coachBrief.driftInsight}</p>
                <div>
                  <div className="font-semibold text-slate-900">
                    Suggested Next Steps:
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {coachBrief.nextSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-6 text-xs leading-relaxed text-slate-500">
                Click <strong>Draft Brief with AI</strong> to summarize this
                month&apos;s validated income, spending drift, and recurring
                changes in plain language. Numbers are always computed
                deterministically in code.
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            Planning & education tool only · No stock or security recommendations.
          </div>
        </div>
      </div>

      {/* Category Budget vs Actual Variance Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Category Profit / Loss Variance Breakdown
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-3 font-medium">Category</th>
                <th className="py-2.5 pr-3 text-right font-medium">Monthly Plan</th>
                <th className="py-2.5 pr-3 text-right font-medium">Actual Spend</th>
                <th className="py-2.5 pr-3 text-right font-medium">Variance (Saved / Over)</th>
                <th className="py-2.5 pl-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.categoryVariance.map((c) => (
                <tr key={c.category}>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {c.category}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-slate-600 tabular-nums">
                    {formatINR(c.budget)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-slate-900 tabular-nums">
                    {formatINR(c.actual)}
                  </td>
                  <td
                    className={`py-2.5 pr-3 text-right font-mono font-semibold tabular-nums ${
                      c.variance >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {formatINR(c.variance, true)}
                  </td>
                  <td className="py-2.5 pl-3">
                    <span
                      className={`font-medium ${
                        c.status === "Exceeded"
                          ? "text-red-700"
                          : c.status === "Trending Over"
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {c.status} ({c.pctUsed}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recurring Payments & Honest Usage Check (PDF Page 7) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Repeat className="h-4 w-4 text-teal-700" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Recurring Commitments & Honest Alerts
            </h3>
            <p className="text-xs text-slate-500">
              Flags price increases and asks you to confirm usage instead of guessing from transaction data alone.
            </p>
          </div>
        </div>

        <div className="mt-3 divide-y divide-slate-100">
          {recurring.map((r) => {
            const priceUp = r.previousAmount && r.amount > r.previousAmount;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {r.name}
                    </span>
                    {priceUp && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Price rose from {formatINR(r.previousAmount!)} to{" "}
                        {formatINR(r.amount)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    Due day {r.dueDay} · {r.category} ·{" "}
                    <span className="font-mono font-medium text-slate-800">
                      {formatINR(r.amount)}/mo
                    </span>
                  </div>
                </div>

                {!r.isEssential && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Still using this?</span>
                    {(["yes", "unsure", "no"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onUpdateRecurringStatus(r.id, opt)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                          r.userStillUsing === opt
                            ? opt === "no"
                              ? "border-red-300 bg-red-50 text-red-700"
                              : opt === "unsure"
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-teal-600 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt === "no" ? "Unused" : opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Newly Detected Candidates */}
        {recurringCandidates.filter((c) => !c.alreadyTracked).length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold text-slate-800">
              Detected Repeated Merchants (Confirm to Track)
            </h4>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recurringCandidates
                .filter((c) => !c.alreadyTracked)
                .slice(0, 4)
                .map((c) => (
                  <div
                    key={c.merchant}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {c.merchant}
                      </div>
                      <div className="text-slate-500 tabular-nums">
                        {c.occurrences} charges · Latest{" "}
                        {formatINR(c.latestAmount)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddRecurringFromCandidate(c)}
                      className="rounded border border-teal-600 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 whitespace-nowrap"
                    >
                      Confirm Recurring
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
