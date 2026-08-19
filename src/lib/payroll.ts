import type {
  Advance,
  AttendanceRecord,
  Employee,
  LeaveRequest,
  PayrollResult,
  PayrollRow,
  ShiftKey,
} from "./types";

// ─── Shift & overtime policy ────────────────────────────────────────────────
export const GRACE_MIN = 10; // late-arrival tolerance
export const STANDARD_MIN = 480; // 8h standard shift
export const OT_RATE = 1.5; // overtime multiplier
export const BREAK_MIN = 30;

export const SHIFTS: Record<ShiftKey, { label: string; start: number; end: number; window: string }> = {
  morning: { label: "Morning", start: 6 * 60, end: 14 * 60, window: "06:00 – 14:00" },
  evening: { label: "Evening", start: 14 * 60, end: 22 * 60, window: "14:00 – 22:00" },
  night: { label: "Night", start: 22 * 60, end: 22 * 60 + 480, window: "22:00 – 06:00" },
};

// ─── Time helpers ───────────────────────────────────────────────────────────
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const fmtMin = (m: number | null) =>
  m == null ? "—" : `${pad2(Math.floor((m % 1440) / 60))}:${pad2(m % 60)}`;
export const fmtDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${pad2(m)}m` : `${m}m`;
};
export const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
export const monthKeyNow = () => monthKeyOf(new Date());
export const prevMonthKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return monthKeyOf(d);
};
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
export const daysInMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};
export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
/** Factory works Monday → Saturday (Sunday closed). */
export const isWorkday = (d: Date) => d.getDay() !== 0;
export const workdaysInMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  let n = 0;
  const total = daysInMonth(key);
  for (let day = 1; day <= total; day++) if (isWorkday(new Date(y, m - 1, day))) n++;
  return n;
};
export const workdaysElapsed = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const total = daysInMonth(key);
  const today = new Date();
  const sameMonth = today.getFullYear() === y && today.getMonth() === m - 1;
  const limit = sameMonth ? today.getDate() : total;
  let n = 0;
  for (let day = 1; day <= limit; day++) if (isWorkday(new Date(y, m - 1, day))) n++;
  return n;
};
export const fmtClock = (d: Date) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
export const fmtDateShort = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
};
export const fmtMoney = (n: number, decimals = 2) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const fmtMoney0 = (n: number) => fmtMoney(n, 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Per-day analysis ───────────────────────────────────────────────────────
export interface DayStats {
  worked: number;
  late: number;
  ot: number; // minutes beyond standard
  status: "present" | "late" | "absent" | "open";
}

export function dayStats(rec: AttendanceRecord | undefined, shift: ShiftKey): DayStats {
  if (!rec || rec.in == null) return { worked: 0, late: 0, ot: 0, status: "absent" };
  const s = SHIFTS[shift];
  let out = rec.out;
  if (out != null && out < rec.in) out += 1440; // overnight
  const worked = out != null ? Math.max(0, out - rec.in - BREAK_MIN) : 0;
  const late = Math.max(0, rec.in - (s.start + GRACE_MIN));
  const ot = Math.max(0, worked - STANDARD_MIN);
  return {
    worked,
    late,
    ot,
    status: rec.out == null ? "open" : late > 0 ? "late" : "present",
  };
}

// ─── Monthly payroll engine ─────────────────────────────────────────────────
// net = (baseSalary / totalWorkDays) × daysPresent + overtime(1.5×hourly)
//       − late deductions − unpaid leave − advances (السلف)
export function computePayroll(
  emp: Employee,
  month: string,
  attendance: AttendanceRecord[],
  leaves: LeaveRequest[],
  advances: Advance[]
): PayrollResult {
  const [y, m] = month.split("-").map(Number);
  const workDays = workdaysInMonth(month);
  const perDay = emp.baseSalary / workDays;
  const hourly = perDay / 8;

  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let otMinutes = 0;
  let lateMinutes = 0;

  const approved = leaves.filter((l) => l.empId === emp.id && l.status === "approved");
  const onLeave = (date: string) => approved.find((l) => l.from <= date && l.to >= date);

  const total = daysInMonth(month);
  const todayStr = todayKey();
  for (let day = 1; day <= total; day++) {
    const d = new Date(y, m - 1, day);
    const key = dateKey(d);
    if (key > todayStr) continue; // future — not counted
    if (!isWorkday(d)) continue;
    const rec = attendance.find((a) => a.empId === emp.id && a.date === key);
    const leave = onLeave(key);
    if (rec && rec.in != null) {
      const st = dayStats(rec, emp.shift);
      presentDays += 1;
      otMinutes += st.ot;
      lateMinutes += st.late;
    } else if (leave) {
      if (leave.type === "unpaid") unpaidLeaveDays += 1;
      else paidLeaveDays += 1; // sick, annual, permission are paid
    } else {
      absentDays += 1;
    }
  }

  const baseEarned = round2(perDay * (presentDays + paidLeaveDays));
  const otHours = round2(otMinutes / 60);
  const otPay = round2(otHours * hourly * OT_RATE);
  const lateDeduction = round2((lateMinutes / 60) * hourly);
  const unpaidDeduction = round2(perDay * unpaidLeaveDays);
  const openAdvances = advances.filter((a) => a.empId === emp.id && !a.settledMonth);
  const advancesTotal = round2(openAdvances.reduce((s, a) => s + a.amount, 0));

  const gross = round2(baseEarned + otPay);
  const net = round2(gross - lateDeduction - unpaidDeduction - advancesTotal);

  const rows: PayrollRow[] = [
    {
      label: "Base salary (pro-rated)",
      value: baseEarned,
      kind: "earn",
      sub: `${presentDays + paidLeaveDays} of ${workDays} work days × ${fmtMoney(perDay)}/day`,
    },
    {
      label: `Overtime × ${OT_RATE}`,
      value: otPay,
      kind: "earn",
      sub: `${otHours.toFixed(1)} h × ${fmtMoney(hourly)}/h × ${OT_RATE}`,
    },
    {
      label: "Late arrival deduction",
      value: -lateDeduction,
      kind: "deduct",
      sub: `${Math.round(lateMinutes)} min × ${fmtMoney(hourly)}/h`,
    },
    {
      label: "Unpaid leave",
      value: -unpaidDeduction,
      kind: "deduct",
      sub: `${unpaidLeaveDays} day(s) × ${fmtMoney(perDay)}/day`,
    },
    {
      label: "Salary advance (سلفة)",
      value: -advancesTotal,
      kind: "deduct",
      sub: openAdvances.length ? openAdvances.map((a) => a.note).join(" · ") : "No open advances",
    },
  ];

  return {
    empId: emp.id,
    monthKey: month,
    workDays,
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    perDay: round2(perDay),
    hourly: round2(hourly),
    baseEarned,
    otHours,
    otPay,
    lateMinutes: Math.round(lateMinutes),
    lateDeduction,
    gross,
    advancesTotal,
    net,
    rows,
  };
}

// ─── B2B volume discount tiers (applied per product line, in cartons) ──────
export function volumeRate(cartons: number) {
  if (cartons >= 50) return 0.14;
  if (cartons >= 20) return 0.09;
  if (cartons >= 10) return 0.05;
  return 0;
}
export const cartonsOf = (tier: string, qty: number) =>
  tier === "box" ? qty / 12 : tier === "carton" ? qty : qty * 60;
