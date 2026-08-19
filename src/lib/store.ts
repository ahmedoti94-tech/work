import { create } from "zustand";
import type {
  Advance, AttendanceRecord, AuditEntry, Batch, CartLine, Employee, LeaveRequest,
  LeaveStatus, LeaveType, OfflinePunch, Order, OrderStatus, PackTier, PaymentMethod,
  Product, RawMaterial, Role, User, View,
} from "./types";
import {
  ADVANCES_SEED, ATTENDANCE_SEED, AUDIT_SEED, BATCHES, EMPLOYEES, LEAVES_SEED,
  ORDERS_SEED, PRODUCTS, RAW_MATERIALS, USERS,
} from "./data";
import {
  addDays, cartonsOf, computePayroll, dateKey, dayStats, fmtMin, fmtMoney0,
  monthKeyNow, monthLabel, nowMin, round2, todayKey, volumeRate,
} from "./payroll";

export type ToastTone = "sage" | "brand" | "berry" | "butter";
export interface Toast { id: number; msg: string; tone: ToastTone }

const NEXT: Record<OrderStatus, OrderStatus> = {
  pending: "baking", baking: "shipped", shipped: "delivered", delivered: "delivered",
};

export const STATUS_AR: Record<OrderStatus, string> = {
  pending: "قيد المراجعة", baking: "الخبز والتعبئة", shipped: "تم الشحن", delivered: "تم التسليم",
};
export const PAY_AR: Record<PaymentMethod, string> = {
  cod: "الدفع عند الاستلام", transfer: "تحويل بنكي", gateway: "بوابة دفع إلكترونية",
};
export const LEAVE_AR: Record<LeaveType, string> = {
  sick: "مرضية", annual: "سنوية", unpaid: "غير مدفوعة", permission: "إذن ساعات",
};
export const ROLE_AR: Record<Role, string> = {
  super: "المدير العام", hr: "موارد بشرية", production: "إنتاج ومخزون", sales: "مبيعات", customer: "موظف",
};

let toastSeq = 1;
let auditSeq = 100;

export const cartSummary = (cart: CartLine[], products: Product[]) => {
  let subtotal = 0, discount = 0, cartons = 0;
  const issues: string[] = [];
  const lines = cart.map((l) => {
    const p = products.find((x) => x.id === l.productId)!;
    const pack = p.packs.find((k) => k.tier === l.tier)!;
    const c = cartonsOf(l.tier, l.qty);
    const gross = pack.price * pack.units * l.qty;
    const rate = volumeRate(c);
    subtotal += gross;
    discount += gross * rate;
    cartons += c;
    if (c < p.moqCartons) issues.push(`الحد الأدنى لطلب «${p.name}» هو ${p.moqCartons} كراتين`);
    if (c > p.stock) issues.push(`الكمية المطلوبة من «${p.name}» تتجاوز المتوفر (${p.stock} كرتونة)`);
    return { line: l, product: p, pack, cartons: c, rate, gross, net: gross * (1 - rate) };
  });
  const deliveryFee = subtotal - discount >= 1500 ? 0 : 45;
  const total = round2(subtotal - discount + deliveryFee);
  return { lines, subtotal: round2(subtotal), discount: round2(discount), cartons, deliveryFee, total, issues };
};

interface State {
  user: User;
  users: User[];
  loginAs: (id: string) => void;

  theme: "light" | "dark";
  toggleTheme: () => void;

  view: View;
  setView: (v: View) => void;

  employees: Employee[];
  attendance: AttendanceRecord[];
  punch: (empId: string, type: "in" | "out") => AttendanceRecord | null;
  manualPunch: (empId: string, date: string, inMin: number, outMin: number | null) => void;
  adjustSalary: (empId: string, newBase: number) => void;

  online: boolean;
  setOnline: (v: boolean) => void;
  offlineQueue: OfflinePunch[];

  leaves: LeaveRequest[];
  applyLeave: (empId: string, type: LeaveType, from: string, to: string, reason: string) => void;
  decideLeave: (id: string, status: LeaveStatus) => void;

  advances: Advance[];
  addAdvance: (empId: string, amount: number, note: string) => void;
  finalizedMonths: string[];
  finalizePayroll: (month: string) => void;

  products: Product[];
  cart: CartLine[];
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  checkoutOpen: boolean;
  setCheckoutOpen: (v: boolean) => void;
  addToCart: (productId: string, tier: PackTier, qty: number) => void;
  setLineQty: (productId: string, tier: PackTier, qty: number) => void;
  removeLine: (productId: string, tier: PackTier) => void;
  orders: Order[];
  placeOrder: (customer: string, phone: string, deliverOn: string, window: string, payment: PaymentMethod) => Order;
  advanceOrder: (id: string) => void;

