import type {
  Advance,
  AttendanceRecord,
  AuditEntry,
  Batch,
  Employee,
  LeaveRequest,
  Order,
  Product,
  RawMaterial,
  User,
} from "./types";
import { addDays, dateKey, isWorkday, nowMin, todayKey } from "./payroll";

// Deterministic PRNG so the factory data is stable across reloads
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1987);
const between = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const img = (id: string) => `https://image.qwenlm.ai/generated-images/${id}/_result.png`;

// ─── Users (role switcher = demo RBAC sign-in) ─────────────────────────────
export const USERS: User[] = [
  { id: "u-samir", name: "Samir Qassab", role: "super_admin", title: "General Manager" },
  { id: "u-layla", name: "Layla Haddad", role: "hr", title: "HR Manager" },
  { id: "u-omar", name: "Omar Suleiman", role: "production", title: "Production & Inventory Mgr" },
  { id: "u-nadia", name: "Nadia Rahman", role: "sales", title: "Senior Sales Rep" },
  { id: "u-mariam", name: "Mariam Adel", role: "customer", title: "Procurement — Al-Noor Markets", org: "Al-Noor Markets Co." },
];

// ─── Employees ──────────────────────────────────────────────────────────────
export const EMPLOYEES: Employee[] = [
  { id: "e01", name: "Ahmed Mansour", code: "OW-0114", title: "Line A Supervisor", dept: "Production", shift: "morning", baseSalary: 2150, joinDate: "2016-03-12", hue: 24, active: true },
  { id: "e02", name: "Fatima Zahra", code: "OW-0127", title: "Dough Mixer Operator", dept: "Production", shift: "morning", baseSalary: 1480, joinDate: "2019-07-01", hue: 200, active: true },
  { id: "e03", name: "Yusuf Karim", code: "OW-0133", title: "Oven Operator", dept: "Production", shift: "evening", baseSalary: 1620, joinDate: "2018-01-20", hue: 262, active: true },
  { id: "e04", name: "Salma Idris", code: "OW-0141", title: "Packaging Lead", dept: "Packaging", shift: "morning", baseSalary: 1390, joinDate: "2021-02-14", hue: 330, active: true },
  { id: "e05", name: "Hassan Farouk", code: "OW-0152", title: "Forklift / Warehouse", dept: "Warehouse", shift: "evening", baseSalary: 1240, joinDate: "2020-10-05", hue: 150, active: true },
  { id: "e06", name: "Nour ElDin", code: "OW-0160", title: "QC Technician", dept: "Quality", shift: "morning", baseSalary: 1710, joinDate: "2017-09-18", hue: 45, active: true },
  { id: "e07", name: "Rania Boutros", code: "OW-0168", title: "Baker — Line B", dept: "Production", shift: "morning", baseSalary: 1320, joinDate: "2022-04-11", hue: 12, active: true },
  { id: "e08", name: "Karim Aziz", code: "OW-0171", title: "Maintenance Engineer", dept: "Maintenance", shift: "night", baseSalary: 1980, joinDate: "2015-06-30", hue: 210, active: true },
  { id: "e09", name: "Dalia Mostafa", code: "OW-0183", title: "Packaging Operator", dept: "Packaging", shift: "evening", baseSalary: 1150, joinDate: "2023-01-09", hue: 285, active: true },
  { id: "e10", name: "Tariq Bishara", code: "OW-0190", title: "Syrup & Filling Op.", dept: "Production", shift: "evening", baseSalary: 1280, joinDate: "2021-11-22", hue: 90, active: true },
  { id: "e11", name: "Mona Salib", code: "OW-0197", title: "Lab Analyst", dept: "Quality", shift: "morning", baseSalary: 1560, joinDate: "2019-05-04", hue: 175, active: true },
  { id: "e12", name: "George Antoun", code: "OW-0204", title: "Night Watch / Utilities", dept: "Maintenance", shift: "night", baseSalary: 1090, joinDate: "2022-08-15", hue: 60, active: true },
];

