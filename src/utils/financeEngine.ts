import type {
  Category,
  CategoryBudget,
  CategoryRule,
  CategoryVarianceRow,
  DailyLedgerRow,
  FinancialGoal,
  FinancialProfile,
  ImportCandidate,
  MonthlySummary,
  PaymentMode,
  RecurringCommitment,
  ShockRadarDay,
  ShockRadarResult,
  Transaction,
  TransactionType,
} from "../types/finance";

export function formatINR(amount: number, showSign = false): string {
  const absVal = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(absVal);
  if (amount < 0) return `-₹${formatted}`;
  if (showSign && amount > 0) return `+₹${formatted}`;
  return `₹${formatted}`;
}

export function normalizeMerchant(raw: string): string {
  return raw
    .replace(/^(UPI|IMPS|NEFT|POS|ATM|BIL|INB)[/\-:\s]*/i, "")
    .replace(/\b\d{6,}\b/g, "")
    .replace(/[*#@_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 40);
}

const DETERMINISTIC_MERCHANT_KEYWORDS: Array<{
  keywords: string[];
  category: Category;
  type: TransactionType;
}> = [
  { keywords: ["RENT", "LANDLORD", "HOUSING", "SOCIETY"], category: "Rent & Housing", type: "expense" },
  { keywords: ["BLINKIT", "ZEPTO", "BIGBASKET", "DMART", "GROCERY", "INSTAMART", "RELIANCE SMART", "MILK"], category: "Groceries", type: "expense" },
  { keywords: ["CAFE", "SWIGGY", "ZOMATO", "STARBUCKS", "CHAI", "RESTAURANT", "CANTEEN", "BIRYANI", "COFFEE", "DINING"], category: "Dining", type: "expense" },
  { keywords: ["ELECTRICITY", "BESCOM", "WATER", "BROADBAND", "JIOFIBER", "AIRTEL", "GAS", "RECHARGE", "BILL"], category: "Utilities & Bills", type: "expense" },
  { keywords: ["UBER", "OLA", "METRO", "RAPIDO", "PETROL", "FUEL", "IRCTC", "BUS", "AUTO"], category: "Transport", type: "expense" },
  { keywords: ["NETFLIX", "SPOTIFY", "PRIME", "YOUTUBE", "HOTSTAR", "OTT", "CLOUD", "SUBSCRIPTION", "GYM"], category: "Subscriptions", type: "expense" },
  { keywords: ["AMAZON", "FLIPKART", "MYNTRA", "MALL", "DECATHLON", "AJIO"], category: "Shopping", type: "expense" },
  { keywords: ["PHARMACY", "APOLLO", "MEDPLUS", "CLINIC", "HOSPITAL", "DOCTOR"], category: "Healthcare", type: "expense" },
  { keywords: ["UDEMY", "COURSERA", "BOOK", "TUITION", "COLLEGE", "EXAM"], category: "Education", type: "expense" },
  { keywords: ["SALARY", "PAYROLL", "STIPEND"], category: "Salary / Income", type: "income" },
  { keywords: ["FREELANCE", "BONUS", "REFUND", "CASHBACK", "DIVIDEND"], category: "Freelance / Bonus", type: "income" },
  { keywords: ["SELF TRANSFER", "OWN ACCOUNT", "CC PAYMENT", "WALLET LOAD", "INTERNAL"], category: "Transfer", type: "transfer" },
];

export function resolveCategoryWithRules(
  merchant: string,
  rawDescription: string,
  userRules: CategoryRule[],
  fallbackType: TransactionType = "expense"
): {
  category: Category;
  type: TransactionType;
  ruleApplied?: string;
  confidence: number;
  needsReview: boolean;
} {
  const haystack = `${merchant} ${rawDescription}`.toUpperCase();

  // Priority 1: Explicit User Rules
  for (const rule of userRules) {
    if (haystack.includes(rule.merchantPattern.toUpperCase())) {
      return {
        category: rule.targetCategory,
        type: rule.targetType,
        ruleApplied: `User rule: ${rule.merchantPattern}`,
        confidence: 0.99,
        needsReview: false,
      };
    }
  }

  // Priority 2: Deterministic Merchant Rules
  for (const entry of DETERMINISTIC_MERCHANT_KEYWORDS) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) {
      return {
        category: entry.category,
        type: entry.type,
        ruleApplied: `Auto-matched (${entry.category})`,
        confidence: 0.88,
        needsReview: false,
      };
    }
  }

  // Priority 3: Needs User Review instead of silent guessing
  return {
    category: fallbackType === "income" ? "Freelance / Bonus" : fallbackType === "transfer" ? "Transfer" : "Other",
    type: fallbackType,
    confidence: 0.45,
    needsReview: true,
  };
}

