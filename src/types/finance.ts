export type TransactionType = "expense" | "income" | "transfer";

export type Category =
  | "Rent & Housing"
  | "Groceries"
  | "Dining"
  | "Utilities & Bills"
  | "Transport"
  | "Subscriptions"
  | "Shopping"
  | "Healthcare"
  | "Education"
  | "Salary / Income"
  | "Freelance / Bonus"
  | "Transfer"
  | "Savings / Goal"
  | "Other";

export const EXPENSE_CATEGORIES: Category[] = [
  "Rent & Housing",
  "Groceries",
  "Dining",
  "Utilities & Bills",
  "Transport",
  "Subscriptions",
  "Shopping",
  "Healthcare",
  "Education",
  "Savings / Goal",
  "Other",
];

export const ALL_CATEGORIES: Category[] = [
  ...EXPENSE_CATEGORIES,
  "Salary / Income",
  "Freelance / Bonus",
  "Transfer",
];

export type PaymentMode = "UPI" | "Bank Transfer" | "Card" | "Cash" | "Auto-Debit";

export type TransactionSource = "manual" | "csv" | "sms" | "sample";

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  rawDescription: string;
  amount: number;
  type: TransactionType;
  category: Category;
  paymentMode: PaymentMode;
  source: TransactionSource;
  ruleApplied?: string;
  notes?: string;
  needsReview?: boolean;
  confidence?: number;
  importBatchId?: string;
}

export interface CategoryRule {
  id: string;
  merchantPattern: string;
  targetCategory: Category;
  targetType: TransactionType;
  createdAt: string;
  matchCount: number;
}

export interface RecurringCommitment {
  id: string;
  name: string;
  merchantPattern: string;
  amount: number;
  previousAmount?: number;
  dueDay: number; // 1-31
  frequency: "monthly" | "weekly";
  category: Category;
  confirmed: boolean;
  userStillUsing: "yes" | "unsure" | "no";
  isEssential: boolean;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string; // YYYY-MM
  monthlyAllocation: number;
  priority: "High" | "Medium" | "Low";
}

export interface CategoryBudget {
  category: Category;
  monthlyLimit: number;
}

export interface FinancialProfile {
  name: string;
  currencySymbol: string;
  openingAvailableBalance: number;
  emergencyFundBalance: number;
  monthlyIncome: number;
  salaryDay: number; // 1-28
  workHoursPerMonth: number;
  lastUpdated: string;
}

export interface ImportCandidate {
  tempId: string;
  date: string;
  merchant: string;
  rawDescription: string;
  amount: number;
  type: TransactionType;
  category: Category;
  paymentMode: PaymentMode;
  confidence: number;
  ruleApplied?: string;
  isDuplicate: boolean;
  needsReview: boolean;
  selected: boolean;
}

export interface DailyLedgerRow {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  income: number;
  expense: number;
  transfer: number;
  netPL: number;
  runningBalance: number;
  entriesCount: number;
}

export interface CategoryVarianceRow {
  category: Category;
  budget: number;
  actual: number;
  variance: number; // budget - actual (+ = saved/remaining, - = over budget)
  pctUsed: number;
  status: "On Track" | "Trending Over" | "Exceeded";
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  openingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalTransfers: number;
  netProfitLoss: number;
  savingsRatePct: number;
  fixedCostsTotal: number;
  discretionaryTotal: number;
  avgDailyExpense: number;
  zeroSpendDays: number;
  highestSpendDay: { date: string; amount: number } | null;
  projectedEndBalance: number;
  categoryVariance: CategoryVarianceRow[];
  dailyLedger: DailyLedgerRow[];
  unexplainedCount: number;
}

export interface ShockRadarDay {
  dayOffset: number;
  date: string;
  label: string;
  inflow: number;
  outflow: number;
  netChange: number;
  balance: number;
  events: string[];
  isShortfall: boolean;
}

export interface ShockRadarResult {
  days: ShockRadarDay[];
  startingBalance: number;
  endingBalance: number;
  lowestBalance: number;
  lowestBalanceDate: string;
  firstShortfallDate: string | null;
  firstShortfallAmount: number | null;
  shortfallDaysCount: number;
  causingEvents: Array<{ date: string; description: string; amount: number }>;
}

export type AppTab =
  | "overview"
  | "import"
  | "transactions"
  | "radar"
  | "goals"
  | "report";
