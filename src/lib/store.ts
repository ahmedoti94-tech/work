import { create } from "zustand";
import type {
  Advance, AttendanceRecord, AuditEntry, Batch, CartLine, Employee, LeaveRequest,
  Order, OrderStatus, PackTier, Product, RawMaterial, Role, Severity, User, ViewKey,
} from "./types";
import { ORDER_STAGES } from "./types";
import {
  ADVANCES, ATTENDANCE, AUDIT_SEED, BATCHES, EMPLOYEES, LEAVES, ORDERS,
  PRODUCTS, RAW_MATERIALS, USERS,
} from "./data";
import { cartonsOf, nowMin, todayKey, volumeRate } from "./payroll";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  hr: "HR Manager",
  production: "Production Mgr",
  sales: "Sales Rep",
  customer: "Customer",
};

export const NAV_ACCESS: Record<ViewKey, Role[]> = {
  dashboard: ["super_admin", "hr", "production", "sales", "customer"],
  market: ["super_admin", "hr", "production", "sales", "customer"],
  orders: ["super_admin", "sales", "customer"],
  attendance: ["super_admin", "hr", "production"],
  payroll: ["super_admin", "hr"],
  leaves: ["super_admin", "hr"],
  inventory: ["super_admin", "production"],
  system: ["super_admin"],
};

const DEFAULT_VIEW: Record<Role, ViewKey> = {
  super_admin: "dashboard", hr: "attendance", production: "inventory",
  sales: "orders", customer: "market",
};

export interface CartLineDetail {
  product: Product; tier: PackTier; qty: number; unitPrice: number;
  packUnits: number; lineTotal: number; cartons: number; discount: number; afterDiscount: number;
}
export interface CartSummary {
  lines: CartLineDetail[]; subtotal: number; volumeDiscount: number;
  deliveryFee: number; total: number; issues: string[]; count: number;
}

interface State {
  theme: "light" | "dark";
  user: User;
  view: ViewKey;
  cartOpen: boolean;
  checkoutOpen: boolean;
  toast: { msg: string; tone: "ok" | "warn" } | null;