export function getDaysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

export function buildMonthlySummary(
  month: string,
  transactions: Transaction[],
  budgets: CategoryBudget[],
  profile: FinancialProfile
): MonthlySummary {
  const monthTx = transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));

  const daysInMonth = getDaysInMonth(month);
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalTransfers = 0;
  let fixedCostsTotal = 0;
  let discretionaryTotal = 0;
  let unexplainedCount = 0;

  const fixedCategories = new Set<Category>([
    "Rent & Housing",
    "Utilities & Bills",
    "Subscriptions",
  ]);

  const categorySpendMap = new Map<Category, number>();
  const dailyMap = new Map<
    string,
    { income: number; expense: number; transfer: number; count: number }
  >();

  for (const tx of monthTx) {
    if (tx.needsReview) unexplainedCount += 1;

    const entry = dailyMap.get(tx.date) || {
      income: 0,
      expense: 0,
      transfer: 0,
      count: 0,
    };
    entry.count += 1;

    if (tx.type === "income") {
      totalIncome += tx.amount;
      entry.income += tx.amount;
    } else if (tx.type === "expense") {
      totalExpenses += tx.amount;
      entry.expense += tx.amount;
      categorySpendMap.set(
        tx.category,
        (categorySpendMap.get(tx.category) || 0) + tx.amount
      );
      if (fixedCategories.has(tx.category)) {
        fixedCostsTotal += tx.amount;
      } else {
        discretionaryTotal += tx.amount;
      }
    } else {
      totalTransfers += tx.amount;
      entry.transfer += tx.amount;
    }
    dailyMap.set(tx.date, entry);
  }

  const dailyLedger: DailyLedgerRow[] = [];
  let runningBalance = profile.openingAvailableBalance;
  let zeroSpendDays = 0;
  let highestSpendDay: { date: string; amount: number } | null = null;

  const today = new Date().toISOString().slice(0, 10);
  let activeElapsedDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayPad = String(d).padStart(2, "0");
    const dateStr = `${month}-${dayPad}`;
    const item = dailyMap.get(dateStr) || {
      income: 0,
      expense: 0,
      transfer: 0,
      count: 0,
    };
    const netPL = item.income - item.expense;
    runningBalance += netPL;

    if (dateStr <= today || month < today.slice(0, 7)) {
      activeElapsedDays += 1;
      if (item.expense === 0) {
        zeroSpendDays += 1;
      }
    }

    if (
      item.expense > 0 &&
      (!highestSpendDay || item.expense > highestSpendDay.amount)
    ) {
      highestSpendDay = { date: dateStr, amount: item.expense };
    }

    dailyLedger.push({
      date: dateStr,
      dayNumber: d,
      income: item.income,
      expense: item.expense,
      transfer: item.transfer,
      netPL,
      runningBalance,
      entriesCount: item.count,
    });
  }

  const netProfitLoss = totalIncome - totalExpenses;
  const savingsRatePct =
    totalIncome > 0 ? Math.round((netProfitLoss / totalIncome) * 1000) / 10 : 0;

  const avgDailyExpense =
    activeElapsedDays > 0 ? Math.round(totalExpenses / activeElapsedDays) : 0;

  const categoryVariance: CategoryVarianceRow[] = budgets.map((b) => {
    const actual = categorySpendMap.get(b.category) || 0;
    const variance = b.monthlyLimit - actual;
    const pctUsed =
      b.monthlyLimit > 0 ? Math.round((actual / b.monthlyLimit) * 100) : 0;
    let status: CategoryVarianceRow["status"] = "On Track";
    if (actual > b.monthlyLimit) status = "Exceeded";
    else if (pctUsed >= 85) status = "Trending Over";
    return {
      category: b.category,
      budget: b.monthlyLimit,
      actual,
      variance,
      pctUsed,
      status,
    };
  });

  return {
    month,
    openingBalance: profile.openingAvailableBalance,
    totalIncome,
    totalExpenses,
    totalTransfers,
    netProfitLoss,
    savingsRatePct,
    fixedCostsTotal,
    discretionaryTotal,
    avgDailyExpense,
    zeroSpendDays,
    highestSpendDay,
    projectedEndBalance: runningBalance,
    categoryVariance,
    dailyLedger,
    unexplainedCount,
  };
}

