import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  Download,
  FileSpreadsheet,
  ListFilter,
  Menu,
  Radar,
  Settings,
  Target,
  Upload,
  X,
} from "lucide-react";
import {
  INITIAL_BUDGETS,
  INITIAL_GOALS,
  INITIAL_PROFILE,
  INITIAL_RECURRING,
  INITIAL_RULES,
  INITIAL_TRANSACTIONS,
} from "./data/seedData";
import type {
  AppTab,
  Category,
  CategoryBudget,
  CategoryRule,
  FinancialGoal,
  FinancialProfile,
  ImportCandidate,
  RecurringCommitment,
  Transaction,
} from "./types/finance";
import {
  buildMonthlyProfitLossCSV,
  buildMonthlySummary,
  formatINR,
  normalizeMerchant,
} from "./utils/financeEngine";
import { OverviewDailyView } from "./components/OverviewDailyView";
import { ImportPipelineView } from "./components/ImportPipelineView";
import { TransactionsRulesView } from "./components/TransactionsRulesView";
import { ShockRadarView } from "./components/ShockRadarView";
import { GoalsWhatIfView } from "./components/GoalsWhatIfView";
import { MonthlyReportView } from "./components/MonthlyReportView";
import { ProfileSettingsModal } from "./components/ProfileSettingsModal";

const STORAGE_KEY = "moneymap_living_model_v1";