  employees: Employee[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  advances: Advance[];
  finalizedMonths: string[];
  products: Product[];
  orders: Order[];
  cart: CartLine[];
  rawMaterials: RawMaterial[];
  batches: Batch[];
  audit: AuditEntry[];

  toggleTheme: () => void;
  loginAs: (id: string) => void;
  setView: (v: ViewKey) => void;
  setCartOpen: (b: boolean) => void;
  setCheckoutOpen: (b: boolean) => void;
  pushToast: (msg: string, tone?: "ok" | "warn") => void;
  clearToast: () => void;
  log: (action: string, target: string, detail: string, severity: Severity) => void;

  checkIn: (empId: string) => void;
  checkOut: (empId: string) => void;
  manualPunch: (empId: string, cin: number, cout: number | null, note: string) => void;
  adjustSalary: (empId: string, delta: number) => void;
  grantAdvance: (empId: string, amount: number, note: string) => void;
  decideLeave: (id: string, approve: boolean) => void;
  finalizePayroll: (monthKey: string) => void;

  addToCart: (productId: string, tier: PackTier, qty: number) => void;
  setCartQty: (productId: string, tier: PackTier, qty: number) => void;
  removeCartLine: (productId: string, tier: PackTier) => void;
  cartSummary: () => CartSummary;
  placeOrder: (d: { payment: Order["payment"]; deliveryDate: string; deliveryWindow: string; address: string }) => Order | null;
  advanceOrder: (id: string) => void;
  receiveStock: (rmId: string, qty: number) => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const stored = (k: string, fallback: string) => {
  try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; }
};
const initialUser = USERS.find((u) => u.id === stored("ow-user", "u-samir")) ?? USERS[0];
const initialTheme = (stored("ow-theme", "light") as "light" | "dark");

export const useStore = create<State>((set, get) => ({
  theme: initialTheme,
  user: initialUser,
  view: DEFAULT_VIEW[initialUser.role],
  cartOpen: false,
  checkoutOpen: false,
  toast: null,

  employees: EMPLOYEES,
  attendance: ATTENDANCE,
  leaves: LEAVES,
  advances: ADVANCES,
  finalizedMonths: [],
  products: PRODUCTS,
  orders: ORDERS,
  cart: [],
  rawMaterials: RAW_MATERIALS,
  batches: BATCHES,
  audit: AUDIT_SEED,

  toggleTheme: () => set((s) => {
    const t = s.theme === "light" ? "dark" : "light";
    try { localStorage.setItem("ow-theme", t); } catch { /* private mode */ }
    document.documentElement.classList.toggle("dark", t === "dark");
    return { theme: t };
  }),

  loginAs: (id) => {
    const user = USERS.find((u) => u.id === id) ?? USERS[0];
    try { localStorage.setItem("ow-user", id); } catch { /* noop */ }
    set({ user, view: DEFAULT_VIEW[user.role], cartOpen: false, checkoutOpen: false });
    get().pushToast(`Signed in as ${user.name} · ${ROLE_LABEL[user.role]}`);
  },

  setView: (v) => set({ view: v }),
  setCartOpen: (b) => set({ cartOpen: b }),
  setCheckoutOpen: (b) => set({ checkoutOpen: b }),
  pushToast: (msg, tone = "ok") => {
    set({ toast: { msg, tone } });
    setTimeout(() => get().clearToast(), 3200);
  },
  clearToast: () => set({ toast: null }),

  log: (action, target, detail, severity) => set((s) => ({
    audit: [{
      id: `au-${uid()}`, at: new Date().toISOString(), actor: s.user.name,
      role: s.user.role, action, target, detail, severity,
    }, ...s.audit],
  })),

  // ── Time tracking ────────────────────────────────────────────────────────
  checkIn: (empId) => {
    const t = todayKey();
    const s = get();
    const existing = s.attendance.find((a) => a.empId === empId && a.date === t);
    if (existing && existing.in != null) { get().pushToast("Already checked in today", "warn"); return; }
    const rec: AttendanceRecord = existing
      ? { ...existing, in: nowMin(), source: "qr" }
      : { id: `a-${empId}-${t}`, empId, date: t, in: nowMin(), out: null, source: "qr" };
    set({ attendance: existing ? s.attendance.map((a) => (a.id === existing.id ? rec : a)) : [...s.attendance, rec] });
  },
  checkOut: (empId) => {
    const t = todayKey();
    const s = get();
    set({
      attendance: s.attendance.map((a) =>
        a.empId === empId && a.date === t && a.in != null ? { ...a, out: nowMin() } : a
      ),
    });
  },
  manualPunch: (empId, cin, cout, note) => {
    const t = todayKey();
    const s = get();
    const existing = s.attendance.find((a) => a.empId === empId && a.date === t);
    const rec: AttendanceRecord = {
      id: existing?.id ?? `a-${empId}-${t}`, empId, date: t, in: cin, out: cout,
      source: "supervisor", note,
    };
    set({ attendance: existing ? s.attendance.map((a) => (a.id === existing.id ? rec : a)) : [...s.attendance, rec] });
    const emp = s.employees.find((e) => e.id === empId);
    get().log("Manual attendance entry", `${emp?.name ?? empId} · ${t}`, note || "Supervisor desk entry", "warning");
  },
  adjustSalary: (empId, delta) => {
    const s = get();
    set({ employees: s.employees.map((e) => (e.id === empId ? { ...e, baseSalary: e.baseSalary + delta } : e)) });
    const emp = s.employees.find((e) => e.id === empId);
    get().log("Salary adjustment", `${emp?.name} · ${delta > 0 ? "+" : ""}$${delta}/mo`, "RBAC: super_admin only · dual approval recorded", "critical");
    get().pushToast(`Salary updated for ${emp?.name}`);
  },
  grantAdvance: (empId, amount, note) => {
    set((s) => ({ advances: [...s.advances, { id: `ad-${uid()}`, empId, amount, date: todayKey(), note }] }));
    const emp = get().employees.find((e) => e.id === empId);
    get().log("Payroll advance issued", `${emp?.name} · $${amount}`, note, "warning");
    get().pushToast(`Advance of $${amount} recorded for ${emp?.name}`);
  },
  decideLeave: (id, approve) => {
    set((s) => ({
      leaves: s.leaves.map((l) =>
        l.id === id ? { ...l, status: approve ? "approved" : "rejected", decidedBy: s.user.name } : l
      ),
    }));
    const l = get().leaves.find((x) => x.id === id);
    const emp = get().employees.find((e) => e.id === l?.empId);
    get().log(approve ? "Leave approved" : "Leave rejected", `${emp?.name} · ${l?.type} × ${l?.days}d`, l?.reason ?? "", "info");
    get().pushToast(`Leave ${approve ? "approved" : "rejected"} for ${emp?.name}`);
  },
  finalizePayroll: (monthKey) => {
    const s = get();
    if (s.finalizedMonths.includes(monthKey)) return;
    set({
      finalizedMonths: [...s.finalizedMonths, monthKey],
      advances: s.advances.map((a) => (a.settledMonth ? a : { ...a, settledMonth: monthKey })),
    });
    get().log("Payroll run finalized", `${monthKey} · ${s.employees.length} employees`, "Payslips issued & advances (السلف) settled", "critical");
    get().pushToast(`Payroll for ${monthKey} finalized — payslips issued`);
  },

  // ── Commerce ─────────────────────────────────────────────────────────────
  addToCart: (productId, tier, qty) => {
    const s = get();
    const existing = s.cart.find((c) => c.productId === productId && c.tier === tier);
    set({
      cart: existing
        ? s.cart.map((c) => (c === existing ? { ...c, qty: c.qty + qty } : c))
        : [...s.cart, { productId, tier, qty }],
      cartOpen: true,
    });
    const p = s.products.find((x) => x.id === productId);
    get().pushToast(`${p?.name} · ${tier} added to order`);
  },
  setCartQty: (productId, tier, qty) => set((s) => ({
    cart: qty <= 0
      ? s.cart.filter((c) => !(c.productId === productId && c.tier === tier))
      : s.cart.map((c) => (c.productId === productId && c.tier === tier ? { ...c, qty } : c)),
  })),
  removeCartLine: (productId, tier) => set((s) => ({
    cart: s.cart.filter((c) => !(c.productId === productId && c.tier === tier)),
  })),

  cartSummary: () => {
    const s = get();
    const byProduct = new Map<string, number>();
    s.cart.forEach((c) => byProduct.set(c.productId, (byProduct.get(c.productId) ?? 0) + cartonsOf(c.tier, c.qty)));
    const lines: CartLineDetail[] = s.cart.map((c) => {
      const product = s.products.find((p) => p.id === c.productId)!;
      const pack = product.packs.find((p) => p.tier === c.tier)!;
      const lineTotal = pack.price * pack.units * c.qty;
      const cartons = cartonsOf(c.tier, c.qty);
      const rate = volumeRate(byProduct.get(c.productId) ?? 0);
      const discount = lineTotal * rate;
      return {
        product, tier: c.tier, qty: c.qty, unitPrice: pack.price, packUnits: pack.units,
        lineTotal, cartons, discount, afterDiscount: lineTotal - discount,
      };
    });
    const subtotal = lines.reduce((t, l) => t + l.lineTotal, 0);
    const volumeDiscount = lines.reduce((t, l) => t + l.discount, 0);
    const deliveryFee = subtotal - volumeDiscount > 400 ? 0 : lines.length ? 14 : 0;
    const issues: string[] = [];
    byProduct.forEach((cartons, pid) => {
      const p = s.products.find((x) => x.id === pid)!;
      if (cartons < p.moqCartons) issues.push(`${p.name}: minimum order is ${p.moqCartons} cartons (you have ${Math.round(cartons * 10) / 10}).`);
      if (cartons > p.stock) issues.push(`${p.name}: only ${p.stock} cartons in stock.`);
    });
    return {
      lines, subtotal, volumeDiscount, deliveryFee,
      total: Math.max(0, subtotal - volumeDiscount + deliveryFee),
      issues, count: s.cart.reduce((n, c) => n + c.qty, 0),
    };
  },

  placeOrder: ({ payment, deliveryDate, deliveryWindow, address }) => {
    const s = get();
    const sum = s.cartSummary();
    if (sum.issues.length || !sum.lines.length) return null;
    const kind: "B2B" | "B2C" = s.user.org ? "B2B" : "B2C";
    const order: Order = {
      id: `o-${uid()}`, ref: `OW-${2419 + s.orders.length + 1}`,
      customer: s.user.org ?? s.user.name, kind, placedAt: new Date().toISOString(),
      items: sum.lines.map((l) => ({
        productId: l.product.id, name: l.product.name, tier: l.tier, tierLabel: `${l.tier} · ${l.packUnits} packs`,
        qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal,
      })),
      subtotal: Math.round(sum.subtotal * 100) / 100,
      volumeDiscount: Math.round(sum.volumeDiscount * 100) / 100,
      deliveryFee: sum.deliveryFee,
      total: Math.round(sum.total * 100) / 100,
      status: 0,
      timeline: [{ stage: 0, at: new Date().toISOString() }],
      payment, deliveryDate, deliveryWindow, address,
    };
    set({ orders: [order, ...s.orders], cart: [], checkoutOpen: false, cartOpen: false, view: "orders" });
    get().log("Order placed", `${order.ref} · $${order.total.toFixed(2)}`, `${order.kind} · ${order.items.length} line(s) · ${payment.toUpperCase()}`, "info");
    get().pushToast(`Order ${order.ref} placed — now in the baking queue`);
    return order;
  },

  advanceOrder: (id) => {
    const s = get();
    const order = s.orders.find((o) => o.id === id);
    if (!order || order.status >= 3) return;
    const next = (order.status + 1) as OrderStatus;
    set({
      orders: s.orders.map((o) =>
        o.id === id ? { ...o, status: next, timeline: [...o.timeline, { stage: next, at: new Date().toISOString() }] } : o
      ),
    });
    get().log("Order stage advanced", `${order.ref} → ${ORDER_STAGES[next]}`, `${order.customer} · ${order.kind}`, "info");
    get().pushToast(`${order.ref} moved to “${ORDER_STAGES[next]}”`);
  },

  receiveStock: (rmId, qty) => {
    const s = get();
    set({
      rawMaterials: s.rawMaterials.map((r) =>
        r.id === rmId ? { ...r, stock: r.stock + qty, lastDelivery: todayKey() } : r
      ),
    });
    const rm = s.rawMaterials.find((r) => r.id === rmId);
    get().log("Stock delivery received", `${rm?.name} +${qty.toLocaleString()} ${rm?.unit}`, `Supplier: ${rm?.supplier} · GRN-${Math.floor(1200 + Math.random() * 300)}`, "info");
    get().pushToast(`Received ${qty.toLocaleString()} ${rm?.unit} of ${rm?.name}`);
  },
}));

// apply persisted theme on boot
document.documentElement.classList.toggle("dark", initialTheme === "dark");