// ─── Attendance history (last 45 work days + partial today) ────────────────
const SHIFT_START: Record<string, number> = { morning: 360, evening: 840, night: 1320 };
const SHIFT_END: Record<string, number> = { morning: 840, evening: 1320, night: 1800 };

function buildAttendance(): AttendanceRecord[] {
  const out: AttendanceRecord[] = [];
  const today = new Date();
  const now = nowMin();
  for (let back = 45; back >= 0; back--) {
    const d = addDays(today, -back);
    if (!isWorkday(d)) continue;
    const key = dateKey(d);
    const isToday = back === 0;
    EMPLOYEES.forEach((emp, idx) => {
      // approved-leave absences are handled by the leave seed (e03 this month)
      if (emp.id === "e03" && back <= 4 && back >= 2) return;
      const attendChance = back === 0 ? 1 : 0.9;
      if (rnd() > attendChance && !isToday) return; // unplanned absence
      const jitterIn = Math.round(between(-8, 26));
      let cin = SHIFT_START[emp.shift] + jitterIn;
      if (isToday) {
        // only some of the crew has punched in so far this morning
        if (idx >= 8) return;
        cin = Math.max(1, Math.min(cin, now - Math.round(between(3, 40))));
        if (cin > now) cin = Math.max(1, now - 5);
      }
      const hasOut = !isToday || idx < 2; // two early clock-outs demoed today
      const cout = hasOut
        ? SHIFT_END[emp.shift] + Math.round(between(-25, 95))
        : null;
      out.push({
        id: `a-${emp.id}-${key}`,
        empId: emp.id,
        date: key,
        in: cin,
        out: cout,
        source: rnd() > 0.12 ? "qr" : pick(["manual", "supervisor"] as const),
      });
    });
  }
  return out;
}
export const ATTENDANCE: AttendanceRecord[] = buildAttendance();

// ─── Leaves & advances ──────────────────────────────────────────────────────
const today = new Date();
const dk = (n: number) => dateKey(addDays(today, n));
export const LEAVES: LeaveRequest[] = [
  { id: "lv1", empId: "e03", type: "sick", from: dk(-4), to: dk(-2), days: 3, reason: "Flu, doctor's note attached", status: "approved", decidedBy: "Layla Haddad" },
  { id: "lv2", empId: "e07", type: "annual", from: dk(6), to: dk(9), days: 4, reason: "Family wedding in Alexandria", status: "pending" },
  { id: "lv3", empId: "e05", type: "permission", from: dk(1), to: dk(1), days: 1, reason: "Bank & paperwork appointment", status: "pending" },
  { id: "lv4", empId: "e09", type: "unpaid", from: dk(-9), to: dk(-8), days: 2, reason: "Personal travel — no paid balance left", status: "approved", decidedBy: "Layla Haddad" },
  { id: "lv5", empId: "e10", type: "annual", from: dk(-15), to: dk(-13), days: 3, reason: "Annual leave balance", status: "approved", decidedBy: "Layla Haddad" },
  { id: "lv6", empId: "e12", type: "sick", from: dk(-2), to: dk(-1), days: 2, reason: "Back strain", status: "rejected", decidedBy: "Layla Haddad" },
];

export const ADVANCES: Advance[] = [
  { id: "ad1", empId: "e02", amount: 150, date: dk(-6), note: "School fees advance" },
  { id: "ad2", empId: "e05", amount: 220, date: dk(-12), note: "Rent advance" },
  { id: "ad3", empId: "e09", amount: 90, date: dk(-3), note: "Medical advance" },
  { id: "ad4", empId: "e01", amount: 300, date: dk(-40), note: "Eid advance", settledMonth: "settled" },
];