  raw: RawMaterial[];
  receiveStock: (id: string, qty: number) => void;
  batches: Batch[];

  audit: AuditEntry[];
  toasts: Toast[];
  toast: (msg: string, tone?: ToastTone) => void;
  auditLog: (actor: string, role: Role, action: string, detail: string) => void;
}

export const useStore = create<State>((set, get) => ({
  user: USERS[0],
  users: USERS,
  loginAs: (id) => {
    const u = USERS.find((x) => x.id === id)!;
    set({ user: u });
    get().toast(`مرحبًا بك، ${u.name} — تم الدخول بصلاحية «${ROLE_AR[u.role]}»`, "brand");
  },

  theme: (typeof localStorage !== "undefined" && (localStorage.getItem("ow-theme") as "light" | "dark")) || "light",
  toggleTheme: () => {
    const t = get().theme === "light" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", t === "dark");
    localStorage.setItem("ow-theme", t);
    set({ theme: t });
  },

  view: "dashboard",
  setView: (v) => set({ view: v }),

  employees: EMPLOYEES,
  attendance: ATTENDANCE_SEED,

  punch: (empId, type) => {
    const s = get();
    const emp = s.employees.find((e) => e.id === empId)!;
    const t = nowMin();
    const date = todayKey();
    const st = s.attendance.find((a) => a.empId === empId && a.date === date);

    if (!s.online) {
      const q: OfflinePunch = { id: `oq-${Date.now()}`, empId, type, at: new Date().toISOString() };
      set({ offlineQueue: [...s.offlineQueue, q] });
      s.auditLog(s.user.name, s.user.role, `تسجيل ${type === "in" ? "حضور" : "انصراف"} دون اتصال`, `${emp.name} — ${fmtMin(t)} (حُفظ محليًا وسيُزامَن)`);
      s.toast("لا يوجد اتصال بالإنترنت — حُفظ التسجيل محليًا وسيُزامَن تلقائيًا", "butter");
      return null;
    }

    if (type === "in") {
      if (st && st.in != null) {
        s.toast(`سُجّل حضورك مسبقًا الساعة ${fmtMin(st.in)}`, "butter");
        return st;
      }
      const rec: AttendanceRecord = {
        id: `at-${Date.now()}`, empId, date, in: t,
        out: st?.out ?? null, method: "qr",
      };
      set({ attendance: [...s.attendance, rec] });
      const late = dayStats(rec, emp.shift).late;
      s.toast(`تم تسجيل الحضور الساعة ${fmtMin(t)}${late > 0 ? ` — تنبيه: متأخر ${late} دقيقة` : " — في الوقت المحدد"}`, late > 0 ? "berry" : "sage");
      return rec;
    }
    if (!st || st.in == null) {
      s.toast("يجب تسجيل الحضور أولًا قبل الانصراف", "berry");
      return null;
    }
    if (st.out != null) {
      s.toast(`سُجّل انصرافك مسبقًا الساعة ${fmtMin(st.out)}`, "butter");
      return st;
    }
    const upd = { ...st, out: t };
    set({ attendance: s.attendance.map((a) => (a.id === st.id ? upd : a)) });
    s.toast(`تم تسجيل الانصراف الساعة ${fmtMin(t)} — يوم عمل موفق`, "sage");
    return upd;
  },

  manualPunch: (empId, date, inMin, outMin) => {
    const s = get();
    const emp = s.employees.find((e) => e.id === empId)!;
    const rec: AttendanceRecord = {
      id: `at-${Date.now()}`, empId, date, in: inMin, out: outMin, method: "manual", bySupervisor: true,
    };
    set({ attendance: [...s.attendance.filter((a) => !(a.empId === empId && a.date === date)), rec] });
    s.auditLog(s.user.name, s.user.role, "إدخال حضور يدوي", `${emp.name} — ${date} من ${fmtMin(inMin)} إلى ${outMin == null ? "—" : fmtMin(outMin)}`);
    s.toast(`تم الإدخال اليدوي لحضور ${emp.name}`, "brand");
  },

  adjustSalary: (empId, newBase) => {
    const s = get();
    const emp = s.employees.find((e) => e.id === empId)!;
    set({ employees: s.employees.map((e) => (e.id === empId ? { ...e, baseSalary: newBase } : e)) });
    s.auditLog(s.user.name, s.user.role, "تعديل راتب أساسي", `${emp.name}: ${fmtMoney0(emp.baseSalary)} ← ${fmtMoney0(newBase)}`);
    s.toast(`تم تعديل راتب ${emp.name} إلى ${fmtMoney0(newBase)} — سُجّل في التدقيق`, "brand");
  },

  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  setOnline: (v) => {
    const s = get();
    set({ online: v });
    if (!v) {
      s.toast("انقطع الاتصال — وضع العمل دون اتصال مفعّل", "butter");
      return;
    }
    if (s.offlineQueue.length === 0) {
      s.toast("عاد الاتصال بالإنترنت", "sage");
      return;
    }
    let attendance = [...s.attendance];
    let synced = 0;
    for (const q of s.offlineQueue) {
      const d = new Date(q.at);
      const date = dateKey(d);
      const t = d.getHours() * 60 + d.getMinutes();
      const existing = attendance.find((a) => a.empId === q.empId && a.date === date);
      if (q.type === "in") {
        if (existing && existing.in != null) continue;
        if (existing) {
          attendance = attendance.map((a) => (a.id === existing.id ? { ...a, in: t, method: "manual" as const } : a));
        } else {
          attendance.push({ id: `at-${Date.now()}-${synced}`, empId: q.empId, date, in: t, out: null, method: "manual" });
        }
      } else {
        if (!existing || existing.in == null || existing.out != null) continue;
        attendance = attendance.map((a) => (a.id === existing.id ? { ...a, out: t } : a));
      }
      synced++;
    }
    set({ attendance, offlineQueue: [] });
    s.auditLog("النظام", "super", "مزامنة تسجيلات دون اتصال", `تمت مزامنة ${synced} تسجيل محفوظ محليًا بعد عودة الاتصال`);
    s.toast(`عاد الاتصال — تمت مزامنة ${synced} تسجيل محفوظ`, "sage");
  },
  offlineQueue: [],

  leaves: LEAVES_SEED,
  applyLeave: (empId, type, from, to, reason) => {
    const s = get();
    set({
      leaves: [{ id: `lv-${Date.now()}`, empId, type, from, to, reason, status: "pending" }, ...s.leaves],
    });
    s.toast("تم إرسال طلب الإجازة — بانتظار موافقة الموارد البشرية", "brand");
  },
  decideLeave: (id, status) => {
    const s = get();
    const lv = s.leaves.find((l) => l.id === id)!;
    const emp = s.employees.find((e) => e.id === lv.empId)!;
    set({ leaves: s.leaves.map((l) => (l.id === id ? { ...l, status } : l)) });
    s.auditLog(s.user.name, s.user.role, status === "approved" ? "الموافقة على إجازة" : "رفض إجازة", `${emp.name} — ${LEAVE_AR[lv.type]} من ${lv.from} إلى ${lv.to}`);
    s.toast(status === "approved" ? `تمت الموافقة على طلب ${emp.name}` : `تم رفض طلب ${emp.name}`, status === "approved" ? "sage" : "berry");
  },

  advances: ADVANCES_SEED,
  addAdvance: (empId, amount, note) => {
    const s = get();
    const emp = s.employees.find((e) => e.id === empId)!;
    set({
      advances: [{ id: `ad-${Date.now()}`, empId, amount, note, date: todayKey() }, ...s.advances],
    });
    s.auditLog(s.user.name, s.user.role, "تسجيل سلفة", `${emp.name} — ${fmtMoney0(amount)} (${note})`);
    s.toast(`تم تسجيل سلفة ${fmtMoney0(amount)} لـ${emp.name} — ستُخصم من مسير الشهر تلقائيًا`, "brand");
  },

  finalizedMonths: [],
  finalizePayroll: (month) => {
    const s = get();
    if (s.finalizedMonths.includes(month)) return;
    const active = s.employees.filter((e) => e.active);
    const totals = active.map((e) => computePayroll(e, month, s.attendance, s.leaves, s.advances));
    const netSum = round2(totals.reduce((x, r) => x + r.net, 0));
    set({
      finalizedMonths: [...s.finalizedMonths, month],
      advances: s.advances.map((a) => (a.settledMonth ? a : { ...a, settledMonth: month })),
    });
    s.auditLog(s.user.name, s.user.role, "اعتماد مسير رواتب", `اعتماد مسير ${monthLabel(month)} — ${active.length} قسيمة بإجمالي ${fmtMoney0(netSum)}`);
    s.toast(`تم اعتماد مسير ${monthLabel(month)}: ${active.length} قسيمة بإجمالي ${fmtMoney0(netSum)}`, "sage");
  },

  products: PRODUCTS,
  cart: [],
  cartOpen: false,
  setCartOpen: (v) => set({ cartOpen: v }),
  checkoutOpen: false,
  setCheckoutOpen: (v) => set({ checkoutOpen: v }),
  addToCart: (productId, tier, qty) => {
    const s = get();
    const existing = s.cart.find((l) => l.productId === productId && l.tier === tier);
    const cart = existing
      ? s.cart.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l))
      : [...s.cart, { productId, tier, qty }];
    set({ cart });
    const p = s.products.find((x) => x.id === productId)!;
    s.toast(`أُضيف إلى السلة: ${p.name}`, "sage");
  },
  setLineQty: (productId, tier, qty) =>
    set((s) => ({
      cart: s.cart.map((l) => (l.productId === productId && l.tier === tier ? { ...l, qty: Math.max(1, qty) } : l)),
    })),
  removeLine: (productId, tier) =>
    set((s) => ({ cart: s.cart.filter((l) => !(l.productId === productId && l.tier === tier)) })),

  orders: ORDERS_SEED,
  placeOrder: (customer, phone, deliverOn, window, payment) => {
    const s = get();
    const sum = cartSummary(s.cart, s.products);
    const order: Order = {
      id: `OW-${2420 + s.orders.length}`,
      customer, customerPhone: phone,
      lines: [...s.cart],
      subtotal: sum.subtotal, discount: sum.discount, deliveryFee: sum.deliveryFee, total: sum.total,
      status: "pending", placedAt: todayKey(), deliverOn, window, payment,
    };
    set({
      orders: [order, ...s.orders],
      cart: [], cartOpen: false, checkoutOpen: false,
      products: s.products.map((p) => {
        const used = order.lines
          .filter((l) => l.productId === p.id)
          .reduce((acc, l) => acc + cartonsOf(l.tier, l.qty), 0);
        return used ? { ...p, stock: Math.max(0, p.stock - Math.round(used)) } : p;
      }),
    });
    s.auditLog(s.user.name, s.user.role, "إنشاء طلب", `${order.id} لـ${customer} بإجمالي ${fmtMoney0(order.total)}`);
    s.toast(`تم إنشاء الطلب ${order.id} بنجاح — سنتواصل معك للتأكيد`, "sage");
    return order;
  },
  advanceOrder: (id) => {
    const s = get();
    const o = s.orders.find((x) => x.id === id)!;
    if (o.status === "delivered") return;
    const next = NEXT[o.status];
    set({ orders: s.orders.map((x) => (x.id === id ? { ...x, status: next } : x)) });
    s.auditLog(s.user.name, s.user.role, "تحديث حالة طلب", `${id} ← ${STATUS_AR[next]}`);
    s.toast(`تحديث الطلب ${id}: ${STATUS_AR[next]}`, "brand");
  },

  raw: RAW_MATERIALS,
  receiveStock: (id, qty) => {
    const s = get();
    const m = s.raw.find((x) => x.id === id)!;
    set({ raw: s.raw.map((x) => (x.id === id ? { ...x, qty: Math.min(x.capacity, x.qty + qty) } : x)) });
    s.auditLog(s.user.name, s.user.role, "استلام مواد خام", `${m.name} +${qty} ${m.unit} من ${m.supplier}`);
    s.toast(`تم استلام ${qty} ${m.unit} من ${m.name}`, "sage");
  },
  batches: BATCHES,

  audit: AUDIT_SEED,
  toasts: [],
  toast: (msg, tone = "brand") => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, msg, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  auditLog: (actor, role, action, detail) => pushAudit(actor, role, action, detail),
}));

// أداة التدقيق — السجل ملحق فقط وغير قابل للتعديل أو الحذف
export function pushAudit(actor: string, role: Role, action: string, detail: string) {
  useStore.setState((s) => ({
    audit: [{ id: `au-${auditSeq++}-${Date.now()}`, at: `${todayKey()} ${new Date().toTimeString().slice(0, 5)}`, actor, role, action, detail }, ...s.audit],
  }));
}

export const deliveryMinDate = () => {
  const d = addDays(new Date(), 2);
  if (d.getDay() === 5) d.setDate(d.getDate() + 1); // لا توصيل يوم الجمعة
  return dateKey(d);
};
