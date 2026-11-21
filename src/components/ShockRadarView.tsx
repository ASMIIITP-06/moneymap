import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Radar,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  FinancialGoal,
  FinancialProfile,
  RecurringCommitment,
} from "../types/finance";
import { formatINR, runShockRadarSimulation } from "../utils/financeEngine";

interface ShockRadarViewProps {
  profile: FinancialProfile;
  currentAvailableBalance: number;
  recurring: RecurringCommitment[];
  goals: FinancialGoal[];
}

export const ShockRadarView: React.FC<ShockRadarViewProps> = ({
  profile,
  currentAvailableBalance,
  recurring,
  goals,
}) => {
  const [demoPresetActive, setDemoPresetActive] = useState(false);
  const [salaryDelayDays, setSalaryDelayDays] = useState(0);
  const [includeEmergencyFund, setIncludeEmergencyFund] = useState(false);
  const [pauseVoluntaryGoals, setPauseVoluntaryGoals] = useState(false);
  const [dailyDiscretionarySpend, setDailyDiscretionarySpend] = useState(350);
  const [unexpectedBillAmount, setUnexpectedBillAmount] = useState(0);
  const [unexpectedBillDayOffset, setUnexpectedBillDayOffset] = useState(4);

  const simulation = useMemo(() => {
    if (demoPresetActive) {
      // Exact concrete demo from Product Plan Page 11:
      // Opening ₹12,000, Rent ₹10,000 on Day 3, Other bill ₹4,000 on Day 5, Salary ₹40,000 on Day 7
      const demoRecurring: RecurringCommitment[] = [
        {
          id: "demo-rent",
          name: "Rent Payment",
          merchantPattern: "RENT",
          amount: 10000,
          dueDay: 3,
          frequency: "monthly",
          category: "Rent & Housing",
          confirmed: true,
          userStillUsing: "yes",
          isEssential: true,
        },
        {
          id: "demo-bill",
          name: "Scheduled Utility Bill",
          merchantPattern: "BILL",
          amount: 4000,
          dueDay: 5,
          frequency: "monthly",
          category: "Utilities & Bills",
          confirmed: true,
          userStillUsing: "yes",
          isEssential: true,
        },
      ];
      return runShockRadarSimulation({
        startDate: "2026-12-01",
        openingAvailableBalance: 12000,
        includeEmergencyFund,
        emergencyFundBalance: profile.emergencyFundBalance,
        monthlyIncome: 40000,
        salaryDay: 7,
        salaryDelayDays,
        recurring: demoRecurring,
        goals: [],
        pauseVoluntaryGoals,
        dailyDiscretionarySpend: 0,
        unexpectedBillAmount,
        unexpectedBillDayOffset,
      });
    }

    return runShockRadarSimulation({
      startDate: "2026-11-22",
      openingAvailableBalance: currentAvailableBalance,
      includeEmergencyFund,
      emergencyFundBalance: profile.emergencyFundBalance,
      monthlyIncome: profile.monthlyIncome,
      salaryDay: profile.salaryDay,
      salaryDelayDays,
      recurring,
      goals,
      pauseVoluntaryGoals,
      dailyDiscretionarySpend,
      unexpectedBillAmount,
      unexpectedBillDayOffset,
    });
  }, [
    demoPresetActive,
    includeEmergencyFund,
    profile,
    salaryDelayDays,
    pauseVoluntaryGoals,
    unexpectedBillAmount,
    unexpectedBillDayOffset,
    currentAvailableBalance,
    recurring,
    goals,
    dailyDiscretionarySpend,
  ]);

  const resetControls = () => {
    setSalaryDelayDays(0);
    setIncludeEmergencyFund(false);
    setPauseVoluntaryGoals(false);
    setDailyDiscretionarySpend(demoPresetActive ? 0 : 350);
    setUnexpectedBillAmount(0);
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <Radar className="mt-0.5 h-5 w-5 text-teal-700 shrink-0" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Cash-Flow Shock Radar (30-Day Timing Forecast)
            </h2>
            <p className="text-xs text-slate-600">
              Detects timing shortfalls before a positive monthly total hides them. Emergency fund is excluded unless you toggle it.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setDemoPresetActive(false);
              setDailyDiscretionarySpend(350);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              !demoPresetActive
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Living Model
          </button>
          <button
            type="button"
            onClick={() => {
              setDemoPresetActive(true);
              setDailyDiscretionarySpend(0);
              setSalaryDelayDays(0);
              setUnexpectedBillAmount(0);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              demoPresetActive
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Timing Shortfall Demo
          </button>
        </div>
      </div>

      {/* Diagnostic KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Starting Runway Cash
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {formatINR(simulation.startingBalance)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {includeEmergencyFund
              ? "Includes protected emergency fund"
              : "Protected emergency fund excluded"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Estimated Lowest Balance
          </div>
          <div
            className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
              simulation.lowestBalance < 0
                ? "text-red-700"
                : simulation.lowestBalance < 3000
                ? "text-amber-700"
                : "text-slate-900"
            }`}
          >
            {formatINR(simulation.lowestBalance)}
          </div>
          <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            Projected on {simulation.lowestBalanceDate}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            First Shortfall Date
          </div>
          <div
            className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
              simulation.firstShortfallDate ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {simulation.firstShortfallDate || "None"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {simulation.firstShortfallDate
              ? `${simulation.shortfallDaysCount} negative day(s) detected`
              : "Balance stays above ₹0 across 30 days"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Day-30 Ending Balance
          </div>
          <div
            className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
              simulation.endingBalance >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatINR(simulation.endingBalance)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Forecast based on entered assumptions
          </div>
        </div>
      </div>

      {/* Main Chart + Stress-Test Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                30-Day Running Balance Projection
              </h3>
              <p className="text-xs text-slate-500">
                Illustrative forecast from confirmed income timing, bills, and daily discretionary burn.
              </p>
            </div>
            {simulation.firstShortfallDate ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <ShieldAlert className="h-4 w-4" />
                Shortfall Alert on {simulation.firstShortfallDate}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Cash-Flow Healthy
              </span>
            )}
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={simulation.days}
                margin={{ top: 10, right: 12, left: 6, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="radarTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatINR(Number(value)), "Projected Balance"]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    if (!row) return String(label);
                    return `${row.date}${
                      row.events.length ? ` · ${row.events.join(" | ")}` : ""
                    }`;
                  }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine y={0} stroke="#DC2626" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#0F766E"
                  strokeWidth={2}
                  fill="url(#radarTeal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Key Scheduled Events Causing Outflows */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold text-slate-900">
              Scheduled Outflows & Shortfall Drivers in This 30-Day Window
            </h4>
            {simulation.days.filter((d) => d.events.length > 0).length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No scheduled bills or salary events fall in this window.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {simulation.days
                  .filter((d) => d.events.length > 0)
                  .slice(0, 8)
                  .map((d) => (
                    <div
                      key={d.date}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                        d.isShortfall
                          ? "border-red-200 bg-red-50/70"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-mono font-medium text-slate-900 tabular-nums">
                          {d.date}
                        </div>
                        <div className="truncate text-[11px] text-slate-600">
                          {d.events.join(" · ")}
                        </div>
                      </div>
                      <div
                        className={`font-mono font-semibold tabular-nums shrink-0 ${
                          d.isShortfall ? "text-red-700" : "text-slate-900"
                        }`}
                      >
                        {formatINR(d.balance)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Stress-Test & User-Controlled Options */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Stress-Test Controls
              </h3>
              <button
                type="button"
                onClick={resetControls}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Salary Delayed By</span>
                <span className="font-mono text-slate-900 tabular-nums">
                  {salaryDelayDays} days
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={14}
                value={salaryDelayDays}
                onChange={(e) => setSalaryDelayDays(Number(e.target.value))}
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Daily Discretionary Spend</span>
                <span className="font-mono text-slate-900 tabular-nums">
                  {formatINR(dailyDiscretionarySpend)}/day
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1500}
                step={50}
                value={dailyDiscretionarySpend}
                onChange={(e) =>
                  setDailyDiscretionarySpend(Number(e.target.value))
                }
                className="mt-1.5 w-full accent-teal-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Unexpected Bill (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={unexpectedBillAmount}
                  onChange={(e) =>
                    setUnexpectedBillAmount(Math.max(0, Number(e.target.value)))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Occurs in (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={29}
                  value={unexpectedBillDayOffset}
                  onChange={(e) =>
                    setUnexpectedBillDayOffset(
                      Math.min(29, Math.max(0, Number(e.target.value)))
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-2.5 border-t border-slate-100 pt-3">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-slate-700">
                <span>Pause voluntary goal transfers</span>
                <input
                  type="checkbox"
                  checked={pauseVoluntaryGoals}
                  onChange={(e) => setPauseVoluntaryGoals(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-slate-700">
                <span>Include protected emergency fund</span>
                <input
                  type="checkbox"
                  checked={includeEmergencyFund}
                  onChange={(e) => setIncludeEmergencyFund(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
              </label>
            </div>
          </div>

          {/* User-Controlled Mitigation Guidance */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              User-Controlled Options
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {simulation.firstShortfallDate
                ? `Even if the month ends at ${formatINR(
                    simulation.endingBalance
                  )}, cash dips to ${formatINR(
                    simulation.firstShortfallAmount || 0
                  )} on ${
                    simulation.firstShortfallDate
                  }. Try pausing voluntary goal transfers or reducing daily discretionary spend above.`
                : "No timing shortfall detected under these assumptions. Try sliding Salary Delay to +7 days to verify your buffer resilience."}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              MoneyMap never moves money, cancels a bill, or assumes credit without your explicit action.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