// ─── Products ───────────────────────────────────────────────────────────────
const packsFor = (boxUnits: number, boxPrice: number) => {
  const carton = Math.round(boxPrice * 0.96 * 100) / 100;
  const pallet = Math.round(boxPrice * 0.9 * 100) / 100;
  return [
    { tier: "box" as const, label: `Box · ${boxUnits} packs`, units: boxUnits, price: boxPrice },
    { tier: "carton" as const, label: `Carton · ${boxUnits * 12} packs`, units: boxUnits * 12, price: carton },
    { tier: "pallet" as const, label: `Pallet · ${boxUnits * 12 * 60} packs`, units: boxUnits * 12 * 60, price: pallet },
  ];
};
const nutrition = (energy: number, sugar: number, fat: number) => [
  { label: "Energy", value: `${energy} kcal` },
  { label: "Protein", value: "6.1 g" },
  { label: "Carbohydrates", value: "64 g" },
  { label: "of which sugars", value: `${sugar} g` },
  { label: "Total fat", value: `${fat} g` },
  { label: "Fibre", value: "2.4 g" },
  { label: "Sodium", value: "0.31 g" },
];

export const PRODUCTS: Product[] = [
  {
    id: "p1", name: "Heritage Butter Rounds", arabicName: "بسكويت الزبدة", flavor: "Salted Butter", family: "Butter",
    img: img("b10311c0-6756-4eaf-9661-5d8e1de2fbaf"), weight: "180 g",
    ingredients: ["Wheat flour", "Butter 24%", "Sugar", "Whole milk powder", "Sea salt", "Natural vanilla"],
    nutrition: nutrition(489, 21, 22), packs: packsFor(24, 1.15), moqCartons: 5, stock: 342, rating: 4.9, soldRank: 2, badge: "Best Seller",
  },
  {
    id: "p2", name: "Midnight Choco Chunk", arabicName: "كوكيز الشوكولاتة", flavor: "Dark Chocolate", family: "Chocolate",
    img: img("f08db7d8-ab26-44ec-a816-97ecad2e7f56"), weight: "200 g",
    ingredients: ["Wheat flour", "Dark chocolate chunks 22%", "Brown sugar", "Butter", "Cocoa powder", "Egg", "Baking soda"],
    nutrition: nutrition(512, 27, 26), packs: packsFor(20, 1.35), moqCartons: 5, stock: 418, rating: 4.8, soldRank: 1, badge: "#1 Seller",
  },
  {
    id: "p3", name: "Simsim Sesame Snaps", arabicName: "سمسمية", flavor: "Toasted Sesame", family: "Sesame",
    img: img("ad6809d7-7a9b-400c-ad41-9af066c8b039"), weight: "150 g",
    ingredients: ["Sesame seeds 58%", "Glucose syrup", "Sugar", "Butter", "Lemon juice"],
    nutrition: nutrition(531, 24, 31), packs: packsFor(24, 1.05), moqCartons: 8, stock: 265, rating: 4.7, soldRank: 3,
  },
  {
    id: "p4", name: "Maamoul Date Bites", arabicName: "معمول التمر", flavor: "Ajwa Dates", family: "Dates",
    img: img("d6519e5c-3db5-4123-9b49-610620551bbe"), weight: "250 g",
    ingredients: ["Semolina", "Ajwa date paste 34%", "Butter", "Flour", "Orange blossom water", "Cardamom"],
    nutrition: nutrition(468, 30, 18), packs: packsFor(18, 1.6), moqCartons: 6, stock: 198, rating: 4.9, soldRank: 4, badge: "Seasonal Star",
  },
  {
    id: "p5", name: "Oat & Honey Digestives", arabicName: "بسكويت الشوفان", flavor: "Oat & Honey", family: "Oat",
    img: img("c7dbc7b6-dc36-4cf8-9ecc-53b92a2d5c78"), weight: "220 g",
    ingredients: ["Wholegrain oats 41%", "Wholemeal flour", "Sunflower oil", "Wildflower honey 7%", "Malt extract", "Raising agents"],
    nutrition: nutrition(471, 16, 20), packs: packsFor(22, 1.2), moqCartons: 5, stock: 301, rating: 4.6, soldRank: 5,
  },
  {
    id: "p6", name: "Vanilla Wafer Sticks", arabicName: "ويڤر ڤانيليا", flavor: "Vanilla Cream", family: "Butter",
    img: img("dbe8c237-56a0-4a63-aa92-9529b0f7c4ee"), weight: "120 g",
    ingredients: ["Wheat flour", "Palm oil", "Sugar", "Whey powder", "Natural vanilla 1.2%", "Emulsifier (soy lecithin)"],
    nutrition: nutrition(523, 25, 28), packs: packsFor(30, 0.95), moqCartons: 10, stock: 456, rating: 4.5, soldRank: 6,
  },
  {
    id: "p7", name: "Toasted Coconut Crackers", arabicName: "بسكويت جوز الهند", flavor: "Coconut", family: "Coconut",
    img: img("804a5396-3e21-49a4-b574-0b5596bf53a5"), weight: "160 g",
    ingredients: ["Wheat flour", "Desiccated coconut 19%", "Coconut oil", "Sugar", "Sea salt", "Yeast"],
    nutrition: nutrition(498, 14, 24), packs: packsFor(24, 1.1), moqCartons: 6, stock: 88, rating: 4.4, soldRank: 7,
  },
  {
    id: "p8", name: "Lemon Shortbread Fingers", arabicName: "شورت بريد الليمون", flavor: "Lemon Zest", family: "Fruit",
    img: img("b417e6ce-a99c-4e13-b319-4a71f052dc91"), weight: "175 g",
    ingredients: ["Wheat flour", "Butter 26%", "Icing sugar", "Lemon zest 2%", "Citric acid", "Natural lemon oil"],
    nutrition: nutrition(484, 22, 23), packs: packsFor(20, 1.25), moqCartons: 5, stock: 143, rating: 4.7, soldRank: 8,
  },
];

