import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
  Lock,
  MessageSquareText,
  Upload,
} from "lucide-react";
import {
  ALL_CATEGORIES,
  type Category,
  type CategoryRule,
  type ImportCandidate,
  type Transaction,
  type TransactionType,
} from "../types/finance";
import { SAMPLE_CSV_SNIPPET, SAMPLE_SMS_SNIPPET } from "../data/seedData";
import {
  formatINR,
  parseCsvStatement,
  parseSmsText,
} from "../utils/financeEngine";

interface ImportPipelineViewProps {
  existingTransactions: Transaction[];
  rules: CategoryRule[];
  onCommitImport: (candidates: ImportCandidate[], source: "csv" | "sms") => void;
}

export const ImportPipelineView: React.FC<ImportPipelineViewProps> = ({
  existingTransactions,
  rules,
  onCommitImport,
}) => {
  const [mode, setMode] = useState<"sms" | "csv">("sms");
  const [smsText, setSmsText] = useState(SAMPLE_SMS_SNIPPET);
  const [csvText, setCsvText] = useState(SAMPLE_CSV_SNIPPET);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [committedMessage, setCommittedMessage] = useState<string | null>(null);

  const handleParse = () => {
    setCommittedMessage(null);
    const parsed =
      mode === "sms"
        ? parseSmsText(smsText, rules, existingTransactions)
        : parseCsvStatement(csvText, rules, existingTransactions);
    setCandidates(parsed);
    setHasParsed(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      setCsvText(content);
      setMode("csv");
      const parsed = parseCsvStatement(content, rules, existingTransactions);
      setCandidates(parsed);
      setHasParsed(true);
      setCommittedMessage(null);
    };
    reader.readAsText(file);
  };

  const updateCandidate = (
    tempId: string,
    patch: Partial<ImportCandidate>
  ) => {
    setCandidates((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c))
    );
  };

  const selectedCount = candidates.filter((c) => c.selected).length;

  const handleCommit = () => {
    const toSave = candidates.filter((c) => c.selected);
    if (toSave.length === 0) return;
    onCommitImport(toSave, mode);
    setCommittedMessage(
      `Imported ${toSave.length} validated transaction(s) into your living money model.`
    );
    setCandidates([]);
    setHasParsed(false);
  };

  return (
    <div className="space-y-6">
      {/* Privacy & Guardrails Notice */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 text-teal-700 shrink-0" />
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Reviewable Import Pipeline — Explicit Consent & Zero Credentials
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              MoneyMap never requests bank passwords, PINs, or OTPs. Statements and pasted SMS are parsed locally, deduplicated, and previewed before saving.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("sms");
              setHasParsed(false);
              setCandidates([]);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              mode === "sms"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            Paste Transaction SMS
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("csv");
              setHasParsed(false);
              setCandidates([]);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              mode === "csv"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            CSV Bank Statement
          </button>
        </div>
      </div>

      {committedMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <Check className="h-4 w-4 shrink-0" />
          <span>{committedMessage}</span>
        </div>
      )}

      {/* Input Zone */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {mode === "sms" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Paste Bank or UPI Alert SMS (one per line)
                </h3>
                <p className="text-xs text-slate-500">
                  Extracts date, amount, debit/credit direction, and normalized merchant while masking account digits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSmsText(SAMPLE_SMS_SNIPPET)}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                Load Sample SMS
              </button>
            </div>
            <textarea
              rows={5}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              placeholder="Paste bank or UPI transaction SMS lines here..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 p-3 font-mono text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Upload Bank CSV File or Paste CSV Rows
                </h3>
                <p className="text-xs text-slate-500">
                  Supports Date, Description/Narration, Debit, Credit, or Amount columns.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCsvText(SAMPLE_CSV_SNIPPET)}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
                >
                  Load Sample CSV
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                  <Upload className="h-3.5 w-3.5" />
                  Choose .CSV File
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Date,Description,Debit,Credit..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 p-3 font-mono text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleParse}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap"
          >
            Extract & Preview Before Saving
          </button>
        </div>
      </div>

      {/* Preview & Validation Queue */}
      {hasParsed && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Extraction Review Queue
              </h3>
              <p className="text-xs text-slate-500">
                {candidates.length} row(s) extracted ·{" "}
                {candidates.filter((c) => c.isDuplicate).length} potential duplicate(s) unchecked automatically ·{" "}
                {candidates.filter((c) => c.needsReview).length} low-confidence row(s)
              </p>
            </div>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={handleCommit}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              Save {selectedCount} Selected to Ledger
            </button>
          </div>

          {candidates.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-600">
              No valid transaction rows were detected. Ensure amounts and dates are formatted clearly.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-medium">Keep</th>
                    <th className="py-2.5 pr-3 font-medium">Date</th>
                    <th className="py-2.5 pr-3 font-medium">Normalized Merchant</th>
                    <th className="py-2.5 pr-3 font-medium">Type</th>
                    <th className="py-2.5 pr-3 font-medium">Category</th>
                    <th className="py-2.5 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2.5 pl-3 font-medium">Confidence / Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c) => (
                    <tr
                      key={c.tempId}
                      className={c.isDuplicate ? "bg-amber-50/50" : "hover:bg-slate-50"}
                    >
                      <td className="py-2.5 pr-3">
                        <input
                          type="checkbox"
                          checked={c.selected}
                          onChange={(e) =>
                            updateCandidate(c.tempId, {
                              selected: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {c.date}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">
                          {c.merchant}
                        </div>
                        <div className="max-w-xs truncate text-[11px] text-slate-400">
                          {c.rawDescription}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          value={c.type}
                          onChange={(e) =>
                            updateCandidate(c.tempId, {
                              type: e.target.value as TransactionType,
                            })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          value={c.category}
                          onChange={(e) =>
                            updateCandidate(c.tempId, {
                              category: e.target.value as Category,
                              needsReview: false,
                            })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                        >
                          {ALL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatINR(c.amount)}
                      </td>
                      <td className="py-2.5 pl-3 whitespace-nowrap">
                        {c.isDuplicate ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Duplicate Detected
                          </span>
                        ) : c.needsReview ? (
                          <span className="font-medium text-amber-700">
                            Needs Review · {Math.round(c.confidence * 100)}%
                          </span>
                        ) : (
                          <span className="text-emerald-700">
                            {c.ruleApplied || "Matched"} ·{" "}
                            {Math.round(c.confidence * 100)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
