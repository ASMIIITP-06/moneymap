import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  ALL_CATEGORIES,
  type Category,
  type FinancialGoal,
  type FinancialProfile,
  type MonthlySummary,
  type PaymentMode,
  type RecurringCommitment,
  type Transaction,
  type TransactionType,
} from "../types/finance";
import {
  computeSafeToSpendToday,
  formatINR,
  getDaysInMonth,
} from "../utils/financeEngine";

interface OverviewDailyViewProps {
  selectedMonth: string;
  profile: FinancialProfile;
  summary: MonthlySummary;
  transactions: Transaction[];
  recurring: RecurringCommitment[];
  goals: FinancialGoal[];
  onAddTransaction: (tx: Omit<Transaction, "id">) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateProfile: (patch: Partial<FinancialProfile>) => void;
  onNavigateTab: (tab: "import" | "radar" | "report" | "transactions") => void;
}

const PAYMENT_MODES: PaymentMode[] = [
  "UPI",
  "Bank Transfer",
  "Card",
  "Cash",
  "Auto-Debit",
];

export const OverviewDailyView: React.FC<OverviewDailyViewProps> = ({
  selectedMonth,
  profile,
  summary,
  transactions,
  recurring,
  goals,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateProfile,
  onNavigateTab,
}) => {
  const defaultDay = selectedMonth === "2026-11" ? "2026-11-21" : `${selectedMonth}-01`;
  const [selectedDate, setSelectedDate] = useState<string>(defaultDay);
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Dining");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [notes, setNotes] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [draftOpening, setDraftOpening] = useState(String(profile.openingAvailableBalance));
  const [draftEmergency, setDraftEmergency] = useState(String(profile.emergencyFundBalance));
  const [draftSalaryDay, setDraftSalaryDay] = useState(String(profile.salaryDay));

  // Keep selectedDate synchronized when month changes
  React.useEffect(() => {
    if (!selectedDate.startsWith(selectedMonth)) {
      setSelectedDate(
        selectedMonth === "2026-11" ? "2026-11-21" : `${selectedMonth}-01`
      );
    }
  }, [selectedMonth, selectedDate]);

  const currentAvailableCash = summary.projectedEndBalance;
  const safeToSpend = useMemo(
    () =>
      computeSafeToSpendToday(
        currentAvailableCash,
        recurring,
        goals,
        profile.salaryDay,
        selectedMonth === "2026-11" ? "2026-11-21" : `${selectedMonth}-15`
      ),
    [currentAvailableCash, recurring, goals, profile.salaryDay, selectedMonth]
  );

  const hourlyRate =
    profile.workHoursPerMonth > 0
      ? profile.monthlyIncome / profile.workHoursPerMonth
      : 0;
  const parsedAmt = Number(amount) || 0;
  const workHoursCost =
    hourlyRate > 0 && parsedAmt > 0 && txType === "expense"
      ? (parsedAmt / hourlyRate).toFixed(1)
      : null;

  const selectedDayTransactions = useMemo(
    () =>
      transactions
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => b.id.localeCompare(a.id)),
    [transactions, selectedDate]
  );

  const selectedDayLedger = useMemo(
    () => summary.dailyLedger.find((d) => d.date === selectedDate),
    [summary.dailyLedger, selectedDate]
  );

  // Calendar grid offset for the 1st of selectedMonth
  const firstDayOffset = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    if (!y || !m) return 0;
    const jsDay = new Date(y, m - 1, 1).getDay(); // 0=Sun..6=Sat
    return (jsDay + 6) % 7; // Mon=0..Sun=6
  }, [selectedMonth]);

  const daysInMonth = getDaysInMonth(selectedMonth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!merchant.trim() || !numericAmount || numericAmount <= 0) return;

    onAddTransaction({
      date: selectedDate,
      merchant: merchant.trim().toUpperCase(),
      rawDescription: `MANUAL/${merchant.trim().toUpperCase()}`,
      amount: numericAmount,
      type: txType,
      category:
        txType === "transfer"
          ? "Transfer"
          : txType === "income" && category === "Dining"
          ? "Salary / Income"
          : category,
      paymentMode,
      source: "manual",
      notes: notes.trim() || undefined,
      needsReview: false,
      confidence: 1,
    });

    setMerchant("");
    setAmount("");
    setNotes("");
  };

  const handleSaveProfileQuick = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      openingAvailableBalance: Number(draftOpening) || 0,
      emergencyFundBalance: Number(draftEmergency) || 0,
      salaryDay: Math.min(28, Math.max(1, Number(draftSalaryDay) || 5)),
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
    setEditingBalance(false);
  };

  const driftCategories = summary.categoryVariance.filter(
    (c) => c.status !== "On Track" || c.actual > 0
  );

  return (
    <div className="space-y-6">
      {/* Top Living Model KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Liquid Available Balance
            </span>
            <button
              type="button"
              onClick={() => {
                setDraftOpening(String(profile.openingAvailableBalance));
                setDraftEmergency(String(profile.emergencyFundBalance));
                setDraftSalaryDay(String(profile.salaryDay));
                setEditingBalance((v) => !v);
              }}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              {editingBalance ? "Close" : "Adjust"}
            </button>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {formatINR(currentAvailableCash)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Excludes {formatINR(profile.emergencyFundBalance)} emergency fund
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Month Net Profit / Loss
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                summary.netProfitLoss >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {summary.netProfitLoss >= 0 ? (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5" /> Surplus
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3.5 w-3.5" /> Deficit
                </>
              )}
            </span>
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums ${
              summary.netProfitLoss >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatINR(summary.netProfitLoss, true)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            In {formatINR(summary.totalIncome)} · Out {formatINR(summary.totalExpenses)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Safe-to-Spend Today
            </span>
            <span className="text-xs font-medium text-teal-700">
              {safeToSpend.daysUntilSalary}d to salary
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-teal-800 tabular-nums">
            {formatINR(safeToSpend.dailySafeAllowance)}
            <span className="text-sm font-normal text-slate-500"> /day</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Holds {formatINR(safeToSpend.upcomingBillsBeforeSalary)} for upcoming bills
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Savings Rate & Discipline
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
              <Flame className="h-3.5 w-3.5 text-amber-600" />{" "}
              {summary.zeroSpendDays} zero-spend days
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {summary.savingsRatePct}%
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Avg daily burn {formatINR(summary.avgDailyExpense)}/day
          </p>
        </div>
      </div>

      {editingBalance && (
        <form
          onSubmit={handleSaveProfileQuick}
          className="rounded-xl border border-teal-200 bg-teal-50/40 p-5"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Month Opening Liquid Balance (₹)
              </label>
              <input
                type="number"
                value={draftOpening}
                onChange={(e) => setDraftOpening(e.target.value)}
                className="mt-1 w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Protected Emergency Fund (₹)
              </label>
              <input
                type="number"
                value={draftEmergency}
                onChange={(e) => setDraftEmergency(e.target.value)}
                className="mt-1 w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Salary Credit Day (1-28)
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={draftSalaryDay}
                onChange={(e) => setDraftSalaryDay(e.target.value)}
                className="mt-1 w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              Update Living Model
            </button>
          </div>
        </form>
      )}

      {/* Main 2-Column Workspace: Daily Logger + Monthly Daily Calendar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Per-Day Expense / Income Logger + Selected Day Entries */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Log Daily Entry
                </h2>
                <p className="text-xs text-slate-500">
                  Save expenses per day; export full monthly P&L CSV anytime.
                </p>
              </div>
              <span className="font-mono text-xs font-medium text-teal-700 tabular-nums">
                {selectedDate}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              {/* Segmented Type Selector */}
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {(["expense", "income", "transfer"] as TransactionType[]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTxType(t);
                        if (t === "income") setCategory("Salary / Income");
                        else if (t === "transfer") setCategory("Transfer");
                        else if (
                          category === "Salary / Income" ||
                          category === "Transfer"
                        )
                          setCategory("Dining");
                      }}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                        txType === t
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {t}
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 350"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {workHoursCost && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                  <span>
                    Work-hour perspective:{" "}
                    <strong className="font-mono text-slate-900">
                      {workHoursCost} hrs
                    </strong>{" "}
                    of work at {formatINR(hourlyRate)}/hr
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Merchant / Item Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campus Cafe, Vegetables, Freelance Invoice"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="Context for your end-of-month CSV"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Save Entry for {selectedDate}
              </button>
            </form>
          </div>

          {/* Selected Day Entries Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Entries on {selectedDate}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  Day P&L:{" "}
                  <span
                    className={
                      (selectedDayLedger?.netPL || 0) >= 0
                        ? "font-medium text-emerald-700"
                        : "font-medium text-red-700"
                    }
                  >
                    {formatINR(selectedDayLedger?.netPL || 0, true)}
                  </span>{" "}
                  · End balance {formatINR(selectedDayLedger?.runningBalance || 0)}
                </p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {selectedDayTransactions.length} item(s)
              </span>
            </div>

            {selectedDayTransactions.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Zero expenses logged on {selectedDate}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Use the form above to record a transaction for this day.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {selectedDayTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {tx.merchant}
                      </p>
                      <p className="text-xs text-slate-500">
                        {tx.category} · {tx.paymentMode}
                        {tx.notes ? ` · ${tx.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-mono text-sm font-semibold tabular-nums ${
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
                          ? formatINR(tx.amount)
                          : `-${formatINR(tx.amount)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx.id)}
                        title="Delete entry"
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Interactive Daily Calendar + Category Drift + Living Assumptions */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Daily Expense & Cash-Flow Calendar
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Click any day to log or review daily entries · {daysInMonth} days
              </p>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-500">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDayOffset }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="h-20 rounded-lg bg-slate-50/60"
                />
              ))}

              {summary.dailyLedger.map((day) => {
                const isSelected = day.date === selectedDate;
                const hasActivity = day.entriesCount > 0;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={`flex h-20 flex-col justify-between rounded-lg border p-2 text-left transition-colors ${
                      isSelected
                        ? "border-teal-600 bg-teal-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          isSelected ? "text-teal-800" : "text-slate-700"
                        }`}
                      >
                        {day.dayNumber}
                      </span>
                      {hasActivity && (
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                          {day.entriesCount}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      {day.income > 0 && (
                        <div className="truncate font-mono text-[10px] font-medium text-emerald-700 tabular-nums">
                          +{formatINR(day.income)}
                        </div>
                      )}
                      {day.expense > 0 ? (
                        <div className="truncate font-mono text-[11px] font-medium text-slate-900 tabular-nums">
                          -{formatINR(day.expense)}
                        </div>
                      ) : (
                        day.income === 0 && (
                          <div className="text-[10px] text-slate-400">₹0</div>
                        )
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Budget Drift */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Spending Drift & Remaining Allowance
                </h2>
                <p className="text-xs text-slate-500">
                  Compares actual category spending against your approved monthly plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("report")}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
              >
                Full P&L Report →
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {driftCategories.map((c) => {
                const barWidth = Math.min(100, c.pctUsed);
                const barColor =
                  c.status === "Exceeded"
                    ? "bg-red-600"
                    : c.status === "Trending Over"
                    ? "bg-amber-500"
                    : "bg-teal-600";
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {c.category}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span
                          className={`font-medium ${
                            c.status === "Exceeded"
                              ? "text-red-700"
                              : c.status === "Trending Over"
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="font-mono text-slate-700 tabular-nums">
                        {formatINR(c.actual)}{" "}
                        <span className="text-slate-400">
                          / {formatINR(c.budget)}
                        </span>{" "}
                        <span
                          className={
                            c.variance >= 0 ? "text-emerald-700" : "text-red-700"
                          }
                        >
                          ({c.variance >= 0
                            ? `${formatINR(c.variance)} left`
                            : `${formatINR(Math.abs(c.variance))} over`})
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transparent Living Assumptions & Quick Shortcuts */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-teal-700" />
                Living Model Assumptions
              </div>
              <ul className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                <li className="flex justify-between">
                  <span>Opening Liquid Balance</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {formatINR(profile.openingAvailableBalance)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Internal Transfers Excluded</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {formatINR(summary.totalTransfers)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Last Profile Confirmation</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {profile.lastUpdated}
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  {summary.unexplainedCount > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  Review & Cash-Flow Check
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {summary.unexplainedCount > 0
                    ? `${summary.unexplainedCount} ambiguous transaction(s) waiting for category confirmation.`
                    : "All logged transactions have confirmed categories."}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab("transactions")}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
                >
                  Review Queue →
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab("radar")}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
                >
                  Open Shock Radar →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
