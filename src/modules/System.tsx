import { useMemo, useState } from "react";
import { useStore, ROLE_LABEL } from "../lib/store";
import type { Severity } from "../lib/types";
import { Badge, Card, Icon, SectionHead } from "../components/ui";
import { inputCls } from "../components/ui";

const SEV_TONE: Record<Severity, "mute" | "butter" | "berry"> = { info: "mute", warning: "butter", critical: "berry" };

const PRISMA_SCHEMA = `// prisma/schema.prisma — PostgreSQL
enum Role { SUPER_ADMIN HR PRODUCTION SALES CUSTOMER }
enum ShiftKey { MORNING EVENING NIGHT }
enum LeaveType { SICK ANNUAL UNPAID PERMISSION }
enum LeaveStatus { PENDING APPROVED REJECTED }
enum OrderStage { PENDING BAKING SHIPPED DELIVERED }
enum PackTier { BOX CARTON PALLET }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String              // bcrypt, cost 12
  role          Role     @default(CUSTOMER)
  name          String
  refreshTokens RefreshToken[]
  auditLogs     AuditLog[]
}

model Employee {
  id         String   @id @default(cuid())
  badgeCode  String   @unique        // OW-0114 → QR at gates
  name       String
  department String
  shift      ShiftKey
  baseSalary Decimal  @db.Decimal(10,2)
  joinedAt   DateTime
  attendance AttendanceLog[]
  leaves     LeaveRequest[]
  advances   Advance[]
  payslips   Payslip[]
}

model AttendanceLog {
  id         String   @id @default(cuid())
  employee   Employee @relation(fields: [empId], references: [id])
  empId      String
  date       DateTime @db.Date
  checkIn    Int?                   // minutes since midnight
  checkOut   Int?
  source     String                 // QR_GATE | MANUAL | SUPERVISOR
  note       String?
  @@unique([empId, date])
  @@index([date])
}

model LeaveRequest {
  id       String      @id @default(cuid())
  employee Employee    @relation(fields: [empId], references: [id])
  empId    String
  type     LeaveType
  from     DateTime    @db.Date
  to       DateTime    @db.Date
  reason   String
  status   LeaveStatus @default(PENDING)
  decidedBy String?
}

model Advance {              // السلف
  id           String   @id @default(cuid())
  employee     Employee @relation(fields: [empId], references: [id])
  empId        String
  amount       Decimal  @db.Decimal(10,2)
  reason       String
  settledInRun String?
}

model PayrollRun {
  id        String   @id @default(cuid())
  month     String   @unique          // "2025-06"
  finalized Boolean  @default(false)
  payslips  Payslip[]
}

model Payslip {
  id          String     @id @default(cuid())
  run         PayrollRun @relation(fields: [runId], references: [id])
  runId       String
  employee    Employee   @relation(fields: [empId], references: [id])
  empId       String
  baseEarned  Decimal    @db.Decimal(10,2)
  overtimePay Decimal    @db.Decimal(10,2)
  deductions  Decimal    @db.Decimal(10,2)
  advances    Decimal    @db.Decimal(10,2)
  net         Decimal    @db.Decimal(10,2)
  pdfUrl      String?
}

model Product {
  id        String      @id @default(cuid())
  name      String
  family    String
  moqCartons Int
  packs     PackOption[]
  items     OrderItem[]
  batches   Batch[]
}

model PackOption {
  id        String   @id @default(cuid())
  product   Product  @relation(fields: [productId], references: [id])
  productId String
  tier      PackTier
  unitPrice Decimal  @db.Decimal(8,2)
}

model Order {
  id        String      @id @default(cuid())
  ref       String      @unique
  stage     OrderStage  @default(PENDING)
  placedBy  String
  items     OrderItem[]
  total     Decimal     @db.Decimal(10,2)
  timeline  StageEvent[]
}

model OrderItem {
  id        String  @id @default(cuid())
  order     Order   @relation(fields: [orderId], references: [id])
  orderId   String
  product   Product @relation(fields: [productId], references: [id])
  productId String
  tier      PackTier
  qty       Int
}

model RawMaterial {
  id        String @id @default(cuid())
  name      String
  stock     Int
  reorderAt Int
}

model Batch {
  id         String   @id @default(cuid())
  product    Product  @relation(fields: [productId], references: [id])
  productId  String
  lotNo      String   @unique
  expiresAt  DateTime @db.Date
}

model AuditLog {              // append-only, no UPDATE/DELETE grants
  id       String   @id @default(cuid())
  actor    User?    @relation(fields: [actorId], references: [id])
  actorId  String?
  action   String
  target   String
  detail   String
  severity String
  at       DateTime @default(now())
}`;

