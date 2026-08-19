import { useMemo, useState } from "react";
import { ROLE_AR, useStore } from "../lib/store";
import { Badge, Btn, Icon, SectionHead, inputCls, type BadgeTone } from "../components/ui";

const FOLDERS = `ovenwright/
├─ app/                      # Next.js App Router
│  ├─ (auth)/login/          # دخول + JWT في كوكي HttpOnly
│  ├─ (portal)/              # لوحة المصنع (محمية بـ RBAC)
│  │  ├─ dashboard/  attendance/  payroll/  leaves/  inventory/  system/
│  ├─ (shop)/                # المتجر — ISR للكتالوج وصفحات المنتجات
│  │  ├─ catalog/  catalog/[slug]/  cart/  checkout/  orders/[id]/
│  └─ api/                   # مسارات API محمية
├─ components/  modules/     # واجهات عربية RTL-first
├─ lib/
│  ├─ payroll.ts             # محرك الرواتب والإضافي والخصومات
│  ├─ rbac.ts · audit.ts · whatsapp.ts · export.ts (CSV/Excel)
│  └─ validations.ts         # مخططات Zod لكل المدخلات
├─ prisma/schema.prisma      # قاعدة البيانات الكاملة
└─ public/sw.js · manifest   # PWA: حضور دون اتصال + مزامنة`;

const SCHEMA = `model Employee {
  id String @id @default(cuid())
  name String  phone String  pinHash String  // bcrypt
  title String  dept String  shift Shift @default(MORNING)
  baseSalary Decimal @db.Decimal(10,2)
  joinDate DateTime  active Boolean @default(true)
  attendance Attendance[]  leaves LeaveRequest[]
  advances Advance[]  payslips Payslip[]
}
enum Shift { MORNING EVENING NIGHT }

model Attendance {            // بوابة الحضور (+ طابور مزامنة PWA)
  id String @id @default(cuid())
  emp Employee @relation(fields:[empId], references:[id])  empId String
  date DateTime @db.Date  in Int?  out Int?   // دقائق من منتصف الليل
  method PunchMethod  bySupervisor Boolean @default(false)
  @@unique([empId, date])
}

model Payslip {               // مسير الرواتب الشهري
  id String @id  empId String  emp Employee @relation(...)
  month String  workDays Int  presentDays Int
  base Decimal  overtime Decimal  lateDeduction Decimal
  unpaidDeduction Decimal  advances Decimal  net Decimal
  status SlipStatus  issuedAt DateTime?
  @@unique([empId, month])
}
model Advance { id String @id  empId String  amount Decimal
  note String  settledMonth String? }
model LeaveRequest { id String @id  empId String  type LeaveType
  from DateTime  to DateTime  reason String  status ApprovalStatus }

model Product {               // الكتالوج — ISR + أسعار الجملة
  id String @id  slug String @unique  nameAr String
  family String  moqCartons Int  stockCartons Int
  packs Pack[]  batches Batch[]  orderItems OrderItem[]
}
model Pack { id String @id  productId String  tier PackTier
  units Int  price Decimal }   // box / carton / pallet
model Batch { id String @id  lot String @unique  productId String
  producedAt DateTime  expiryDays Int  qty Int }  // تنبيهات صلاحية

model Order { id String @id  ref String @unique  customer String
  customerPhone String  status OrderStatus  payment PaymentMethod
  subtotal Decimal  discount Decimal  deliveryFee Decimal  total Decimal
  deliverOn DateTime  window String  items OrderItem[]  timeline TimelineEvent[] }
model OrderItem { id String @id  orderId String  productId String
  tier PackTier  qty Int  cartons Decimal  rate Decimal  net Decimal }
model AuditLog {              // سجل غير قابل للتعديل (append-only)
  id String @id  at DateTime @default(now())  actor String
  role Role  action String  detail String }
model OfflinePunch { id String @id  empId String  type String
  at DateTime  synced Boolean @default(false) }`;

const ROUTES = `POST /api/auth/[...nextauth]      تسجيل دخول · bcrypt + JWT في HttpOnly
GET  /api/products?family=&q=     كتالوج عام (ISR 60s) — للجميع
POST /api/orders                  إنشاء طلب · Zod + rate limit · خصم الشرائح
PATCH /api/orders/:id/status      تحديث الحالة · sales/super فقط · تدقيق + واتساب
GET  /api/attendance/today        كشف اليوم · hr/super/production
POST /api/attendance/punch        بصمة · الموظف نفسه أو مشرف · يعمل عبر مزامنة PWA
POST /api/attendance/manual       إدخال يدوي · hr/super فقط · تدقيق إلزامي
GET  /api/payroll?month=          المسير · hr/super فقط
POST /api/payroll/finalize        اعتماد المسير · super فقط · تسوية السلف
POST /api/advances                تسجيل سلفة · hr/super · تدقيق
PATCH /api/employees/:id/salary   تعديل راتب · super فقط · تدقيق مزدوج
GET  /api/inventory/alerts        حد الطلب + الصلاحية · production/super
GET  /api/audit                   السجل · super فقط · قراءة بلا تعديل`;