export function computeSafeToSpendToday(
  availableCash: number,
  recurring: RecurringCommitment[],
  goals: FinancialGoal[],
  salaryDay: number,
  referenceDateStr: string
): {
  dailySafeAllowance: number;
  daysUntilSalary: number;
  upcomingBillsBeforeSalary: number;
  goalBufferBeforeSalary: number;
  discretionaryPool: number;
} {
  const refDate = new Date(`${referenceDateStr}T00:00:00`);
  const currentDay = refDate.getDate();
  const year = refDate.getFullYear();
  const monthIdx = refDate.getMonth();

  let nextSalaryDate = new Date(year, monthIdx, salaryDay);
  if (currentDay >= salaryDay) {
    nextSalaryDate = new Date(year, monthIdx + 1, salaryDay);
  }
  const msPerDay = 86400000;
  const daysUntilSalary = Math.max(
    1,
    Math.ceil((nextSalaryDate.getTime() - refDate.getTime()) / msPerDay)
  );

  // Sum confirmed recurring bills falling between tomorrow and the day before salary
  let upcomingBillsBeforeSalary = 0;
  for (const r of recurring) {
    if (!r.confirmed || r.userStillUsing === "no") continue;
    const dueThisWindow =
      currentDay < salaryDay
        ? r.dueDay > currentDay && r.dueDay < salaryDay
        : r.dueDay > currentDay || r.dueDay < salaryDay;
    if (dueThisWindow) {
      upcomingBillsBeforeSalary += r.amount;
    }
  }

  const totalGoalAllocation = goals.reduce(
    (sum, g) => sum + g.monthlyAllocation,
    0
  );
  const goalBufferBeforeSalary = Math.round(totalGoalAllocation * 0.5);

  const discretionaryPool =
    availableCash - upcomingBillsBeforeSalary - goalBufferBeforeSalary;
  const dailySafeAllowance = Math.max(
    0,
    Math.round(discretionaryPool / daysUntilSalary)
  );

  return {
    dailySafeAllowance,
    daysUntilSalary,
    upcomingBillsBeforeSalary,
    goalBufferBeforeSalary,
    discretionaryPool,
  };
}

export interface ShockRadarParams {
  startDate: string; // YYYY-MM-DD
  openingAvailableBalance: number;
  includeEmergencyFund: boolean;
  emergencyFundBalance: number;
  monthlyIncome: number;
  salaryDay: number;
  salaryDelayDays: number;
  recurring: RecurringCommitment[];
  goals: FinancialGoal[];
  pauseVoluntaryGoals: boolean;
  dailyDiscretionarySpend: number;
  unexpectedBillAmount: number;
  unexpectedBillDayOffset: number;
}