const API_ROUTES: { m: string; path: string; guard: string; desc: string }[] = [
  { m: "POST", path: "/api/auth/[...nextauth]", guard: "public · rate-limit 10/min", desc: "Credentials + JWT refresh rotation in HttpOnly cookies" },
  { m: "GET", path: "/api/products", guard: "public · ISR 300s", desc: "Catalogue with pack tiers, edge-cached" },
  { m: "POST", path: "/api/attendance/punch", guard: "employee · zod · rate-limit", desc: "QR gate punch — writes exact-minute timestamp" },
  { m: "POST", path: "/api/attendance/override", guard: "HR + reason required", desc: "Supervisor correction → audit(critical)" },
  { m: "POST", path: "/api/leaves/:id/decide", guard: "HR", desc: "Approve/reject feeds payroll engine" },
  { m: "POST", path: "/api/payroll/run", guard: "HR · idempotency key", desc: "Finalize month, settle advances, mint PDFs" },
  { m: "PATCH", path: "/api/employees/:id/salary", guard: "SUPER_ADMIN only", desc: "Dual-control salary adjustment → audit(critical)" },
  { m: "POST", path: "/api/orders", guard: "customer · zod schema", desc: "Validates MOQ + stock atomically in transaction" },
  { m: "PATCH", path: "/api/orders/:id/stage", guard: "SALES / PRODUCTION", desc: "Advance stage → timeline event + audit" },
  { m: "POST", path: "/api/inventory/receive", guard: "PRODUCTION", desc: "GRN booking, updates reorder alerts" },
  { m: "GET", path: "/api/audit", guard: "SUPER_ADMIN · read-only", desc: "Immutable trail — DB role lacks DELETE grant" },
];

const FOLDER_TREE = `ovenwright/
├─ prisma/schema.prisma          # models above + seed
├─ src/
│  ├─ app/
│  │  ├─ (shop)/[slug]/page.tsx  # ISR product pages
│  │  ├─ dashboard/              # role-scoped server components
│  │  └─ api/                    # route handlers above
│  ├─ lib/
│  │  ├─ payroll.ts              # pure engine (unit-tested)
│  │  ├─ rbac.ts                 # can(role, action) matrix
│  │  └─ audit.ts                # append-only writer
│  ├─ components/                # shadcn/ui primitives
│  └─ middleware.ts              # JWT verify + role gate + CSRF`;

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-raise px-4 py-2.5">
        <span className="label-xs">{label}</span>
        <button onClick={copy} className="btn-press flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-mute hover:text-brand">
          <Icon name={copied ? "check" : "copy"} size={13} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto bg-sunken/60 p-4 text-[11.5px] leading-relaxed text-ink dark:bg-sunken">
        <code>{code}</code>
      </pre>
    </Card>
  );
}

