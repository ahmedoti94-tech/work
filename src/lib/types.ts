export type Role = "super" | "hr" | "production" | "sales" | "customer";

export interface SavedAddress {
  id: string;
  govId: string;
  city: string;
  street: string;
  phone: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  empId?: string;
  title: string;
  phone?: string;
  savedAddresses?: SavedAddress[];
}

/** مصفوفة التوصيل للمحافظات المصرية */
export interface Governorate {
  id: string;
  name: string;
  fee: number;      // جنيه مصري
  days: string;     // مدة التوصيل المتوقعة
}

export type WageType = "daily" | "monthly";

export interface Employee {
  id: string;
  name: string;
  title: string;
  dept: string;
  shift: ShiftKey;
  wageType: WageType;      // أجر يومي (يومية) أو راتب شهري
  baseSalary: number;      // الشهري بالجنيه
  dailyRate?: number;      // اليومية بالجنيه
  joinDate: string;
  active: boolean;
  archived?: boolean;
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
  gps?: string;
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
  notes: string[];
  seasonal?: string;
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
  governorate?: string;
  city?: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  qty: number;
  reorderPoint: number;
  capacity: number;
  supplier: string;
  costPerUnit: number;  // جنيه مصري
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
  prevHash: string;
  hash: string;
  ip?: string;
  agent?: string;
}

export type ThreatKind = "nosql" | "xss" | "brute" | "forgery" | "geo" | "csrf";

export interface ThreatEvent {
  id: string;
  at: string;
  kind: ThreatKind;
  ip: string;
  detail: string;
  action: string;
}

export interface RefreshRotation {
  id: string;
  at: string;
  ip: string;
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
  | "security"
  | "workers"
  | "system";
