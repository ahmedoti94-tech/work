// ─── Ovenwright Biscuit Works · Domain Types ────────────────────────────────

export type Role = "super_admin" | "hr" | "production" | "sales" | "customer";

export interface User {
  id: string;
  name: string;
  role: Role;
  title: string;
  org?: string;
}

export type ShiftKey = "morning" | "evening" | "night";

export interface Employee {
  id: string;
  name: string;
  code: string; // badge code e.g. OW-0114
  title: string;
  dept: "Production" | "Packaging" | "Quality" | "Warehouse" | "Maintenance" | "Administration";
  shift: ShiftKey;
  baseSalary: number; // monthly, USD
  joinDate: string;
  hue: number; // avatar hue
  active: boolean;
}

export type PunchSource = "qr" | "manual" | "supervisor";

export interface AttendanceRecord {
  id: string;
  empId: string;
  date: string; // YYYY-MM-DD
  in: number | null; // minutes since midnight
  out: number | null;
  source: PunchSource;
  note?: string;
}

export type LeaveType = "sick" | "annual" | "unpaid" | "permission";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  empId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedBy?: string;
}

export interface Advance {
  id: string;
  empId: string;
  amount: number;
  date: string;
  note: string;
  settledMonth?: string; // month key it was deducted in
}

export type PackTier = "box" | "carton" | "pallet";

export interface PackOption {
  tier: PackTier;
  label: string; // "24 × 180g packs"
  units: number;
  price: number; // per pack unit
}

export interface Product {
  id: string;
  name: string;
  arabicName: string;
  flavor: string;
  family: "Chocolate" | "Sesame" | "Dates" | "Butter" | "Oat" | "Fruit" | "Coconut";
  img: string;
  weight: string;
  ingredients: string[];
  nutrition: { label: string; value: string }[];
  packs: PackOption[];
  moqCartons: number; // minimum order quantity in cartons
  stock: number; // cartons on hand
  rating: number;
  soldRank: number; // 1 = best seller
  badge?: string;
}

export interface CartLine {
  productId: string;
  tier: PackTier;
  qty: number;
}

export type OrderStatus = 0 | 1 | 2 | 3; // Pending → Baking/Packaging → Shipped → Delivered
export const ORDER_STAGES = ["Pending", "Baking & Packaging", "Shipped", "Delivered"] as const;

export interface OrderItem {
  productId: string;
  name: string;
  tier: PackTier;
  tierLabel: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  ref: string;
  customer: string;
  kind: "B2B" | "B2C";
  placedAt: string; // ISO
  items: OrderItem[];
  subtotal: number;
  volumeDiscount: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  timeline: { stage: OrderStatus; at: string }[];
  payment: "cod" | "bank" | "card";
  deliveryDate: string;
  deliveryWindow: string;
  address: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string; // kg, L, roll
  stock: number;
  reorderAt: number;
  costPerUnit: number;
  supplier: string;
  lastDelivery: string;
}

export interface Batch {
  id: string;
  productId: string;
  batchNo: string;
  qty: number; // cartons
  producedAt: string;
  shelfLifeDays: number;
  line: "Line A" | "Line B" | "Line C";
}

export type Severity = "info" | "warning" | "critical";

export interface AuditEntry {
  id: string;
  at: string; // ISO
  actor: string;
  role: Role;
  action: string;
  target: string;
  detail: string;
  severity: Severity;
}

export interface PayrollRow {
  label: string;
  value: number;
  kind: "earn" | "deduct" | "info";
  sub?: string;
}

export interface PayrollResult {
  empId: string;
  monthKey: string;
  workDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  perDay: number;
  hourly: number;
  baseEarned: number;
  otHours: number;
  otPay: number;
  lateMinutes: number;
  lateDeduction: number;
  gross: number;
  advancesTotal: number;
  net: number;
  rows: PayrollRow[];
}

export type ViewKey =
  | "dashboard"
  | "market"
  | "orders"
  | "attendance"
  | "payroll"
  | "leaves"
  | "inventory"
  | "system";
