import React, { useMemo, useState } from "react";
import { Plus, SlidersHorizontal, Target, Trash2 } from "lucide-react";
import type {
  FinancialGoal,
  MonthlySummary,
} from "../types/finance";
import { formatINR } from "../utils/financeEngine";

interface GoalsWhatIfViewProps {
  goals: FinancialGoal[];
  summary: MonthlySummary;
  onAddGoal: (goal: Omit<FinancialGoal, "id">) => void;
  onUpdateGoal: (id: string, patch: Partial<FinancialGoal>) => void;
  onDeleteGoal: (id: string) => void;
}

function monthsBetween(fromYYYYMM: string, toYYYYMM: string): number {
  const [y1, m1] = fromYYYYMM.split("-").map(Number);
  const [y2, m2] = toYYYYMM.split("-").map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 12;
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

export const GoalsWhatIfView: React.FC<GoalsWhatIfViewProps> = ({
  goals,
  summary,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}) => {
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newSaved, setNewSaved] = useState("0");
  const [newDeadline, setNewDeadline] = useState("2027-11");
  const [newPriority, setNewPriority] = useState<FinancialGoal["priority"]>("Medium");

  // What-If Simulator state (PDF Page 9)
  const [diningCutPct, setDiningCutPct] = useState(30);
  const [rentDelta, setRentDelta] = useState(0);
  const [focusGoalId, setFocusGoalId] = useState(goals[0]?.id || "");

  const diningBaseline = useMemo(() => {
    const row = summary.categoryVariance.find((c) => c.category === "Dining");
    return row ? Math.max(row.actual, row.budget) : 4500;
  }, [summary.categoryVariance]);

  const freedFromDining = Math.round((diningBaseline * diningCutPct) / 100);
  const netScenarioDelta = freedFromDining - rentDelta;
  const currentSurplus = summary.netProfitLoss;
  const totalGoalAllocations = goals.reduce(
    (s, g) => s + g.monthlyAllocation,
    0
  );
  const adjustedAvailableForGoals = currentSurplus + netScenarioDelta;

  const focusGoal = goals.find((g) => g.id === focusGoalId) || goals[0];

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(newTarget);
    const saved = Number(newSaved) || 0;
    if (!newName.trim() || !target || target <= 0) return;

    const months = monthsBetween(summary.month, newDeadline);
    const monthlyAllocation = Math.max(
      100,
      Math.round(Math.max(0, target - saved) / months)
    );

    onAddGoal({
      name: newName.trim(),
      targetAmount: target,
      savedAmount: saved,
      deadline: newDeadline,
      monthlyAllocation,
      priority: newPriority,
    });
    setNewName("");
    setNewTarget("");
    setNewSaved("0");
  };

  return (
    <div className="space-y-6">
      {/* What-If Trade-Off Simulator (PDF Page 9) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-teal-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                What-If Goal Trade-Off Simulator
              </h2>
              <p className="text-xs text-slate-500">
                Scenario estimates assume 0% guaranteed investment return. Changes never silently rewrite your plan until you apply them.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            Current Net Surplus: {formatINR(currentSurplus, true)}/mo
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>What if I cut Dining ({formatINR(diningBaseline)}/mo) by</span>
                <span className="font-mono text-teal-800 tabular-nums">
                  {diningCutPct}% (+{formatINR(freedFromDining)}/mo freed)
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={diningCutPct}
                onChange={(e) => setDiningCutPct(Number(e.target.value))}
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>What if Rent / Fixed Bills change by</span>
                <span
                  className={`font-mono tabular-nums ${
                    rentDelta > 0
                      ? "text-red-700"
                      : rentDelta < 0
                      ? "text-emerald-700"
                      : "text-slate-900"
                  }`}
                >
                  {formatINR(rentDelta, true)}/mo
                </span>
              </div>
              <input
                type="range"
                min={-3000}
                max={8000}
                step={500}
                value={rentDelta}
                onChange={(e) => setRentDelta(Number(e.target.value))}
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>

            {goals.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Direct freed cash toward goal
                </label>
                <select
                  value={focusGoal?.id || ""}
                  onChange={(e) => setFocusGoalId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (Remaining:{" "}
                      {formatINR(Math.max(0, g.targetAmount - g.savedAmount))})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-6 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Net Monthly Cash Impact</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    netScenarioDelta >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {formatINR(netScenarioDelta, true)} / month
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Available Surplus After Scenario
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatINR(adjustedAvailableForGoals)} / month
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  Current Planned Goal Allocations
                </span>
                <span className="font-mono text-slate-700 tabular-nums">
                  {formatINR(totalGoalAllocations)} / month
                </span>
              </div>

              {focusGoal && (
                <div className="border-t border-slate-200 pt-2.5 text-xs text-slate-700">
                  {(() => {
                    const remaining = Math.max(
                      0,
                      focusGoal.targetAmount - focusGoal.savedAmount
                    );
                    const baseMonths =
                      focusGoal.monthlyAllocation > 0
                        ? Math.ceil(remaining / focusGoal.monthlyAllocation)
                        : 0;
                    const newAlloc = Math.max(
                      500,
                      focusGoal.monthlyAllocation + netScenarioDelta
                    );
                    const newMonths = Math.ceil(remaining / newAlloc);
                    const diffMonths = baseMonths - newMonths;
                    return (
                      <p>
                        Applying{" "}
                        <strong className="font-mono">
                          {formatINR(netScenarioDelta, true)}/mo
                        </strong>{" "}
                        to <strong>{focusGoal.name}</strong> changes your monthly
                        contribution from{" "}
                        <span className="font-mono">
                          {formatINR(focusGoal.monthlyAllocation)}
                        </span>{" "}
                        to{" "}
                        <span className="font-mono">{formatINR(newAlloc)}</span>{" "}
                        —{" "}
                        {diffMonths > 0
                          ? `reaching your target ${diffMonths} month(s) sooner (${newMonths} mo total).`
                          : diffMonths < 0
                          ? `extending your timeline by ${Math.abs(
                              diffMonths
                            )} month(s) (${newMonths} mo total).`
                          : `keeping timeline at ${baseMonths} month(s).`}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            {focusGoal && netScenarioDelta !== 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const nextAlloc = Math.max(
                      500,
                      focusGoal.monthlyAllocation + netScenarioDelta
                    );
                    onUpdateGoal(focusGoal.id, {
                      monthlyAllocation: nextAlloc,
                    });
                    setRentDelta(0);
                    setDiningCutPct(0);
                  }}
                  className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
                >
                  Apply New Allocation to {focusGoal.name}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Goals Grid + Create New Goal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {goals.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No dated goals yet.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Add a savings target on the right to compute required monthly contributions.
              </p>
            </div>
          ) : (
            goals.map((g) => {
              const remaining = Math.max(0, g.targetAmount - g.savedAmount);
              const pct =
                g.targetAmount > 0
                  ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100))
                  : 0;
              const monthsLeft = monthsBetween(summary.month, g.deadline);
              const requiredMonthly = Math.ceil(remaining / monthsLeft);
              const onPace = g.monthlyAllocation >= requiredMonthly;

              return (
                <div
                  key={g.id}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-teal-700" />
                        <h3 className="font-display text-base font-semibold text-slate-900">
                          {g.name}
                        </h3>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-600">
                          {g.priority} Priority
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        Deadline {g.deadline} ({monthsLeft} months left) · Needs{" "}
                        {formatINR(requiredMonthly)}/mo · Planned{" "}
                        {formatINR(g.monthlyAllocation)}/mo
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateGoal(g.id, {
                            savedAmount: Math.min(
                              g.targetAmount,
                              g.savedAmount + g.monthlyAllocation
                            ),
                          })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        + Record {formatINR(g.monthlyAllocation)}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteGoal(g.id)}
                        title="Remove goal"
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs tabular-nums">
                      <span className="font-mono font-semibold text-slate-900">
                        {formatINR(g.savedAmount)} saved ({pct}%)
                      </span>
                      <span className="font-mono text-slate-500">
                        Target {formatINR(g.targetAmount)} ·{" "}
                        <span
                          className={
                            onPace ? "text-emerald-700" : "text-amber-700"
                          }
                        >
                          {onPace ? "On Pace" : "Shortfall Pace"}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add New Goal Form */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Add Dated Financial Goal
            </h3>
            <form onSubmit={handleCreateGoal} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Goal Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bike Downpayment"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Target (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    placeholder="60000"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Already Saved (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newSaved}
                    onChange={(e) => setNewSaved(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Target Month
                  </label>
                  <input
                    type="month"
                    required
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) =>
                      setNewPriority(e.target.value as FinancialGoal["priority"])
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Add Goal to Plan
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
