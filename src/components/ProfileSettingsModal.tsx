import React, { useState } from "react";
import { RotateCcw, Shield, Trash2, X } from "lucide-react";
import type { FinancialProfile } from "../types/finance";

interface ProfileSettingsModalProps {
  profile: FinancialProfile;
  onSaveProfile: (next: FinancialProfile) => void;
  onLoadSampleData: () => void;
  onClearAllData: () => void;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  profile,
  onSaveProfile,
  onLoadSampleData,
  onClearAllData,
  onClose,
}) => {
  const [name, setName] = useState(profile.name);
  const [opening, setOpening] = useState(String(profile.openingAvailableBalance));
  const [emergency, setEmergency] = useState(String(profile.emergencyFundBalance));
  const [income, setIncome] = useState(String(profile.monthlyIncome));
  const [salaryDay, setSalaryDay] = useState(String(profile.salaryDay));
  const [workHours, setWorkHours] = useState(String(profile.workHoursPerMonth));
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      ...profile,
      name: name.trim() || "MoneyMap User",
      openingAvailableBalance: Number(opening) || 0,
      emergencyFundBalance: Number(emergency) || 0,
      monthlyIncome: Number(income) || 0,
      salaryDay: Math.min(28, Math.max(1, Number(salaryDay) || 5)),
      workHoursPerMonth: Math.max(1, Number(workHours) || 160),
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-teal-700" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Living Financial Profile & Data Controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Profile Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Opening Liquid Balance (₹)
              </label>
              <input
                type="number"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Protected Emergency Fund (₹)
              </label>
              <input
                type="number"
                value={emergency}
                onChange={(e) => setEmergency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Monthly Salary (₹)
              </label>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Salary Day
              </label>
              <input
                type="number"
                min={1}
                max={28}
                value={salaryDay}
                onChange={(e) => setSalaryDay(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Work Hours/Mo
              </label>
              <input
                type="number"
                min={1}
                value={workHours}
                onChange={(e) => setWorkHours(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Data is stored locally in your browser. No banking credentials, passwords, or OTPs are ever stored.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onLoadSampleData();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Sample Data
              </button>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClearAllData();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Confirm Wipe All
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                Save Profile
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