const RTL_SETUP = `// app/layout.tsx — الجذر العربي RTL
export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={tajawal.className}>{children}</body>
    </html>
  );
}

// tailwind.config — دعم الاتجاهين دون كسر التصميم
// استخدم ms/me/ps/pe و start/end (خصائص منطقية) بدل ml/mr/left/right
// الأرقام: font-mono مع direction: ltr على عناصر الأرقام فقط

// next.config.js — الأداء
experimental: { optimizePackageImports: ["recharts"] }
images: { formats: ["image/avif","image/webp"] }  // صور المنتجات`;

export default function System() {
  const { audit } = useStore();
  const [tab, setTab] = useState<"audit" | "blueprint">("audit");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const list = useMemo(
    () => audit.filter((a) => (a.actor + a.action + a.detail).includes(q)),
    [audit, q]
  );

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const toneOf = (action: string): BadgeTone =>
    action.includes("راتب") || action.includes("سلفة") ? "berry"
      : action.includes("حضور") || action.includes("مزامنة") ? "brand"
      : action.includes("طلب") || action.includes("استلام") ? "sage" : "butter";

  return (
    <div>
      <SectionHead
        title="النظام والتدقيق"
        desc="سجل الإجراءات الحساسة + المخطط المعماري الكامل للنسخة الإنتاجية (Next.js)"
        actions={
          <div className="flex gap-1.5">
            <button onClick={() => setTab("audit")} className={`btn-press rounded-full border px-4 py-1.5 text-[12.5px] font-bold ${tab === "audit" ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute"}`}>سجل التدقيق</button>
            <button onClick={() => setTab("blueprint")} className={`btn-press rounded-full border px-4 py-1.5 text-[12.5px] font-bold ${tab === "blueprint" ? "border-brand bg-brand text-cream" : "border-line bg-surface text-mute"}`}>المخطط المعماري</button>
          </div>
        }
      />

      {tab === "audit" ? (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-bold">
              <Icon name="shield" size={16} className="text-brand" /> سجل ملحق فقط — لا يمكن تعديله أو حذفه
            </p>
            <div className="relative">
              <Icon name="search" size={14} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في السجل…" className={`${inputCls} w-52 py-1.5 ps-8 text-[12.5px]`} />
            </div>
          </div>
          <div className="divide-y divide-line/70">
            {list.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-raise/60">
                <span className="num w-32 shrink-0 text-[11px] font-semibold text-mute" dir="ltr">{a.at}</span>
                <Badge tone={toneOf(a.action)}>{a.action}</Badge>
                <span className="min-w-0 flex-1 text-[12.5px] font-semibold">{a.detail}</span>
                <span className="text-[11px] font-bold text-mute">{a.actor} · {ROLE_AR[a.role]}</span>
              </div>
            ))}
            {list.length === 0 && <p className="p-8 text-center text-[13px] font-semibold text-mute">لا نتائج لـ «{q}»</p>}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { key: "rtl", title: "إعداد RTL والخطوط العربية (Next.js + Tailwind)", desc: "الجذر lang=ar dir=rtl + خصائص اتجاه منطقية", code: RTL_SETUP },
            { key: "folders", title: "هيكل المشروع", desc: "بوابة المصنع + المتجر + API في تطبيق واحد", code: FOLDERS },
            { key: "schema", title: "مخطط قاعدة البيانات (Prisma)", desc: "الموظفون والحضور والمسير والطلبات والمخزون والتدقيق", code: SCHEMA },
            { key: "routes", title: "مسارات API وحماية الصلاحيات", desc: "كل مسار مقيد بدور + Zod + rate limiting", code: ROUTES },
          ].map((s) => (
            <div key={s.key} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <h3 className="font-display text-[14.5px] font-bold">{s.title}</h3>
                  <p className="text-[11px] font-semibold text-mute">{s.desc}</p>
                </div>
                <Btn size="sm" variant="outline" onClick={() => copy(s.key, s.code)}>
                  <Icon name={copied === s.key ? "check" : "sheet"} size={14} /> {copied === s.key ? "نُسخ" : "نسخ"}
                </Btn>
              </div>
              <pre dir="ltr" className="max-h-80 overflow-auto bg-sunken/60 p-4 text-start font-mono text-[11px] leading-relaxed text-ink">
                {s.code}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
