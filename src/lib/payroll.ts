import type {
  Advance,
  AttendanceRecord,
  Employee,
  LeaveRequest,
  PayrollResult,
  PayrollRow,
  ShiftKey,
} from "./types";

// ─── سياسة الورديات والإضافي ────────────────────────────────────────────────
export const GRACE_MIN = 10; // سماح التأخير
export const STANDARD_MIN = 480; // وردية قياسية ٨ ساعات
export const OT_RATE = 1.5; // معامل الوقت الإضافي
export const BREAK_MIN = 30;

export const SHIFTS: Record<ShiftKey, { label: string; start: number; end: number; window: string }> = {
  morning: { label: "الوردية الصباحية", start: 6 * 60, end: 14 * 60, window: "06:00 – 14:00" },
  evening: { label: "الوردية المسائية", start: 14 * 60, end: 22 * 60, window: "14:00 – 22:00" },
  night: { label: "الوردية الليلية", start: 22 * 60, end: 22 * 60 + 480, window: "22:00 – 06:00" },
};

export const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
export const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const MONTHS_AR_SHORT = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

// ─── أدوات الوقت ────────────────────────────────────────────────────────────
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const fmtMin = (m: number | null) =>
  m == null ? "—" : `${pad2(Math.floor((m % 1440) / 60))}:${pad2(m % 60)}`;
export const fmtDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} س ${pad2(m)} د` : `${m} د`;
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
  return monthKeyOf(new Date(y, m - 2, 1));
};
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_AR[m - 1]} ${y}`;
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
/** أيام العمل: السبت – الخميس (الجمعة عطلة المصنع). */
export const isWorkday = (d: Date) => d.getDay() !== 5;
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
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS_AR[dt.getDay()]} ${d} ${MONTHS_AR[m - 1]}`;
};
export const fmtDateNum = (key: string) => key; // YYYY-MM-DD

export const fmtMoney = (n: number, decimals = 2) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ر.س`;
export const fmtMoney0 = (n: number) => fmtMoney(n, 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── تحليل اليوم الواحد ─────────────────────────────────────────────────────
export interface DayStats {
  worked: number;
  late: number;
  ot: number;
  status: "present" | "late" | "absent" | "open";
}

export function dayStats(rec: AttendanceRecord | undefined, shift: ShiftKey): DayStats {
  if (!rec || rec.in == null) return { worked: 0, late: 0, ot: 0, status: "absent" };
  const s = SHIFTS[shift];
  let out = rec.out;
  if (out != null && out < rec.in) out += 1440;
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

// ─── محرك الرواتب الشهري ────────────────────────────────────────────────────
// الصافي = (الراتب الأساسي ÷ أيام العمل) × أيام الحضور + إضافي (×١٫٥)
//          − خصم التأخير − إجازات غير مدفوعة − السلف
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
    if (key > todayStr) continue;
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
      else paidLeaveDays += 1;
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
      label: "الراتب الأساسي (تناسبي)",
      value: baseEarned,
      kind: "earn",
      sub: `${presentDays + paidLeaveDays} من ${workDays} يوم عمل × ${fmtMoney(perDay)}/يوم`,
    },
    {
      label: `وقت إضافي × ${OT_RATE}`,
      value: otPay,
      kind: "earn",
      sub: `${otHours.toFixed(1)} ساعة × ${fmtMoney(hourly)}/ساعة × ${OT_RATE}`,
    },
    {
      label: "خصم التأخير",
      value: -lateDeduction,
      kind: "deduct",
      sub: `${Math.round(lateMinutes)} دقيقة × ${fmtMoney(hourly)}/ساعة`,
    },
    {
      label: "إجازة غير مدفوعة",
      value: -unpaidDeduction,
      kind: "deduct",
      sub: `${unpaidLeaveDays} يوم × ${fmtMoney(perDay)}/يوم`,
    },
    {
      label: "سلفة مستقطعة (سلف)",
      value: -advancesTotal,
      kind: "deduct",
      sub: openAdvances.length ? openAdvances.map((a) => a.note).join(" · ") : "لا توجد سلف مفتوحة",
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

// ─── شرائح خصم الجملة (لكل سطر حسب عدد الكراتين) ───────────────────────────
export function volumeRate(cartons: number) {
  if (cartons >= 50) return 0.14;
  if (cartons >= 20) return 0.09;
  if (cartons >= 10) return 0.05;
  return 0;
}
export const cartonsOf = (tier: string, qty: number) =>
  tier === "box" ? qty / 12 : tier === "carton" ? qty : qty * 60;

// ─── أدوات التصدير ──────────────────────────────────────────────────────────
/** تصدير CSV متوافق مع Excel بدعم كامل للعربية (BOM + UTF-8) */
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv =
    "\uFEFF" +
    rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** فتح واتساب برسالة جاهزة */
export const waLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