// ─── Inventory ──────────────────────────────────────────────────────────────
export const RAW_MATERIALS: RawMaterial[] = [
  { id: "rm1", name: "Premium Wheat Flour", unit: "kg", stock: 18400, reorderAt: 8000, costPerUnit: 0.42, supplier: "Nile Mills Co.", lastDelivery: dk(-4) },
  { id: "rm2", name: "Refined Sugar", unit: "kg", stock: 6200, reorderAt: 4000, costPerUnit: 0.51, supplier: "Delta Sugar", lastDelivery: dk(-9) },
  { id: "rm3", name: "Butter (82% fat)", unit: "kg", stock: 2950, reorderAt: 3200, costPerUnit: 4.1, supplier: "Green Pastures Dairy", lastDelivery: dk(-6) },
  { id: "rm4", name: "Cocoa Powder 22%", unit: "kg", stock: 1180, reorderAt: 600, costPerUnit: 3.4, supplier: "CacaoTrade Intl.", lastDelivery: dk(-14) },
  { id: "rm5", name: "Sesame Seeds", unit: "kg", stock: 720, reorderAt: 800, costPerUnit: 2.2, supplier: "Simsim Export Co.", lastDelivery: dk(-11) },
  { id: "rm6", name: "Ajwa Date Paste", unit: "kg", stock: 1540, reorderAt: 700, costPerUnit: 2.9, supplier: "Qasr Dates", lastDelivery: dk(-7) },
  { id: "rm7", name: "Rolled Oats", unit: "kg", stock: 2100, reorderAt: 900, costPerUnit: 0.88, supplier: "Highland Grains", lastDelivery: dk(-16) },
  { id: "rm8", name: "Flow-pack Film Roll", unit: "roll", stock: 46, reorderAt: 60, costPerUnit: 38, supplier: "PackRight", lastDelivery: dk(-13) },
];