export default function System() {
  const { audit, user } = useStore();
  const [tab, setTab] = useState<"audit" | "blueprint">("audit");
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [q, setQ] = useState("");

  const list = useMemo(
    () => audit.filter((a) =>
      (sev === "all" || a.severity === sev) &&
      (a.action + a.target + a.actor + a.detail).toLowerCase().includes(q.toLowerCase())
    ),
    [audit, sev, q]
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-linestrong">
          {([["audit", "Audit trail"], ["blueprint", "Architecture blueprint"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`btn-press px-4 py-2 text-[12.5px] font-bold ${tab === k ? "bg-ink text-bg dark:bg-cream dark:text-sunken" : "bg-surface text-mute hover:text-ink"}`}>
              {l}
            </button>
          ))}
        </div>
        {tab === "audit" && (
          <span className="chip"><Icon name="shield" size={12} /> Append-only · {audit.length} events</span>
        )}
      </div>

      {tab === "audit" ? (
        <Card className="p-4">
          <SectionHead
            title="Immutable audit trail"
            sub="Salary changes, attendance overrides, payroll runs and order movements — nothing is ever edited or deleted"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" className={`${inputCls} w-48 py-1.5 pl-8 text-[12.5px]`} />
                </div>
                {(["all", "info", "warning", "critical"] as const).map((s) => (
                  <button key={s} onClick={() => setSev(s)}
                    className={`btn-press rounded-lg border px-3 py-1.5 text-[11.5px] font-bold capitalize ${
                      sev === s ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute hover:text-ink"}`}>
                    {s}
                  </button>
                ))}
              </div>
            }
          />
          <div className="space-y-2">
            {list.map((a) => (
              <div key={a.id} className={`flex gap-3 rounded-lg border border-line bg-raise p-3 transition-colors hover:border-linestrong ${a.severity === "critical" ? "border-l-berry border-l-4" : a.severity === "warning" ? "border-l-butter border-l-4" : "border-l-linestrong border-l-4"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-bold">{a.action}</p>
                    <Badge tone={SEV_TONE[a.severity]} className="capitalize">{a.severity}</Badge>
                    <Badge tone="mute">{ROLE_LABEL[a.role]}</Badge>
                  </div>
                  <p className="num mt-0.5 text-[12px] font-semibold text-brand">{a.target}</p>
                  <p className="mt-0.5 text-[11.5px] text-mute">{a.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11.5px] font-bold">{a.actor}</p>
                  <p className="num text-[10.5px] text-mute">
                    {new Date(a.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    {new Date(a.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {list.length === 0 && <p className="py-10 text-center text-[13px] text-mute">No events match your filters.</p>}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="max-w-3xl rounded-xl border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-mute">
            Signed in as <b className="text-ink">{user.name}</b> ({ROLE_LABEL[user.role]}) — the reference architecture this console
            simulates: Next.js App Router + PostgreSQL/Prisma, JWT rotation, Zod validation and RBAC-guarded server actions.
          </p>
          <div className="grid gap-4 xl:grid-cols-2">
            <CodeBlock code={PRISMA_SCHEMA} label="1 · Database schema — prisma/schema.prisma" />
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="border-b border-line bg-raise px-4 py-2.5"><span className="label-xs">2 · Key API routes & guards</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-raise text-[10px] uppercase tracking-[0.12em] text-mute">
                      <tr><th className="px-4 py-2 font-bold">Method</th><th className="px-2 py-2 font-bold">Route</th><th className="px-2 py-2 font-bold">Guard</th></tr>
                    </thead>
                    <tbody>
                      {API_ROUTES.map((r) => (
                        <tr key={r.path + r.m} className="border-t border-line hover:bg-raise">
                          <td className="px-4 py-2"><span className={`num rounded px-1.5 py-0.5 text-[10.5px] font-extrabold ${r.m === "GET" ? "bg-sage/15 text-sage" : r.m === "PATCH" ? "bg-butter/20 text-[#8a6410]" : "bg-brand/12 text-brand"}`}>{r.m}</span></td>
                          <td className="num px-2 py-2 font-semibold">{r.path}</td>
                          <td className="px-2 py-2 text-mute">{r.guard}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <CodeBlock code={FOLDER_TREE} label="3 · Project structure" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