export function runShockRadarSimulation(
  params: ShockRadarParams
): ShockRadarResult {
  const startingBalance =
    params.openingAvailableBalance +
    (params.includeEmergencyFund ? params.emergencyFundBalance : 0);

  let running = startingBalance;
  const days: ShockRadarDay[] = [];
  const causingEvents: Array<{ date: string; description: string; amount: number }> = [];

  let lowestBalance = startingBalance;
  let lowestBalanceDate = params.startDate;
  let firstShortfallDate: string | null = null;
  let firstShortfallAmount: number | null = null;
  let shortfallDaysCount = 0;

  const baseDate = new Date(`${params.startDate}T00:00:00`);
  const effectiveSalaryDay = Math.min(28, Math.max(1, params.salaryDay + params.salaryDelayDays));

  for (let offset = 0; offset < 30; offset++) {
    const d = new Date(baseDate.getTime() + offset * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfMonth = d.getDate();
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    let inflow = 0;
    let outflow = 0;
    const events: string[] = [];

    // Salary inflow
    if (dayOfMonth === effectiveSalaryDay && params.monthlyIncome > 0) {
      inflow += params.monthlyIncome;
      events.push(
        params.salaryDelayDays > 0
          ? `Delayed Salary (+${params.salaryDelayDays}d): ${formatINR(params.monthlyIncome)}`
          : `Salary Credit: ${formatINR(params.monthlyIncome)}`
      );
    }

    // Confirmed recurring bills
    for (const r of params.recurring) {
      if (!r.confirmed || r.userStillUsing === "no") continue;
      if (r.dueDay === dayOfMonth) {
        outflow += r.amount;
        events.push(`${r.name}: -${formatINR(r.amount)}`);
        causingEvents.push({
          date: dateStr,
          description: r.name,
          amount: r.amount,
        });
      }
    }

    // Voluntary goal auto-transfers on day 10
    if (!params.pauseVoluntaryGoals && dayOfMonth === 10) {
      const totalGoals = params.goals.reduce(
        (sum, g) => sum + g.monthlyAllocation,
        0
      );
      if (totalGoals > 0) {
        outflow += totalGoals;
        events.push(`Goal Contributions: -${formatINR(totalGoals)}`);
      }
    }

    // Unexpected bill test
    if (
      params.unexpectedBillAmount > 0 &&
      offset === params.unexpectedBillDayOffset
    ) {
      outflow += params.unexpectedBillAmount;
      events.push(`Unexpected Bill: -${formatINR(params.unexpectedBillAmount)}`);
      causingEvents.push({
        date: dateStr,
        description: "Simulated Unexpected Bill",
        amount: params.unexpectedBillAmount,
      });
    }

    // Daily discretionary spend
    if (params.dailyDiscretionarySpend > 0) {
      outflow += params.dailyDiscretionarySpend;
    }

    const netChange = inflow - outflow;
    running += netChange;

    const isShortfall = running < 0;
    if (isShortfall) {
      shortfallDaysCount += 1;
      if (!firstShortfallDate) {
        firstShortfallDate = dateStr;
        firstShortfallAmount = running;
      }
    }

    if (running < lowestBalance) {
      lowestBalance = running;
      lowestBalanceDate = dateStr;
    }

    days.push({
      dayOffset: offset,
      date: dateStr,
      label,
      inflow,
      outflow,
      netChange,
      balance: running,
      events,
      isShortfall,
    });
  }

  return {
    days,
    startingBalance,
    endingBalance: running,
    lowestBalance,
    lowestBalanceDate,
    firstShortfallDate,
    firstShortfallAmount,
    shortfallDaysCount,
    causingEvents: causingEvents.slice(0, 8),
  };
}

function normalizeDateString(rawDate: string): string {
  const trimmed = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // DD/MM/YYYY or DD-MM-YYYY or DD-MM-YY
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const mon = dmy[2].padStart(2, "0");
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${mon}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

export function isDuplicateTransaction(
  date: string,
  amount: number,
  merchant: string,
  existing: Transaction[]
): boolean {
  const norm = normalizeMerchant(merchant);
  return existing.some(
    (tx) =>
      tx.date === date &&
      Math.abs(tx.amount - amount) < 0.01 &&
      normalizeMerchant(tx.merchant) === norm
  );
}

export function parseCsvStatement(
  csvText: string,
  userRules: CategoryRule[],
  existing: Transaction[]
): ImportCandidate[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const descIdx = headers.findIndex(
    (h) =>
      h.includes("desc") ||
      h.includes("narr") ||
      h.includes("merchant") ||
      h.includes("particular") ||
      h.includes("detail")
  );
  const debitIdx = headers.findIndex(
    (h) => h.includes("debit") || h.includes("withdraw")
  );
  const creditIdx = headers.findIndex(
    (h) => h.includes("credit") || h.includes("deposit")
  );
  const amountIdx = headers.findIndex((h) => h.includes("amount"));
  const typeIdx = headers.findIndex((h) => h.includes("type") || h.includes("dr/cr"));

  const candidates: ImportCandidate[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (cols.length < 2) continue;

    const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0];
    const rawDesc = descIdx >= 0 ? cols[descIdx] : cols[1] || "UNKNOWN ENTRY";
    const date = normalizeDateString(rawDate);

    let amount = 0;
    let type: TransactionType = "expense";

    if (debitIdx >= 0 || creditIdx >= 0) {
      const dr = Number((cols[debitIdx] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const cr = Number((cols[creditIdx] || "0").replace(/[^0-9.-]/g, "")) || 0;
      if (cr > 0) {
        amount = cr;
        type = "income";
      } else {
        amount = Math.abs(dr);
        type = "expense";
      }
    } else if (amountIdx >= 0) {
      const rawAmt = Number((cols[amountIdx] || "0").replace(/[^0-9.-]/g, "")) || 0;
      const typeCell = typeIdx >= 0 ? (cols[typeIdx] || "").toLowerCase() : "";
      if (typeCell.includes("cr") || typeCell.includes("income") || rawAmt > 0 && typeCell === "") {
        type = typeCell.includes("cr") || typeCell.includes("income") ? "income" : rawAmt < 0 ? "expense" : "expense";
      }
      if (typeCell.includes("transfer")) type = "transfer";
      amount = Math.abs(rawAmt);
    }

    if (amount <= 0) continue;

    const merchant = normalizeMerchant(rawDesc) || rawDesc.slice(0, 32).toUpperCase();
    const resolved = resolveCategoryWithRules(merchant, rawDesc, userRules, type);
    const duplicate = isDuplicateTransaction(date, amount, merchant, existing);

    candidates.push({
      tempId: `csv-${i}-${Date.now()}`,
      date,
      merchant,
      rawDescription: rawDesc,
      amount,
      type: resolved.type,
      category: resolved.category,
      paymentMode: rawDesc.toUpperCase().includes("UPI") ? "UPI" : "Bank Transfer",
      confidence: resolved.confidence,
      ruleApplied: resolved.ruleApplied,
      isDuplicate: duplicate,
      needsReview: resolved.needsReview,
      selected: !duplicate,
    });
  }

  return candidates;
}

export function parseSmsText(
  smsBlock: string,
  userRules: CategoryRule[],
  existing: Transaction[]
): ImportCandidate[] {
  const lines = smsBlock
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10);

  const candidates: ImportCandidate[] = [];

  lines.forEach((line, idx) => {
    const amtMatch = line.match(
      /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
    );
    if (!amtMatch) return;
    const amount = Number(amtMatch[1].replace(/,/g, ""));
    if (!amount || amount <= 0) return;

    const isCredit = /\b(credited|received|deposited|salary|refund)\b/i.test(line);
    const isTransfer = /\b(self transfer|own account|wallet load)\b/i.test(line);
    const fallbackType: TransactionType = isTransfer
      ? "transfer"
      : isCredit
      ? "income"
      : "expense";

    const dateMatch = line.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
    const date = dateMatch
      ? normalizeDateString(dateMatch[1])
      : new Date().toISOString().slice(0, 10);

    const atMatch = line.match(/(?:\bat\b|\bto\b|\bvia\b|\bfrom\b)\s+([A-Za-z0-9 *._-]{3,32})/i);
    const merchantRaw = atMatch ? atMatch[1].replace(/\b(on|ref|upi|avl|bal)\b.*$/i, "").trim() : line.slice(0, 28);
    const merchant = normalizeMerchant(merchantRaw) || "SMS ENTRY";

    const resolved = resolveCategoryWithRules(merchant, line, userRules, fallbackType);
    const duplicate = isDuplicateTransaction(date, amount, merchant, existing);

    const paymentMode: PaymentMode = /UPI/i.test(line)
      ? "UPI"
      : /Card|Credit|Debit Card/i.test(line)
      ? "Card"
      : "Bank Transfer";

    candidates.push({
      tempId: `sms-${idx}-${Date.now()}`,
      date,
      merchant,
      rawDescription: line.replace(/\b\d{9,16}\b/g, "XXXX"),
      amount,
      type: resolved.type,
      category: resolved.category,
      paymentMode,
      confidence: resolved.confidence,
      ruleApplied: resolved.ruleApplied,
      isDuplicate: duplicate,
      needsReview: resolved.needsReview,
      selected: !duplicate,
    });
  });

  return candidates;
}

export function detectRecurringCandidates(
  transactions: Transaction[],
  existingRecurring: RecurringCommitment[]
): Array<{
  merchant: string;
  occurrences: number;
  latestAmount: number;
  previousAmount?: number;
  priceChanged: boolean;
  category: Category;
  alreadyTracked: boolean;
}> {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const key = normalizeMerchant(tx.merchant);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(tx);
    groups.set(key, list);
  }

  const results: Array<{
    merchant: string;
    occurrences: number;
    latestAmount: number;
    previousAmount?: number;
    priceChanged: boolean;
    category: Category;
    alreadyTracked: boolean;
  }> = [];

  for (const [merchant, txs] of groups.entries()) {
    if (txs.length < 2) continue;
    const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    const prev = sorted[1];
    const alreadyTracked = existingRecurring.some((r) =>
      merchant.includes(r.merchantPattern.toUpperCase())
    );
    results.push({
      merchant,
      occurrences: txs.length,
      latestAmount: latest.amount,
      previousAmount: prev.amount,
      priceChanged: Math.abs(latest.amount - prev.amount) >= 1,
      category: latest.category,
      alreadyTracked,
    });
  }

  return results.sort((a, b) => b.latestAmount - a.latestAmount);
}

function csvEscape(val: string | number): string {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildMonthlyProfitLossCSV(
  month: string,
  summary: MonthlySummary,
  transactions: Transaction[],
  goals: FinancialGoal[],
  profile: FinancialProfile
): string {
  const rows: string[] = [];
  const pushRow = (...cells: Array<string | number>) => {
    rows.push(cells.map(csvEscape).join(","));
  };

  pushRow("MONEYMAP MONTHLY PROFIT & LOSS STATEMENT", month);
  pushRow("Profile Owner", profile.name);
  pushRow("Generated At", new Date().toISOString());
  pushRow("Currency", "INR (₹)");
  pushRow("Protected Emergency Fund (Excluded from Liquid Cash)", profile.emergencyFundBalance);
  pushRow("");

  pushRow("1. EXECUTIVE PROFIT & LOSS SUMMARY");
  pushRow("Metric", "Amount (INR)", "Notes");
  pushRow("Opening Available Balance", summary.openingBalance, "Confirmed starting balance");
  pushRow("Total Confirmed Income", summary.totalIncome, "Salary, freelance & credits");
  pushRow("Total Expenses", summary.totalExpenses, "Fixed + Discretionary spending");
  pushRow(
    "Net Monthly Profit / Loss",
    summary.netProfitLoss,
    summary.netProfitLoss >= 0 ? "NET SURPLUS (PROFIT)" : "NET DEFICIT (LOSS)"
  );
  pushRow("Savings Rate (%)", `${summary.savingsRatePct}%`, "Net P&L divided by Income");
  pushRow("Fixed Commitments", summary.fixedCostsTotal, "Rent, Utilities & Subscriptions");
  pushRow("Discretionary Spending", summary.discretionaryTotal, "Dining, Groceries, Shopping, etc.");
  pushRow("Internal Transfers Excluded", summary.totalTransfers, "Excluded to prevent double counting");
  pushRow("Average Daily Spend", summary.avgDailyExpense, "Across elapsed days in month");
  pushRow("Zero-Spend Days", summary.zeroSpendDays, "Days with ₹0 expenses logged");
  pushRow(
    "Highest Spend Day",
    summary.highestSpendDay ? summary.highestSpendDay.amount : 0,
    summary.highestSpendDay ? summary.highestSpendDay.date : "N/A"
  );
  pushRow("Projected Month-End Liquid Balance", summary.projectedEndBalance, "Opening + Net P&L");
  pushRow("");

  pushRow("2. CATEGORY BUDGET VS ACTUAL (VARIANCE)");
  pushRow("Category", "Monthly Budget (INR)", "Actual Spend (INR)", "Variance / Saved (INR)", "% Used", "Status");
  for (const c of summary.categoryVariance) {
    pushRow(c.category, c.budget, c.actual, c.variance, `${c.pctUsed}%`, c.status);
  }
  pushRow("");

  pushRow("3. DAY-BY-DAY DAILY LEDGER");
  pushRow("Date", "Day #", "Daily Income (INR)", "Daily Expense (INR)", "Daily Transfers (INR)", "Daily Net P&L (INR)", "Running Balance (INR)", "Entries Count");
  for (const d of summary.dailyLedger) {
    pushRow(d.date, d.dayNumber, d.income, d.expense, d.transfer, d.netPL, d.runningBalance, d.entriesCount);
  }
  pushRow("");

  const hourlyRate =
    profile.workHoursPerMonth > 0
      ? profile.monthlyIncome / profile.workHoursPerMonth
      : 0;

  pushRow("4. ITEMIZED TRANSACTIONS LEDGER");
  pushRow("Date", "Merchant", "Raw Description", "Category", "Type", "Amount (INR)", "Payment Mode", "Source", "Rule Applied", "Work-Hours Equivalent", "Notes");
  const monthTx = transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of monthTx) {
    const workHours =
      hourlyRate > 0 && tx.type === "expense"
        ? (tx.amount / hourlyRate).toFixed(1)
        : "-";
    pushRow(
      tx.date,
      tx.merchant,
      tx.rawDescription,
      tx.category,
      tx.type.toUpperCase(),
      tx.amount,
      tx.paymentMode,
      tx.source,
      tx.ruleApplied || "-",
      workHours,
      tx.notes || ""
    );
  }
  pushRow("");

  pushRow("5. FINANCIAL GOALS SNAPSHOT");
  pushRow("Goal Name", "Target (INR)", "Saved So Far (INR)", "Remaining (INR)", "Monthly Plan (INR)", "Target Deadline", "Priority");
  for (const g of goals) {
    pushRow(
      g.name,
      g.targetAmount,
      g.savedAmount,
      Math.max(0, g.targetAmount - g.savedAmount),
      g.monthlyAllocation,
      g.deadline,
      g.priority
    );
  }

  return "\uFEFF" + rows.join("\n");
}