interface PersistedState {
  profile: FinancialProfile;
  transactions: Transaction[];
  rules: CategoryRule[];
  recurring: RecurringCommitment[];
  goals: FinancialGoal[];
  budgets: CategoryBudget[];
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.profile && Array.isArray(parsed.transactions)) {
        return {
          profile: parsed.profile,
          transactions: parsed.transactions,
          rules: parsed.rules || INITIAL_RULES,
          recurring: parsed.recurring || INITIAL_RECURRING,
          goals: parsed.goals || INITIAL_GOALS,
          budgets: parsed.budgets || INITIAL_BUDGETS,
        };
      }
    }
  } catch {
    // Fallback to initial seed data
  }
  return {
    profile: INITIAL_PROFILE,
    transactions: INITIAL_TRANSACTIONS,
    rules: INITIAL_RULES,
    recurring: INITIAL_RECURRING,
    goals: INITIAL_GOALS,
    budgets: INITIAL_BUDGETS,
  };
}

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Daily Log & Model", icon: CalendarCheck2 },
  { id: "import", label: "Import & Preview", icon: Upload },
  { id: "transactions", label: "Transactions & Rules", icon: ListFilter },
  { id: "radar", label: "Shock Radar", icon: Radar },
  { id: "goals", label: "Goals & What-Ifs", icon: Target },
  { id: "report", label: "Monthly P&L + CSV", icon: FileSpreadsheet },
];

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadInitialState());
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-11");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>(["2026-11", "2026-10"]);
    for (const tx of state.transactions) {
      if (tx.date.length >= 7) set.add(tx.date.slice(0, 7));
    }
    return Array.from(set).sort().reverse();
  }, [state.transactions]);

  const summary = useMemo(
    () =>
      buildMonthlySummary(
        selectedMonth,
        state.transactions,
        state.budgets,
        state.profile
      ),
    [selectedMonth, state.transactions, state.budgets, state.profile]
  );

  const reviewCount = useMemo(
    () =>
      state.transactions.filter(
        (t) => t.date.startsWith(selectedMonth) && t.needsReview
      ).length,
    [state.transactions, selectedMonth]
  );

  const handleAddTransaction = (tx: Omit<Transaction, "id">) => {
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
      profile: {
        ...prev.profile,
        lastUpdated: new Date().toISOString().slice(0, 10),
      },
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const handleCommitImport = (
    candidates: ImportCandidate[],
    source: "csv" | "sms"
  ) => {
    const batchId = `batch-${Date.now()}`;
    const created: Transaction[] = candidates.map((c, idx) => ({
      id: `tx-imp-${Date.now()}-${idx}`,
      date: c.date,
      merchant: c.merchant,
      rawDescription: c.rawDescription,
      amount: c.amount,
      type: c.type,
      category: c.category,
      paymentMode: c.paymentMode,
      source,
      ruleApplied: c.ruleApplied,
      needsReview: c.needsReview,
      confidence: c.confidence,
      importBatchId: batchId,
    }));

    setState((prev) => ({
      ...prev,
      transactions: [...created, ...prev.transactions],
      profile: {
        ...prev.profile,
        lastUpdated: new Date().toISOString().slice(0, 10),
      },
    }));
  };

  const handleChangeCategorySingle = (txId: string, category: Category) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === txId
          ? {
              ...t,
              category,
              needsReview: false,
              ruleApplied: "Manual edit",
            }
          : t
      ),
    }));
  };

  const handleCreateRuleAndApply = (
    merchantPattern: string,
    category: Category,
    applyToMatching: boolean
  ) => {
    const cleanPattern = normalizeMerchant(merchantPattern) || merchantPattern;
    const targetType: Transaction['type'] =
      category === "Salary / Income" || category === "Freelance / Bonus"
        ? "income"
        : category === "Transfer"
        ? "transfer"
        : "expense";

    setState((prev) => {
      let matchCount = 0;
      const updatedTransactions = prev.transactions.map((tx) => {
        const hay = `${tx.merchant} ${tx.rawDescription}`.toUpperCase();
        if (applyToMatching && hay.includes(cleanPattern.toUpperCase())) {
          matchCount += 1;
          return {
            ...tx,
            category,
            type: targetType,
            needsReview: false,
            ruleApplied: `User rule: ${cleanPattern}`,
          };
        }
        return tx;
      });

      const existingRuleIndex = prev.rules.findIndex(
        (r) => r.merchantPattern.toUpperCase() === cleanPattern.toUpperCase()
      );

      let nextRules = [...prev.rules];
      if (existingRuleIndex >= 0) {
        nextRules[existingRuleIndex] = {
          ...nextRules[existingRuleIndex],
          targetCategory: category,
          targetType,
          matchCount: Math.max(1, matchCount),
        };
      } else {
        nextRules = [
          {
            id: `rule-${Date.now()}`,
            merchantPattern: cleanPattern,
            targetCategory: category,
            targetType,
            createdAt: new Date().toISOString().slice(0, 10),
            matchCount: Math.max(1, matchCount),
          },
          ...nextRules,
        ];
      }

      return {
        ...prev,
        transactions: updatedTransactions,
        rules: nextRules,
      };
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    setState((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
    }));
  };

  const handleAddGoal = (goal: Omit<FinancialGoal, "id">) => {
    setState((prev) => ({
      ...prev,
      goals: [...prev.goals, { ...goal, id: `goal-${Date.now()}` }],
    }));
  };

  const handleUpdateGoal = (id: string, patch: Partial<FinancialGoal>) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  };

  const handleDeleteGoal = (id: string) => {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }));
  };

  const handleUpdateRecurringStatus = (
    id: string,
    userStillUsing: RecurringCommitment["userStillUsing"]
  ) => {
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.map((r) =>
        r.id === id ? { ...r, userStillUsing } : r
      ),
    }));
  };

  const handleAddRecurringFromCandidate = (candidate: {
    merchant: string;
    latestAmount: number;
    previousAmount?: number;
    category: Category;
  }) => {
    setState((prev) => ({
      ...prev,
      recurring: [
        ...prev.recurring,
        {
          id: `rec-${Date.now()}`,
          name: candidate.merchant,
          merchantPattern: candidate.merchant,
          amount: candidate.latestAmount,
          previousAmount: candidate.previousAmount,
          dueDay: 15,
          frequency: "monthly",
          category: candidate.category,
          confirmed: true,
          userStillUsing: "yes",
          isEssential: false,
        },
      ],
    }));
  };

  const handleQuickExportCsv = () => {
    const csv = buildMonthlyProfitLossCSV(
      selectedMonth,
      summary,
      state.transactions,
      state.goals,
      state.profile
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `MoneyMap_Monthly_PL_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label || "Overview";

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
        <div>
          <div className="flex h-16 items-center border-b border-slate-200 px-6">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              MoneyMap
            </span>
          </div>

          <nav className="space-y-1 p-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? "text-teal-700" : "text-slate-400"
                      }`}
                    />
                    {item.label}
                  </span>
                  {item.id === "transactions" && reviewCount > 0 && (
                    <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums">
                      {reviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile Footer inside Sidebar */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {state.profile.name}
              </div>
              <div className="font-mono text-xs text-slate-500 tabular-nums">
                Emergency: {formatINR(state.profile.emergencyFundBalance)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Edit financial profile & data controls"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 flex w-64 flex-col justify-between bg-white p-4 shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <span className="font-display text-lg font-bold text-slate-900">
                  MoneyMap
                </span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive
                          ? "bg-teal-50 text-teal-800"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setSettingsOpen(true);
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
            >
              <Settings className="h-4 w-4" /> Profile & Data Controls
            </button>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb on left, Month selector & primary CSV export on right */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 truncate text-sm">
              <span className="font-display font-semibold text-slate-900 lg:hidden">
                MoneyMap
              </span>
              <span className="text-slate-300 lg:hidden">/</span>
              <span className="font-display font-semibold text-slate-900 truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              aria-label="Select active month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleQuickExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Export Monthly CSV
            </button>
          </div>
        </header>

        {/* Active Workspace Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {activeTab === "overview" && (
            <OverviewDailyView
              selectedMonth={selectedMonth}
              profile={state.profile}
              summary={summary}
              transactions={state.transactions}
              recurring={state.recurring}
              goals={state.goals}
              onAddTransaction={handleAddTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateProfile={(patch) =>
                setState((prev) => ({
                  ...prev,
                  profile: { ...prev.profile, ...patch },
                }))
              }
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === "import" && (
            <ImportPipelineView
              existingTransactions={state.transactions}
              rules={state.rules}
              onCommitImport={handleCommitImport}
            />
          )}

          {activeTab === "transactions" && (
            <TransactionsRulesView
              selectedMonth={selectedMonth}
              transactions={state.transactions}
              rules={state.rules}
              onChangeCategorySingle={handleChangeCategorySingle}
              onCreateRuleAndApply={handleCreateRuleAndApply}
              onDeleteRule={handleDeleteRule}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === "radar" && (
            <ShockRadarView
              profile={state.profile}
              currentAvailableBalance={summary.projectedEndBalance}
              recurring={state.recurring}
              goals={state.goals}
            />
          )}

          {activeTab === "goals" && (
            <GoalsWhatIfView
              goals={state.goals}
              summary={summary}
              onAddGoal={handleAddGoal}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          )}

          {activeTab === "report" && (
            <MonthlyReportView
              selectedMonth={selectedMonth}
              profile={state.profile}
              summary={summary}
              transactions={state.transactions}
              recurring={state.recurring}
              goals={state.goals}
              onUpdateRecurringStatus={handleUpdateRecurringStatus}
              onAddRecurringFromCandidate={handleAddRecurringFromCandidate}
            />
          )}
        </main>
      </div>

      {settingsOpen && (
        <ProfileSettingsModal
          profile={state.profile}
          onSaveProfile={(nextProfile) =>
            setState((prev) => ({ ...prev, profile: nextProfile }))
          }
          onLoadSampleData={() =>
            setState({
              profile: INITIAL_PROFILE,
              transactions: INITIAL_TRANSACTIONS,
              rules: INITIAL_RULES,
              recurring: INITIAL_RECURRING,
              goals: INITIAL_GOALS,
              budgets: INITIAL_BUDGETS,
            })
          }
          onClearAllData={() =>
            setState((prev) => ({
              ...prev,
              transactions: [],
              rules: [],
              recurring: [],
              goals: [],
              profile: {
                ...prev.profile,
                openingAvailableBalance: 0,
                emergencyFundBalance: 0,
              },
            }))
          }
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
