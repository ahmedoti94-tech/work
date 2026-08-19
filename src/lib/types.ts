export type Role = "super" | "hr" | "production" | "sales" | "customer";

export interface User {
  id: string;
  name: string;
  role: Role;
  empId?: string;
  title: string;
}

export interface Employee {
  id: string;
  name: string;
  title: string;
  dept: string;
  shift: ShiftKey;
  baseSalary: number;
  joinDate: string;
  active: boolean;
  pin: string;
  phone: string;
}

export type ShiftKey = "morning" | "evening" | "night";

export interface AttendanceRecord {
  id: string;
  empId: string;
  date: string;
  in: number | null;
  out: number | null;
  method: "qr" | "manual";
  bySupervisor?: boolean;
}

export type LeaveType = "sick" | "annual" | "unpaid" | "permission";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  empId: string;
  type: LeaveType;
  from: string;
  to: string;
  reason: string;
  status: LeaveStatus;
}

export interface Advance {
  id: string;
  empId: string;
  amount: number;
  date: string;
  note: string;
  settledMonth?: string;
}

export interface PayrollRow {
  label: string;
  value: number;
  kind: "earn" | "deduct";
  sub: string;
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

export interface Pack {
  tier: PackTier;
  units: number;
  price: number;
  label: string;
}
export type PackTier = "box" | "carton" | "pallet";

export interface Product {
  id: string;
  name: string;
  latinName: string;
  flavor: string;
  family: string;
  weight: string;
  img: string;
  ingredients: string[];
  nutrition: { label: string; value: string }[];
  packs: Pack[];
  moqCartons: number;
  stock: number;
  rating: number;
  badge?: string;
  soldRank: number;
}

export interface CartLine {
  productId: string;
  tier: PackTier;
  qty: number;
}

export type OrderStatus = "pending" | "baking" | "shipped" | "delivered";
export type PaymentMethod = "cod" | "transfer" | "gateway";

export interface Order {
  id: string;
  customer: string;
  customerPhone: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  placedAt: string;
  deliverOn: string;
  window: string;
  payment: PaymentMethod;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  qty: number;
  reorderPoint: number;
  capacity: number;
  supplier: string;
}

export interface Batch {
  id: string;
  lot: string;
  productId: string;
  producedAt: string;
  expiryDays: number;
  qty: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: Role;
  action: string;
  detail: string;
}

export interface OfflinePunch {
  id: string;
  empId: string;
  type: "in" | "out";
  at: string;
}

export type View =
  | "dashboard"
  | "attendance"
  | "payroll"
  | "leaves"
  | "marketplace"
  | "orders"
  | "inventory"
  | "system";