export const BATCHES: Batch[] = [
  { id: "b1", productId: "p2", batchNo: "LOT-2481-A", qty: 220, producedAt: dk(-2), shelfLifeDays: 270, line: "Line A" },
  { id: "b2", productId: "p1", batchNo: "LOT-2479-B", qty: 180, producedAt: dk(-3), shelfLifeDays: 240, line: "Line B" },
  { id: "b3", productId: "p4", batchNo: "LOT-2476-A", qty: 96, producedAt: dk(-6), shelfLifeDays: 120, line: "Line A" },
  { id: "b4", productId: "p3", batchNo: "LOT-2470-C", qty: 140, producedAt: dk(-12), shelfLifeDays: 21, line: "Line C" },
  { id: "b5", productId: "p5", batchNo: "LOT-2468-B", qty: 120, producedAt: dk(-15), shelfLifeDays: 180, line: "Line B" },
  { id: "b6", productId: "p6", batchNo: "LOT-2462-A", qty: 260, producedAt: dk(-20), shelfLifeDays: 300, line: "Line A" },
  { id: "b7", productId: "p7", batchNo: "LOT-2455-C", qty: 64, producedAt: dk(-32), shelfLifeDays: 36, line: "Line C" },
  { id: "b8", productId: "p8", batchNo: "LOT-2451-B", qty: 88, producedAt: dk(-26), shelfLifeDays: 30, line: "Line B" },
];

// ─── Orders ─────────────────────────────────────────────────────────────────
function mkOrder(
  n: number, customer: string, kind: "B2B" | "B2C", daysAgo: number, status: 0 | 1 | 2 | 3,
  lines: [string, "box" | "carton" | "pallet", number][], payment: Order["payment"]
): Order {
  const placed = new Date(); placed.setDate(placed.getDate() - daysAgo); placed.setHours(9 + n, 12, 0, 0);
  const items = lines.map(([pid, tier, qty]) => {
    const p = PRODUCTS.find((x) => x.id === pid)!;
    const pack = p.packs.find((x) => x.tier === tier)!;
    return {
      productId: pid, name: p.name, tier, tierLabel: pack.label, qty,
      unitPrice: pack.price, lineTotal: Math.round(pack.price * pack.units * qty * 100) / 100,
    };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  const volumeDiscount = kind === "B2B" ? Math.round(subtotal * 0.09 * 100) / 100 : 0;
  const deliveryFee = subtotal - volumeDiscount > 400 ? 0 : 14;
  const total = Math.round((subtotal - volumeDiscount + deliveryFee) * 100) / 100;
  const timeline: Order["timeline"] = [];
  const stages: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
  stages.forEach((s, i) => {
    if (s <= status) {
      const t = new Date(placed); t.setHours(t.getHours() + i * 14 + 2);
      if (s === 3 && status === 3) t.setDate(t.getDate() + 1);
      timeline.push({ stage: s, at: t.toISOString() });
    }
  });
  const dd = new Date(placed); dd.setDate(dd.getDate() + 3);
  return {
    id: `o${n}`, ref: `OW-${2400 + n}`, customer, kind, placedAt: placed.toISOString(),
    items, subtotal, volumeDiscount, deliveryFee, total, status, timeline, payment,
    deliveryDate: dateKey(dd), deliveryWindow: "09:00 – 13:00",
    address: kind === "B2B" ? "Central warehouse, 6th of October City" : "Villa 22, Palm Grove district",
  };
}

export const ORDERS: Order[] = [
  mkOrder(18, "Al-Noor Markets Co.", "B2B", 1, 0, [["p2", "pallet", 1], ["p1", "carton", 40]], "bank"),
  mkOrder(17, "Carrefour — Nasr City", "B2B", 2, 1, [["p4", "carton", 30], ["p3", "carton", 24]], "bank"),
  mkOrder(16, "Mariam Adel", "B2C", 3, 1, [["p1", "box", 6], ["p8", "box", 4]], "card"),
  mkOrder(15, "Sunrise Cafés Group", "B2B", 4, 2, [["p6", "carton", 50], ["p5", "carton", 18]], "cod"),
  mkOrder(14, "Huda Sami", "B2C", 5, 2, [["p2", "box", 8]], "cod"),
  mkOrder(13, "Lulu Hypermarket", "B2B", 7, 3, [["p2", "pallet", 2], ["p7", "carton", 30]], "bank"),
  mkOrder(12, "Omar Khalifa", "B2C", 9, 3, [["p4", "box", 10], ["p1", "box", 5]], "card"),
];

// ─── Audit trail (immutable) ───────────────────────────────────────────────
export const AUDIT_SEED: AuditEntry[] = [
  { id: "au1", at: new Date(Date.now() - 1000 * 60 * 42).toISOString(), actor: "Layla Haddad", role: "hr", action: "Payroll advance issued", target: "Dalia Mostafa · $90", detail: "Medical advance, to be settled in current payroll run", severity: "warning" },
  { id: "au2", at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), actor: "Omar Suleiman", role: "production", action: "Stock delivery received", target: "Premium Wheat Flour +6,000 kg", detail: "GRN-1187 · Nile Mills Co. · silo 2", severity: "info" },
  { id: "au3", at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), actor: "Samir Qassab", role: "super_admin", action: "Salary adjustment", target: "Karim Aziz · +$60/mo", detail: "Night-shift retention adjustment, effective this month", severity: "critical" },
  { id: "au4", at: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(), actor: "Nadia Rahman", role: "sales", action: "Order stage advanced", target: "OW-2415 → Shipped", detail: "Sunrise Cafés Group · 68 cartons · carrier TransFood", severity: "info" },
  { id: "au5", at: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(), actor: "Layla Haddad", role: "hr", action: "Attendance override", target: "Tariq Bishara · " + dk(-2), detail: "Missed gate punch corrected from CCTV log (06:02)", severity: "warning" },
  { id: "au6", at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), actor: "Layla Haddad", role: "hr", action: "Leave approved", target: "Yusuf Karim · Sick × 3 days", detail: "Doctor's note verified (REF-MD-5521)", severity: "info" },
  { id: "au7", at: new Date(Date.now() - 1000 * 60 * 60 * 34).toISOString(), actor: "Omar Suleiman", role: "production", action: "Batch quarantine lifted", target: "LOT-2470-C Sesame Snaps", detail: "QC moisture re-test passed 3.1% (spec ≤ 4%)", severity: "info" },
  { id: "au8", at: new Date(Date.now() - 1000 * 60 * 60 * 51).toISOString(), actor: "System", role: "super_admin", action: "Nightly payroll run", target: "Draft preview generated", detail: "12 employees · 0 anomalies · awaiting approval", severity: "info" },
];

// ─── Sales series (84 days) for analytics ──────────────────────────────────
export interface SalesPoint { day: string; label: string; revenue: number; units: number }
export function buildSalesSeries(): SalesPoint[] {
  const r = mulberry32(777);
  const out: SalesPoint[] = [];
  for (let back = 83; back >= 0; back--) {
    const d = addDays(new Date(), -back);
    const weekly = d.getDay() === 5 || d.getDay() === 6 ? 1.35 : d.getDay() === 0 ? 0.55 : 1;
    const trend = (83 - back) * 26;
    const noise = (r() - 0.5) * 1400;
    const revenue = Math.round(5400 * weekly + trend + noise);
    out.push({
      day: dateKey(d),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue,
      units: Math.round(revenue / 8.6),
    });
  }
  return out;
}

export const BEST_SELLERS = [...PRODUCTS].sort((a, b) => a.soldRank - b.soldRank).slice(0, 5);
export const todayStr = todayKey();
